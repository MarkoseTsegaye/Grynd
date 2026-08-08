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
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0A0A0A" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
