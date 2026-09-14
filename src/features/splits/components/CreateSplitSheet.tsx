import React, { useCallback, useMemo, type RefObject } from 'react';
import { Platform, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../../shared/components/Button';
import { colors } from '../../../shared/theme/colors';
import { textRoles, typography } from '../../../shared/theme/typography';
import { useCreateSplit } from '../hooks/useCreateSplit';

const isWeb = Platform.OS === 'web';

interface Props {
  sheetRef: RefObject<BottomSheetModal | null>;
  /** Fired with the new split's id once it is persisted. */
  onCreated: (splitId: string) => void;
}

/**
 * Naming a split used to happen in a form that pushed the list down and
 * turned the floating CTA into a Cancel button — the only screen in the app
 * that worked that way. All the logic already lives in `useCreateSplit`
 * (validation, duplicate names, the success haptic); this is just the chrome.
 */
export function CreateSplitSheet({ sheetRef, onCreated }: Props) {
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['40%'], []);

  const { name, setName, canSubmit, isSubmitting, validationError, handleSubmit } = useCreateSplit(
    (splitId) => {
      sheetRef.current?.dismiss();
      onCreated(splitId);
    },
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      bottomInset={insets.bottom}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: '#141414' }}
      handleIndicatorStyle={{ backgroundColor: '#3D3B38' }}
    >
      {/* Inline styles rather than className from here down: the
          BottomSheetView / BottomSheetTextInput → gesture-handler →
          react-native-web wrapper chain drops NativeWind classes, the same
          reason NumericInput and LogWeightSheet carry a web rescue. */}
      <BottomSheetView style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}>
        <Text
          className={`text-text-primary ${textRoles.modalTitle} mb-3`}
          style={
            isWeb
              ? {
                  color: colors['text-primary'],
                  fontFamily: typography.fonts.sansBold,
                  fontSize: typography.sizes.lg,
                }
              : undefined
          }
          accessibilityRole="header"
        >
          New split
        </Text>

        <BottomSheetTextInput
          className="bg-surface-2 rounded-lg px-4 py-3 text-text-primary font-sans text-base"
          style={
            isWeb
              ? {
                  backgroundColor: colors['surface-2'],
                  borderRadius: 8,
                  borderWidth: 0,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  color: colors['text-primary'],
                  fontFamily: typography.fonts.sans,
                  fontSize: typography.sizes.base,
                  width: '100%',
                }
              : undefined
          }
          value={name}
          onChangeText={setName}
          placeholder="Split name (e.g. Push, Legs)"
          placeholderTextColor="#8A8580"
          autoFocus
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={() => void handleSubmit()}
          accessibilityLabel="Split name"
        />

        {validationError ? (
          <Text
            className={`text-danger ${textRoles.caption} mt-2`}
            style={
              isWeb
                ? {
                    color: colors.danger,
                    fontFamily: typography.fonts.sans,
                    fontSize: typography.sizes.xs,
                    marginTop: 8,
                  }
                : undefined
            }
          >
            {validationError}
          </Text>
        ) : null}

        <View className="mt-4" style={{ marginTop: 16 }}>
          <Button
            label="Create"
            onPress={() => void handleSubmit()}
            loading={isSubmitting}
            disabled={!canSubmit}
            accessibilityLabel="Create split"
          />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
