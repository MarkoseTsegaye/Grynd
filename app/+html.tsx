import React, { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

/**
 * Root HTML for the web/PWA build. Only runs in Node during static rendering,
 * so it has no access to the DOM or the app's React tree.
 *
 * Two things here are load-bearing for the home-screen PWA on iPhone:
 *
 * - `viewport-fit=cover` is what makes `env(safe-area-inset-*)` report real
 *   values. react-native-safe-area-context's web implementation reads those,
 *   so without it every inset is 0 — content sits under the notch and the tab
 *   bar gets clipped by the home indicator.
 * - `apple-mobile-web-app-status-bar-style: black-translucent` makes the status
 *   bar area transparent instead of the default opaque white bar. It only takes
 *   effect in standalone (added-to-home-screen) mode, and it requires the safe
 *   area insets above so content is not hidden underneath it.
 */
const backgroundColor = '#0A0A0A';

const rootStyles = `
html, body, #root {
  background-color: ${backgroundColor};
  color-scheme: dark;
}
body {
  /* Standalone PWAs should not rubber-band or offer pull-to-refresh mid-set. */
  overscroll-behavior-y: none;
  /* Removes the double-tap-to-zoom gesture (and its 300ms tap delay) so fast
     repeated taps on the number pad register as taps. */
  touch-action: manipulation;
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* Zoom stays enabled on purpose — `touch-action` below kills the
            double-tap zoom that rapid keypad taps would otherwise trigger,
            without taking pinch-zoom away from anyone who needs it. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />

        {/* Home-screen PWA behaviour */}
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
