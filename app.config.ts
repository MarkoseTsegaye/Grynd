import { ExpoConfig, ConfigContext } from 'expo/config';

const IS_PROD = process.env.APP_ENV === 'production';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_PROD ? 'WorkoutLogger' : 'WorkoutLogger (dev)',
  slug: 'workout-logger',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0A0A0A',
  },
  assetBundlePatterns: ['**/*'],
  ios: { supportsTablet: false },
  android: {
    ...(config.android ?? {}),
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#0A0A0A' },
    softwareKeyboardLayoutMode: 'resize',
  },
  scheme: 'workout-logger',
  extra: {
    appEnv: process.env.APP_ENV ?? 'development',
  },
  plugins: ['expo-router'],
});
