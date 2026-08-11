import React, { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

/**
 * Root HTML shell for the static web export. Overrides the default Expo Router
 * shell so the viewport opts into `viewport-fit=cover` — iOS Safari only
 * populates `env(safe-area-inset-*)` values (and therefore
 * `useSafeAreaInsets()` on web) when this is set. Without it, the tab bar and
 * screen headers collapse onto the notch / home indicator.
 *
 * Also enables the PWA "add to home screen" install path with a matching
 * status-bar style so the standalone shell blends into the dark theme.
 */
const backgroundColor = '#0A0A0A';
const tabBarColor = '#141414';

/*
 * Paint the html/body dark so the env(safe-area-inset-*) regions around the
 * viewport (visible now that we opted into viewport-fit=cover) blend into the
 * tab bar / status bar area instead of exposing the browser's default white.
 *
 * The pseudo-element paints only the bottom safe-area strip with the tab bar's
 * surface-1 color so the ~34 px iOS home-indicator gap visually blends into
 * the tab bar (which react-navigation on web positions above that safe area
 * with its own offset). The top safe area keeps the surface-0 body color so
 * the screen header still reads as content, not tab bar.
 */
const rootStyles = [
  `html,body{background-color:${backgroundColor};color-scheme:dark;}`,
  // A standalone PWA should not rubber-band or offer pull-to-refresh mid-set,
  // and double-tap zoom would otherwise eat fast repeated number-pad taps.
  // Pinch zoom is deliberately left enabled.
  'body{overscroll-behavior-y:none;touch-action:manipulation;}',
  'body::after{',
  'content:"";',
  'position:fixed;',
  'left:0;right:0;bottom:0;',
  'height:env(safe-area-inset-bottom);',
  `background-color:${tabBarColor};`,
  'pointer-events:none;',
  'z-index:0;',
  '}',
].join('');

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Grynd" />
        <meta name="theme-color" content={backgroundColor} />
        <link rel="manifest" href="/manifest.json" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: rootStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
