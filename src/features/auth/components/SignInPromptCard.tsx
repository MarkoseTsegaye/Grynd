import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/components/Icon';
import { textRoles } from '../../../shared/theme/typography';

interface Props {
  onSignIn: () => void;
  onDismiss: () => void;
}

/**
 * Soft nudge shown on the Home tab after the user has logged a few
 * workouts. Not modal — it sits in the flow above the splits list.
 * Dismiss hides it forever (per useSignInPrompt) so a user who says
 * "no thanks" never sees it again.
 */
export function SignInPromptCard({ onSignIn, onDismiss }: Props) {
  return (
    <View
      className="bg-surface-1 rounded-lg px-4 py-4 flex-row items-start"
      style={{ borderWidth: 1, borderColor: 'rgba(232, 255, 71, 0.35)' }}
      accessibilityRole="alert"
    >
      <Icon name="cloud-upload-outline" size={22} color="accent" />
      <View className="flex-1 ml-3">
        <Text className={`text-text-primary ${textRoles.cardTitle}`}>
          Back up your progress
        </Text>
        <Text className={`text-text-secondary ${textRoles.bodySmall} mt-0.5`}>
          Sign in to sync your workouts across devices and keep them safe if
          you reinstall.
        </Text>
        <View className="flex-row gap-2 mt-3">
          <TouchableOpacity
            className="bg-accent rounded-lg px-4 py-2"
            onPress={onSignIn}
            accessibilityLabel="Sign in from Home prompt"
            activeOpacity={0.7}
          >
            <Text className={`text-surface-0 ${textRoles.buttonLabelSmall}`}>
              Sign in
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-surface-2 rounded-lg px-4 py-2"
            onPress={onDismiss}
            accessibilityLabel="Dismiss sign-in prompt"
            activeOpacity={0.7}
          >
            <Text className={`text-text-secondary ${textRoles.buttonLabelSmall}`}>
              Not now
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
