import React, { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../../shared/components/Button';
import { Icon } from '../../../shared/components/Icon';
import { colors } from '../../../shared/theme/colors';
import { textRoles, typography } from '../../../shared/theme/typography';
import { useAuthStore } from '../store/authStore';

interface Props {
  sheetRef: RefObject<BottomSheetModal | null>;
  onChange?: (index: number) => void;
}

type Step = 'request' | 'verify';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LENGTH = 6;
/** Long enough to outlast Supabase's own send throttle, short enough to not feel punitive. */
const RESEND_COOLDOWN_SECONDS = 45;

/**
 * Bottom sheet the user opens from Settings → Account → Sign in.
 *
 * One path: they type their email, we send a 6-digit code, they type it
 * back. The emailed link into an installed iOS PWA is unreliable (see
 * plan-of-record), so the code is the supported route, not the link.
 *
 * Apple and Google buttons used to sit above this. They were removed
 * rather than hidden — no OAuth provider is configured and none is
 * planned, so they were two taps that could only dead-end.
 */
export function SignInSheet({ sheetRef, onChange }: Props) {
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => [Platform.OS === 'web' ? '85%' : '60%'], []);
  const sendEmailOtp = useAuthStore((s) => s.sendEmailOtp);
  const verifyEmailOtp = useAuthStore((s) => s.verifyEmailOtp);
  const isSigningIn = useAuthStore((s) => s.isSigningIn);

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  // Guards the auto-submit: without it, a failed verify would re-fire on
  // every keystroke-free re-render while six digits sat in the field.
  const submittedToken = useRef<string | null>(null);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  );

  const resetSheet = useCallback(() => {
    setStep('request');
    setEmail('');
    setToken('');
    setError(null);
    setResendIn(0);
    submittedToken.current = null;
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

  // Resend cooldown. Ticks only while it has something to count.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const canSubmitEmail = EMAIL_RE.test(email.trim()) && !isSigningIn;
  const canVerifyToken = token.trim().length === OTP_LENGTH && !isSigningIn;

  const handleSendCode = useCallback(async () => {
    if (!canSubmitEmail) return;
    setError(null);
    const result = await sendEmailOtp(email.trim());
    if (result.ok) {
      setStep('verify');
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } else {
      setError(result.error);
    }
  }, [canSubmitEmail, email, sendEmailOtp]);

  const handleResend = useCallback(async () => {
    if (resendIn > 0 || isSigningIn) return;
    setError(null);
    setToken('');
    submittedToken.current = null;
    const result = await sendEmailOtp(email.trim());
    if (result.ok) setResendIn(RESEND_COOLDOWN_SECONDS);
    else setError(result.error);
  }, [email, isSigningIn, resendIn, sendEmailOtp]);

  const handleVerifyCode = useCallback(async () => {
    const value = token.trim();
    if (value.length !== OTP_LENGTH || isSigningIn) return;
    submittedToken.current = value;
    setError(null);
    const result = await verifyEmailOtp(email.trim(), value);
    if (result.ok) {
      resetSheet();
      sheetRef.current?.dismiss();
    } else {
      setError(result.error);
    }
  }, [email, isSigningIn, resetSheet, sheetRef, token, verifyEmailOtp]);

  // The sixth digit is the whole intent — making the user reach for a
  // button afterwards is a step with no decision in it.
  useEffect(() => {
    const value = token.trim();
    if (step !== 'verify') return;
    if (value.length !== OTP_LENGTH) return;
    if (submittedToken.current === value) return;
    void handleVerifyCode();
  }, [handleVerifyCode, step, token]);

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
      <BottomSheetView style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}>
        {/* Web has no pan-down-to-close gesture, so it needs a real target. */}
        {Platform.OS === 'web' ? (
          <View className="flex-row justify-end -mr-1 -mt-1">
            <TouchableOpacity
              onPress={() => sheetRef.current?.dismiss()}
              accessibilityLabel="Close sign in"
              accessibilityRole="button"
              activeOpacity={0.7}
              hitSlop={12}
              className="p-2"
            >
              <Icon name="close" size={24} color="text-secondary" />
            </TouchableOpacity>
          </View>
        ) : null}

        <Text
          className={`text-text-primary ${textRoles.modalTitle} mb-1`}
          style={webText(typography.fonts.sansBold, typography.sizes.lg, colors['text-primary'])}
          accessibilityRole="header"
        >
          {step === 'request' ? 'Back up your progress' : 'Enter your code'}
        </Text>
        <Text
          className={`text-text-secondary ${textRoles.bodySmall} mb-6`}
          style={webText(typography.fonts.sans, typography.sizes.sm, colors['text-secondary'])}
        >
          {step === 'request'
            ? "One sign-in and your workouts sync across devices. Nothing changes on this device — everything you've logged stays right here."
            : `We sent a 6-digit code to ${email}. It signs you in as soon as you finish typing it.`}
        </Text>

        {step === 'request' ? (
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
              onSubmitEditing={() => void handleSendCode()}
              accessibilityLabel="Email address"
              style={webInput(typography.fonts.sans, typography.sizes.base)}
            />
            {error ? <ErrorLine message={error} /> : null}
            <Button
              label="Send code"
              onPress={() => void handleSendCode()}
              loading={isSigningIn}
              disabled={!canSubmitEmail}
              accessibilityLabel="Send sign-in code"
            />
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
              maxLength={OTP_LENGTH}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void handleVerifyCode()}
              accessibilityLabel="Sign-in code"
              style={{
                ...webInput(typography.fonts.monoBold, typography.sizes['2xl']),
                textAlign: 'center',
              }}
            />
            {error ? <ErrorLine message={error} /> : null}
            <Button
              label="Sign in"
              onPress={() => void handleVerifyCode()}
              loading={isSigningIn}
              disabled={!canVerifyToken}
              accessibilityLabel="Verify code"
            />

            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                className="py-2 pr-3"
                onPress={() => {
                  setStep('request');
                  setToken('');
                  setError(null);
                  submittedToken.current = null;
                }}
                accessibilityLabel="Try a different email"
                accessibilityRole="button"
                activeOpacity={0.7}
              >
                <Text
                  className={`text-text-secondary ${textRoles.bodySmall}`}
                  style={webText(typography.fonts.sans, typography.sizes.sm, colors['text-secondary'])}
                >
                  Try a different email
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="py-2 pl-3"
                onPress={() => void handleResend()}
                disabled={resendIn > 0 || isSigningIn}
                accessibilityLabel={
                  resendIn > 0 ? `Resend available in ${resendIn} seconds` : 'Resend code'
                }
                accessibilityRole="button"
                accessibilityState={{ disabled: resendIn > 0 || isSigningIn }}
                activeOpacity={0.7}
              >
                <Text
                  className={`${resendIn > 0 ? 'text-text-secondary' : 'text-accent'} ${textRoles.bodySmall}`}
                  style={webText(
                    typography.fonts.sans,
                    typography.sizes.sm,
                    resendIn > 0 ? colors['text-secondary'] : colors.accent,
                  )}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <Text
      className={`text-danger ${textRoles.caption}`}
      style={webText(typography.fonts.sans, typography.sizes.xs, colors.danger)}
    >
      {message}
    </Text>
  );
}

/**
 * The BottomSheetTextInput → gesture-handler → react-native-web wrapper
 * chain drops NativeWind classes, so anything inside this sheet needs its
 * type and colour restated inline on web. Same rescue as NumericInput.
 */
function webText(fontFamily: string, fontSize: number, color: string) {
  return Platform.OS === 'web' ? { fontFamily, fontSize, color } : undefined;
}

function webInput(fontFamily: string, fontSize: number) {
  return Platform.OS === 'web'
    ? {
        backgroundColor: colors['surface-2'],
        borderRadius: 8,
        borderWidth: 0,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: colors['text-primary'],
        fontFamily,
        fontSize,
        width: '100%' as const,
      }
    : undefined;
}
