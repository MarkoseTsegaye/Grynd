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
        {/* Paint the html/body dark so the env(safe-area-inset-*) regions
            around the viewport (visible now that we opted into
            viewport-fit=cover) blend into the tab bar / status bar area
            instead of exposing the browser's default white.
            The pseudo-element paints only the bottom safe-area strip with the
            tab bar's surface-1 color so the ~34 px iOS home-indicator gap
            visually blends into the tab bar (which react-navigation on web
            positions above that safe area with its own offset). The top
            safe area keeps the surface-0 body color so the screen header
            still reads as content, not tab bar. */}
        <style
          dangerouslySetInnerHTML={{
            __html: [
              'html,body{background-color:#0A0A0A;}',
              'body::after{',
              'content:"";',
              'position:fixed;',
              'left:0;right:0;bottom:0;',
              'height:env(safe-area-inset-bottom);',
              'background-color:#141414;',
              'pointer-events:none;',
              'z-index:0;',
              '}',
            ].join(''),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
