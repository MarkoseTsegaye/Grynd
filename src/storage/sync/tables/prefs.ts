import type { SupabaseClient } from '@supabase/supabase-js';
import type { PrefsSyncRow } from '../../../shared/store/prefsStore';
import { usePrefsStore } from '../../../shared/store/prefsStore';
import type { TableAdapter } from '../lib/adapter';

const TABLE = 'prefs' as const;
const SINGLETON_ROW_ID = 'singleton' as const;

interface ServerRow {
  user_id: string;
  weight_unit: 'kg' | 'lbs';
  auto_advance_cycle: boolean;
  default_rest_seconds: number;
  updated_at: number;
}

function toServerRow(row: PrefsSyncRow, userId: string): ServerRow {
  return {
    user_id: userId,
    weight_unit: row.weightUnit,
    auto_advance_cycle: row.autoAdvanceCycle,
    default_rest_seconds: row.defaultRestSeconds,
    updated_at: row.updatedAt,
  };
}

function fromServerRow(row: ServerRow): PrefsSyncRow {
  return {
    weightUnit: row.weight_unit,
    autoAdvanceCycle: row.auto_advance_cycle,
    defaultRestSeconds: row.default_rest_seconds,
    updatedAt: row.updated_at,
  };
}

export const prefsAdapter: TableAdapter = {
  name: TABLE,

  async pushRow(supabase, row) {
    const { error } = await supabase.from(TABLE).upsert(row as ServerRow, {
      onConflict: 'user_id',
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  async pull(supabase, uid, sinceMs) {
    let query = supabase.from(TABLE).select('*').eq('user_id', uid);
    if (sinceMs != null) query = query.gt('updated_at', sinceMs);

    const { data, error } = await query.maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: true, nextSince: null };

    const prefs = fromServerRow(data as ServerRow);
    await usePrefsStore.getState().applyServerPrefs(prefs);
    return { ok: true, nextSince: prefs.updatedAt };
  },

  seedRows(uid) {
    const prefs = usePrefsStore.getState().getPrefsForSync();
    // Skip the initial seed until the local prefs have been touched
    // once — pushing a zero-timestamp row would beat every future
    // pull on LWW and stick the defaults on the server forever.
    if (prefs.updatedAt === 0) return [];
    return [{ rowId: SINGLETON_ROW_ID, serverRow: toServerRow(prefs, uid) }];
  },

  subscribe(uid, enqueue) {
    let lastUpdatedAt = usePrefsStore.getState().updatedAt;
    return usePrefsStore.subscribe((state) => {
      if (state.updatedAt > lastUpdatedAt) {
        lastUpdatedAt = state.updatedAt;
        enqueue(SINGLETON_ROW_ID, toServerRow(state.getPrefsForSync(), uid));
      }
    });
  },
};
