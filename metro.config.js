const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// zustand's `import` export condition points at ESM builds, and its devtools
// middleware uses `import.meta.env`. Expo's web export loads the bundle as a
// classic script, where `import.meta` is a syntax error. Native picks zustand's
// `react-native` condition (CJS) and is unaffected, so restrict this to web.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && /^zustand(\/|$)/.test(moduleName)) {
    return context.resolveRequest(
      { ...context, isESMImport: false },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/global.css' });
