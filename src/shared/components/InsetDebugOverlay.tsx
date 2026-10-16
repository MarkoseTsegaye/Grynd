import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { textRoles } from '../theme/typography';

/**
 * Throwaway diagnostic for the installed-PWA tab bar geometry.
 *
 * Chromium reports `env(safe-area-inset-*)` as 0 and React Navigation's web
 * tab bar computes from it, so the real safe-area layout cannot be
 * reproduced in a headless browser — these numbers have to come off the
 * device. Opens only on `?debug=insets`, web only.
 *
 * Delete once the tab bar question is settled.
 */
export function InsetDebugOverlay() {
  const insets = useSafeAreaInsets();
  const [dom, setDom] = useState<Record<string, string>>({});

  const enabled =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location.search.includes('debug=insets');

  useEffect(() => {
    if (!enabled) return;
    // Let the tab bar lay out before measuring it.
    const id = setTimeout(() => {
      const out: Record<string, string> = {};
      const vh = window.innerHeight;
      out['window.innerHeight'] = String(vh);
      out['screen.height'] = String(window.screen?.height ?? '?');
      out['devicePixelRatio'] = String(window.devicePixelRatio);
      out['standalone'] =
        String((window.navigator as { standalone?: boolean }).standalone ?? 'n/a');

      // What the CSS environment actually reports.
      const probe = document.createElement('div');
      probe.style.cssText =
        'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom);padding-top:env(safe-area-inset-top);';
      document.body.appendChild(probe);
      const cs = getComputedStyle(probe);
      out['env(bottom)'] = cs.paddingBottom;
      out['env(top)'] = cs.paddingTop;
      probe.remove();

      // The painted tab bar: walk up from a tab label to the first
      // full-width ancestor that paints a background.
      const label = Array.from(document.querySelectorAll('div')).find(
        (d) => d.textContent?.trim() === 'Home' && d.children.length === 0,
      );
      if (label) {
        out['label bottom gap'] = String(Math.round(vh - label.getBoundingClientRect().bottom));
        let node: HTMLElement | null = label;
        while (node?.parentElement) {
          node = node.parentElement;
          const r = node.getBoundingClientRect();
          const bg = getComputedStyle(node).backgroundColor;
          if (r.width >= window.innerWidth - 1 && bg !== 'rgba(0, 0, 0, 0)' && r.height < 200) {
            out['bar height'] = String(Math.round(r.height));
            out['bar bottom gap'] = String(Math.round(vh - r.bottom));
            out['bar bg'] = bg;
            break;
          }
        }
      } else {
        out['tab bar'] = 'not found';
      }

      const atBottom = document.elementFromPoint(window.innerWidth / 2, vh - 4);
      out['bottom 4px bg'] = atBottom ? getComputedStyle(atBottom).backgroundColor : 'none';

      setDom(out);
    }, 900);
    return () => clearTimeout(id);
  }, [enabled]);

  if (!enabled) return null;

  const rows: [string, string][] = [
    ['insets.top', String(insets.top)],
    ['insets.bottom', String(insets.bottom)],
    ...Object.entries(dom),
  ];

  return (
    <View
      className="bg-surface-2 rounded-lg"
      style={{ position: 'absolute', top: 60, left: 10, right: 10, maxHeight: 420, zIndex: 9999, padding: 10 }}
    >
      <Text className={`text-accent ${textRoles.captionMono} mb-1`}>INSET DEBUG</Text>
      <ScrollView>
        {rows.map(([k, v]) => (
          <Text key={k} className={`text-text-primary ${textRoles.captionMono}`} style={{ fontSize: 13 }}>
            {k}: {v}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}
