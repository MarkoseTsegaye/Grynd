type SizeKey = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

export const typography = {
  fonts: {
    sans: 'Inter_400Regular',
    sansMedium: 'Inter_500Medium',
    sansBold: 'Inter_700Bold',
    mono: 'JetBrainsMono_400Regular',
    monoBold: 'JetBrainsMono_700Bold',
  },
  sizes: {
    xs: 14,
    sm: 16,
    base: 18,
    lg: 20,
    xl: 22,
    '2xl': 26,
    '3xl': 32,
    '4xl': 40,
  },
  lineHeights: {
    xs: 18,
    sm: 22,
    base: 26,
    lg: 30,
    xl: 30,
    '2xl': 34,
    '3xl': 38,
    '4xl': 44,
  },
} as const;

export function buildTailwindFontSize(): Record<SizeKey, [string, { lineHeight: string }]> {
  const keys = Object.keys(typography.sizes) as SizeKey[];
  return keys.reduce(
    (acc, key) => {
      acc[key] = [
        `${typography.sizes[key]}px`,
        { lineHeight: `${typography.lineHeights[key]}px` },
      ];
      return acc;
    },
    {} as Record<SizeKey, [string, { lineHeight: string }]>,
  );
}

/** Semantic typography roles mapped to Tailwind utility classes (size + weight + family). */
export const textRoles = {
  /** Tab/stack screen headers. Use numberOfLines on long titles. */
  screenTitle: 'font-sans-bold text-4xl',
  /** Bottom sheet / dialog titles. */
  modalTitle: 'font-sans-bold text-lg',
  /** Prominent in-card headings (today split, exercise name). Use numberOfLines when text may overflow. */
  listTitle: 'font-sans-bold text-3xl',
  /** Uppercase section headers (settings groups, list sections). */
  sectionLabel: 'font-sans text-xs uppercase tracking-widest',
  /** Compact section labels without uppercase transform (e.g. "TODAY"). */
  sectionLabelCompact: 'font-sans text-xs tracking-widest',
  /** Primary row/card headings. */
  cardTitle: 'font-sans-bold text-base',
  /** Medium-weight list row titles. */
  listItemTitle: 'font-sans-medium text-base',
  /** Medium-weight secondary headings (session split name in history). */
  cardTitleSmall: 'font-sans-medium text-sm',
  /** Default readable copy and form inputs. */
  body: 'font-sans text-base',
  /** Default readable copy in monospace. */
  bodyMono: 'font-mono text-base',
  /** Secondary descriptions and helper text. */
  bodySmall: 'font-sans text-sm',
  /** Metadata, timestamps, set labels. Matches tab bar label size (14px). */
  caption: 'font-sans text-xs',
  /** Bold caption text in narrow containers (cycle day pills). */
  captionBold: 'font-sans-bold text-xs',
  /** Monospace caption (exercise counter). */
  captionMono: 'font-mono text-xs',
  /** Inline numeric values (set weights/reps). */
  metric: 'font-mono text-sm',
  /** Emphasized inline numeric values. */
  metricBold: 'font-mono-bold text-sm',
  /** Numeric values at body size (plate picker buttons). */
  metricBody: 'font-mono-bold text-base',
  /** Large numeric emphasis (set counts, plate totals). */
  metricLarge: 'font-mono-bold text-2xl',
  /** Hero numeric display (full-width weight/rep inputs). */
  metricDisplay: 'font-mono-bold text-4xl',
  /** Numeric display in constrained columns (plate-mode total). */
  metricDisplayCompact: 'font-mono-bold text-3xl',
  /** Primary button label. */
  buttonLabel: 'font-sans-bold text-base',
  /** Ghost button label. */
  buttonLabelMedium: 'font-sans-medium text-base',
  /** Compact action buttons (Finish). */
  buttonLabelSmall: 'font-sans-bold text-sm',
  /** Segmented control / toggle labels. */
  toggleLabel: 'font-sans-bold text-sm',
  /** Prominent CTA label (Log Set button). */
  actionLabel: 'font-sans-bold text-xl',
  /** NumericInput default value size. Pair with font-mono-bold in the input. */
  inputValue: 'text-4xl',
  /** NumericInput compact value size. */
  inputValueCompact: 'text-2xl',
  /** NumericInput suffix in default size. */
  inputSuffix: 'text-sm',
  /** NumericInput suffix in compact size. */
  inputSuffixCompact: 'text-xs',
  /** Badge label text. */
  badge: 'font-mono text-sm',
} as const;

export type TextRole = keyof typeof textRoles;
