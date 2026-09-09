import React, { useCallback, useMemo, useState, type RefObject } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../shared/components/Icon';
import { colors } from '../../../shared/theme/colors';
import { textRoles, typography } from '../../../shared/theme/typography';
import { useAuthStore } from '../store/authStore';

interface Props {
  sheetRef: RefObject<BottomSheetModal | null>;
  onChange?: (index: number) => void;
}

type Step = 'providers' | 'email-request' | 'email-verify';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Bottom sheet the user opens from Settings → Account → Sign in. Three
 * paths in v1:
 *
 *   - **Apple** — one tap (native `signInWithApple` on iOS, OAuth redirect
 *     on web/Android via Supabase).
 *   - **Google** — one tap (OAuth redirect via Supabase).
 *   - **Email magic link** — user types their email → we send an OTP →
 *     user pastes the 6-digit code back into the sheet to finish.
 *
 * The magic-link deep-link back into an installed iOS PWA is unreliable
 * (see plan-of-record), so we intentionally use OTP (short numeric code
 * pasted from the email) instead of a clickable link. Works everywhere.
 */
export function SignInSheet({ sheetRef, onChange }: Props) {
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => [Platform.OS === 'web' ? '85%' : '60%'], []);
  const signInWithApple = useAuthStore((s) => s.signInWithApple);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const sendEmailOtp = useAuthStore((s) => s.sendEmailOtp);
  const verifyEmailOtp = useAuthStore((s) => s.verifyEmailOtp);
  const isSigningIn = useAuthStore((s) => s.isSigningIn);

  const [step, setStep] = useState<Step>('providers');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  );

  const resetSheet = useCallback(() => {
    setStep('providers');
    setEmail('');
    setToken('');
    setError(null);
  }, []);

  const handleSheetChange = useCallback(
    (index: number) => {
      onChange?.(index);
      // Deliberately do NOT reset on dismiss. A user who sent a code
      // and then accidentally swiped down should reopen and land right
      // back on the token entry — Supabase rate-limits repeat sends,
      // and forcing them to re-request is a bad UX.
      // Reset happens explicitly on successful sign-in (see
      // handleVerifyCode) or when the user backs out.
    },
    [onChange],
  );

  const canSubmitEmail = EMAIL_RE.test(email.trim()) && !isSigningIn;
  const canVerifyToken = token.trim().length >= 6 && !isSigningIn;

  const handleSendCode = useCallback(async () => {
    if (!canSubmitEmail) return;
    setError(null);
    const result = await sendEmailOtp(email.trim());
    if (result.ok) {
      setStep('email-verify');
    } else {
      setError(result.error);
    }
  }, [canSubmitEmail, email, sendEmailOtp]);

  const handleVerifyCode = useCallback(async () => {
    if (!canVerifyToken) return;
    setError(null);
    const result = await verifyEmailOtp(email.trim(), token.trim());
    if (result.ok) {
      resetSheet();
      sheetRef.current?.dismiss();
    } else {
      setError(result.error);
    }
  }, [canVerifyToken, email, resetSheet, sheetRef, token, verifyEmailOtp]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      bottomInset={insets.bottom}
      backdropComponent={renderBackdrop}
      onChange={handleSheetChange}
      backgroundStyle={{ backgroundColor: '#141414' }}
      handleIndicatorStyle={{ backgroundColor: '#3D3B38' }}
    >
      <BottomSheetView className="px-5 pt-2 pb-8 flex-1">
        <Text
          className={`text-text-primary ${textRoles.modalTitle} mb-1`}
          accessibilityRole="header"
        >
          {step === 'providers' ? 'Back up your progress' : 'Enter your email'}
        </Text>
        <Text className={`text-text-secondary ${textRoles.bodySmall} mb-6`}>
          {step === 'providers'
            ? 'Sign in in one tap so your data syncs across devices and survives a reinstall.'
            : step === 'email-request'
              ? "We'll email you a 6-digit code to sign in — no password required."
              : `We sent a code to ${email}. Paste it below to finish signing in.`}
        </Text>

        {step === 'providers' ? (
          <View className="gap-3">
            <ProviderButton
              icon="apple"
              label="Continue with Apple"
              onPress={signInWithApple}
              busy={isSigningIn}
              tone="on-light"
            />
            <ProviderButton
              icon="google"
              label="Continue with Google"
              onPress={signInWithGoogle}
              busy={isSigningIn}
              tone="on-light"
            />
            <ProviderButton
              icon="email"
              label="Continue with email"
              onPress={() => setStep('email-request')}
              busy={false}
              tone="on-surface"
            />
          </View>
        ) : step === 'email-request' ? (
          <View className="gap-3">
            <BottomSheetTextInput
              className="bg-surface-2 rounded-lg px-4 py-3 text-text-primary font-sans text-base"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#8A8580"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              autoFocus
              returnKeyType="send"
              onSubmitEditing={handleSendCode}
              accessibilityLabel="Email address"
              style={
                Platform.OS === 'web'
                  ? {
                      // Same web-only inline rescue as NumericInput —
                      // BottomSheetTextInput's wrapper chain drops className.
                      color: colors['text-primary'],
                      fontFamily: typography.fonts.sans,
                      fontSize: typography.sizes.base,
                    }
                  : undefined
              }
            />
            {error ? (
              <Text className={`text-danger ${textRoles.caption}`}>{error}</Text>
            ) : null}
            <TouchableOpacity
              className={`bg-accent rounded-lg py-4 items-center ${!canSubmitEmail ? 'opacity-40' : ''}`}
              onPress={handleSendCode}
              disabled={!canSubmitEmail}
              accessibilityLabel="Send sign-in code"
              activeOpacity={0.7}
            >
              {isSigningIn ? (
                <ActivityIndicator color={colors['surface-0']} />
              ) : (
                <Text className={`text-surface-0 ${textRoles.buttonLabel}`}>Send code</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              className="items-center py-2"
              onPress={() => {
                setStep('providers');
                setError(null);
              }}
              accessibilityLabel="Back to sign-in options"
              activeOpacity={0.7}
            >
              <Text className={`text-text-secondary ${textRoles.bodySmall}`}>Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="gap-3">
            <BottomSheetTextInput
              className="bg-surface-2 rounded-lg px-4 py-3 text-text-primary font-mono-bold text-2xl text-center"
              value={token}
              onChangeText={setToken}
              placeholder="000000"
              placeholderTextColor="#3D3B38"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleVerifyCode}
              accessibilityLabel="Sign-in code"
              style={
                Platform.OS === 'web'
                  ? {
                      color: colors['text-primary'],
                      fontFamily: typography.fonts.monoBold,
                      fontSize: typography.sizes['2xl'],
                    }
                  : undefined
              }
            />
            {error ? (
              <Text className={`text-danger ${textRoles.caption}`}>{error}</Text>
            ) : null}
            <TouchableOpacity
              className={`bg-accent rounded-lg py-4 items-center ${!canVerifyToken ? 'opacity-40' : ''}`}
              onPress={handleVerifyCode}
              disabled={!canVerifyToken}
              accessibilityLabel="Verify code"
              activeOpacity={0.7}
            >
              {isSigningIn ? (
                <ActivityIndicator color={colors['surface-0']} />
              ) : (
                <Text className={`text-surface-0 ${textRoles.buttonLabel}`}>Sign in</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              className="items-center py-2"
              onPress={() => {
                setStep('email-request');
                setToken('');
                setError(null);
              }}
              accessibilityLabel="Try a different email"
              activeOpacity={0.7}
            >
              <Text className={`text-text-secondary ${textRoles.bodySmall}`}>Try a different email</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function ProviderButton({
  icon,
  label,
  onPress,
  busy,
  tone,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void | Promise<void>;
  busy: boolean;
  /** on-light = light background (Apple/Google convention) · on-surface = surface-2 */
  tone: 'on-light' | 'on-surface';
}) {
  const bg = tone === 'on-light' ? 'bg-text-primary' : 'bg-surface-2';
  const fg = tone === 'on-light' ? 'text-surface-0' : 'text-text-primary';
  const iconColor = tone === 'on-light' ? 'surface-0' : 'text-primary';
  return (
    <TouchableOpacity
      className={`flex-row items-center justify-center gap-2 rounded-lg py-4 ${bg} ${busy ? 'opacity-40' : ''}`}
      onPress={() => void onPress()}
      disabled={busy}
      accessibilityLabel={label}
      activeOpacity={0.7}
    >
      <Icon name={icon} size={20} color={iconColor} />
      <Text className={`${fg} ${textRoles.buttonLabel}`}>{label}</Text>
    </TouchableOpacity>
  );
}
