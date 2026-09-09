import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const status = useAuthStore((s) => s.status);
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const isSigningIn = useAuthStore((s) => s.isSigningIn);
  const errorMessage = useAuthStore((s) => s.errorMessage);

  return {
    status,
    session,
    user,
    isSigningIn,
    errorMessage,
    isSignedIn: status === 'anonymous' || status === 'identified',
    isAnonymous: status === 'anonymous',
    isIdentified: status === 'identified',
    isUnconfigured: status === 'unconfigured',
  };
}
