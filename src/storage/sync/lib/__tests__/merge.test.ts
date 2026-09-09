import { describe, expect, it } from 'vitest';
import { maxUpdatedAt, mergeByLastWrite, type SyncableRow } from '../merge';

interface Row extends SyncableRow {
  name: string;
}

describe('mergeByLastWrite', () => {
  it('returns local unchanged when incoming is empty', () => {
    const local: Row[] = [{ id: 'a', updatedAt: 1, name: 'one' }];
    const merged = mergeByLastWrite(local, []);
    expect(merged).toEqual(local);
  });

  it('adds rows that do not exist locally', () => {
    const local: Row[] = [{ id: 'a', updatedAt: 1, name: 'one' }];
    const incoming: Row[] = [{ id: 'b', updatedAt: 2, name: 'two' }];
    const merged = mergeByLastWrite(local, incoming);
    expect(merged).toHaveLength(2);
    expect(merged.find((r) => r.id === 'b')?.name).toBe('two');
  });

  it('replaces a local row when incoming has a greater updatedAt', () => {
    const local: Row[] = [{ id: 'a', updatedAt: 1, name: 'stale' }];
    const incoming: Row[] = [{ id: 'a', updatedAt: 5, name: 'fresh' }];
    const merged = mergeByLastWrite(local, incoming);
    expect(merged.find((r) => r.id === 'a')?.name).toBe('fresh');
  });

  it('keeps the local row when its updatedAt is greater', () => {
    const local: Row[] = [{ id: 'a', updatedAt: 10, name: 'newer' }];
    const incoming: Row[] = [{ id: 'a', updatedAt: 3, name: 'older' }];
    const merged = mergeByLastWrite(local, incoming);
    expect(merged.find((r) => r.id === 'a')?.name).toBe('newer');
  });

  it('takes incoming on tie so a server echo settles pending buffered writes', () => {
    const local: Row[] = [{ id: 'a', updatedAt: 5, name: 'local' }];
    const incoming: Row[] = [{ id: 'a', updatedAt: 5, name: 'server-echo' }];
    const merged = mergeByLastWrite(local, incoming);
    expect(merged.find((r) => r.id === 'a')?.name).toBe('server-echo');
  });

  it('does not mutate the input arrays', () => {
    const local: Row[] = [{ id: 'a', updatedAt: 1, name: 'one' }];
    const incoming: Row[] = [{ id: 'a', updatedAt: 2, name: 'two' }];
    const localCopy = [...local];
    const incomingCopy = [...incoming];
    mergeByLastWrite(local, incoming);
    expect(local).toEqual(localCopy);
    expect(incoming).toEqual(incomingCopy);
  });
});

describe('maxUpdatedAt', () => {
  it('returns null for an empty list', () => {
    expect(maxUpdatedAt([])).toBeNull();
  });

  it('returns the max updatedAt', () => {
    const rows: SyncableRow[] = [
      { id: 'a', updatedAt: 1 },
      { id: 'b', updatedAt: 10 },
      { id: 'c', updatedAt: 5 },
    ];
    expect(maxUpdatedAt(rows)).toBe(10);
  });
});
