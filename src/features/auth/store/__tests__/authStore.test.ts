import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the supabase module. Each test overrides the return values on the
// individual method mocks so we can steer the store into every branch.
type AuthChangeHandler = (event: string, session: unknown) => void;

const authApi = {
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(
    (_cb: AuthChangeHandler) => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
  ),
};

let configured = true;

vi.mock('../../../../lib/supabase', () => ({
  get supabase() {
    return configured ? { auth: authApi } : null;
  },
  isSupabaseConfigured: () => configured,
}));

// react-native's Platform is imported at the top of authStore.ts for the
// OAuth redirect helper. Stub just what we touch.
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// zustand's devtools middleware tries to reach window.__REDUX_DEVTOOLS_EXTENSION__
// in the browser; it's a no-op in node but silences a warning to declare it.
vi.stubGlobal('window', undefined);

// Fresh module (and therefore fresh store) per test so state from one case
// never bleeds into the next.
async function loadStore() {
  vi.resetModules();
  const mod = await import('../authStore');
  return mod.useAuthStore;
}

describe('authStore', () => {
  beforeEach(() => {
    configured = true;
    Object.values(authApi).forEach((fn) => {
      if (typeof fn === 'function' && 'mockReset' in fn) fn.mockReset();
    });
    authApi.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('bootstrap', () => {
    it('resolves to `unconfigured` when Supabase env vars are missing', async () => {
      configured = false;
      const useAuthStore = await loadStore();

      await useAuthStore.getState().bootstrap();

      expect(useAuthStore.getState().status).toBe('unconfigured');
      expect(authApi.getSession).not.toHaveBeenCalled();
    });

    it('restores an existing session without touching signInAnonymously', async () => {
      const existing = {
        access_token: 't',
        user: { id: 'u1', app_metadata: { providers: ['google'] } },
      };
      authApi.getSession.mockResolvedValue({ data: { session: existing } });
      const useAuthStore = await loadStore();

      await useAuthStore.getState().bootstrap();

      expect(authApi.signInAnonymously).not.toHaveBeenCalled();
      const s = useAuthStore.getState();
      expect(s.status).toBe('identified');
      expect(s.user?.id).toBe('u1');
    });

    it('creates an anonymous account on first launch', async () => {
      authApi.getSession.mockResolvedValue({ data: { session: null } });
      authApi.signInAnonymously.mockResolvedValue({
        data: {
          session: { access_token: 't', user: { id: 'anon-1', is_anonymous: true } },
          user: { id: 'anon-1', is_anonymous: true },
        },
        error: null,
      });
      const useAuthStore = await loadStore();

      await useAuthStore.getState().bootstrap();

      expect(authApi.signInAnonymously).toHaveBeenCalledOnce();
      expect(useAuthStore.getState().status).toBe('anonymous');
    });

    it('surfaces anonymous sign-in errors as `error` status', async () => {
      authApi.getSession.mockResolvedValue({ data: { session: null } });
      authApi.signInAnonymously.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'anon sign-ins disabled' },
      });
      const useAuthStore = await loadStore();

      await useAuthStore.getState().bootstrap();

      const s = useAuthStore.getState();
      expect(s.status).toBe('error');
      expect(s.errorMessage).toBe('anon sign-ins disabled');
    });

    it('subscribes to auth changes and updates state on token refresh', async () => {
      authApi.getSession.mockResolvedValue({
        data: {
          session: { access_token: 't', user: { id: 'u1', is_anonymous: true } },
        },
      });
      let handler: AuthChangeHandler | undefined;
      authApi.onAuthStateChange.mockImplementation((cb: AuthChangeHandler) => {
        handler = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });
      const useAuthStore = await loadStore();

      await useAuthStore.getState().bootstrap();

      // Simulate the user linking an identity later — provider list now
      // non-empty, status should flip to 'identified'.
      handler?.('TOKEN_REFRESHED', {
        access_token: 't2',
        user: { id: 'u1', app_metadata: { providers: ['apple'] } },
      });

      expect(useAuthStore.getState().status).toBe('identified');
    });
  });

  describe('sendEmailOtp', () => {
    it('returns a not-configured error when supabase is null', async () => {
      configured = false;
      const useAuthStore = await loadStore();

      const result = await useAuthStore.getState().sendEmailOtp('a@b.co');

      expect(result).toEqual({ ok: false, error: 'Cloud sign-in is not configured.' });
    });

    it('returns { ok: true } on success and clears the busy flag', async () => {
      authApi.signInWithOtp.mockResolvedValue({ error: null });
      const useAuthStore = await loadStore();

      const result = await useAuthStore.getState().sendEmailOtp('a@b.co');

      expect(result.ok).toBe(true);
      expect(useAuthStore.getState().isSigningIn).toBe(false);
      expect(authApi.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@b.co' }),
      );
    });

    it('propagates the provider error message', async () => {
      authApi.signInWithOtp.mockResolvedValue({ error: { message: 'rate limited' } });
      const useAuthStore = await loadStore();

      const result = await useAuthStore.getState().sendEmailOtp('a@b.co');

      expect(result).toEqual({ ok: false, error: 'rate limited' });
      expect(useAuthStore.getState().errorMessage).toBe('rate limited');
    });
  });

  describe('verifyEmailOtp', () => {
    it('promotes an anonymous session to identified on success', async () => {
      authApi.verifyOtp.mockResolvedValue({
        data: {
          session: {
            access_token: 't',
            user: { id: 'u1', app_metadata: { providers: ['email'] } },
          },
          user: { id: 'u1', app_metadata: { providers: ['email'] } },
        },
        error: null,
      });
      const useAuthStore = await loadStore();

      const result = await useAuthStore.getState().verifyEmailOtp('a@b.co', '123456');

      expect(result.ok).toBe(true);
      expect(useAuthStore.getState().status).toBe('identified');
    });

    it('returns the provider error and does not change status', async () => {
      authApi.verifyOtp.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'invalid code' },
      });
      const useAuthStore = await loadStore();

      const before = useAuthStore.getState().status;
      const result = await useAuthStore.getState().verifyEmailOtp('a@b.co', '000000');

      expect(result).toEqual({ ok: false, error: 'invalid code' });
      expect(useAuthStore.getState().status).toBe(before);
    });
  });

  describe('signOut', () => {
    it('clears session, user, and returns status to idle', async () => {
      authApi.signOut.mockResolvedValue({ error: null });
      const useAuthStore = await loadStore();
      useAuthStore.setState({
        session: { access_token: 't' } as never,
        user: { id: 'u1' } as never,
        status: 'identified',
      });

      await useAuthStore.getState().signOut();

      const s = useAuthStore.getState();
      expect(s.session).toBeNull();
      expect(s.user).toBeNull();
      expect(s.status).toBe('idle');
    });

    it('is a no-op when supabase is not configured', async () => {
      configured = false;
      const useAuthStore = await loadStore();

      await useAuthStore.getState().signOut();

      expect(authApi.signOut).not.toHaveBeenCalled();
    });
  });
});
