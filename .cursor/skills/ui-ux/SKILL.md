---
name: ui-ux
description: >-
  Apply Grynd UI/UX standards for typography, spacing, color, hierarchy, motion,
  and NativeWind patterns. Use when designing or polishing screens, components,
  sheets, headers, forms, CTAs, swipe/transitions, or when the user asks about
  look and feel, spacing, fonts, visual consistency, or UX polish.
---

# Grynd UI/UX

Read this skill before changing UI. Prefer tokens over one-offs.

## Source of truth

| Concern | Path |
|---|---|
| Typography roles | `src/shared/theme/typography.ts` → `textRoles` |
| Colors | `src/shared/theme/colors.ts` |
| Shared controls | `src/shared/components/` (`Button`, `Badge`, `NumericInput`) |
| Screens | `app/` |
| Feature UI | `src/features/<name>/components/` |

Always use `textRoles.*` class strings. Do not invent `text-5xl`, raw `font-sans text-base`, or System fonts unless a third-party picker theme requires sizes.

## Typography hierarchy

| Role | Use |
|---|---|
| `screenTitle` | Tab roots only (Home, Splits, History, Settings) |
| `modalTitle` | Every bottom-sheet / dialog title |
| `listTitle` | In-content hero under a stack header (split name, exercise name) |
| `sectionLabel` | Uppercase section headers |
| `fieldLabel` | Uppercase form labels (WEIGHT, REPS, …) |
| `cardTitle` / `listItemTitle` | Row / card headings |
| `body` / `bodySmall` / `caption` | Copy, helpers, metadata |
| `metric*` | Numbers (sets, weights, timers) |
| `buttonLabel` | Primary CTA labels (default size) |
| `toggleLabel` | Segmented chips (kg/lbs, rest durations) |

### Rules

1. **One screen title** — Stack screens keep RN `headerTitle` (styled via `stackHeaderOptions` in `app/_layout.tsx`). Do not also paint `screenTitle` in content.
2. **Sheets always use `modalTitle`** — never `bodySmall` / `cardTitleSmall` for sheet headers.
3. **Primary CTAs share `buttonLabel`** — reserve louder roles only when the action is uniquely hero-level and documented.
4. **Chips use `toggleLabel`** — same padding recipe (`px-3 py-1.5` settings; compact `px-2 py-0.5` inline).

## Color & surfaces

- Backgrounds: `surface-0` page, `surface-1` cards/sheets, `surface-2` inputs/chips
- Text: `text-primary` / `text-secondary` / `text-disabled`
- Accent `#E8FF47` for primary actions and progress; success/danger/warning for status only
- Prefer `colors.*` tokens over hardcoded hex in sheets, headers, placeholders

## Spacing rhythm

- Horizontal page padding: `px-5` (20)
- Sheet content: `px-6` with `pb-8 pt-2`
- Section gaps: `mb-8` between settings groups; `mb-3` after section labels
- Primary CTA vertical padding: `py-4` (match across floating and inline CTAs)
- Tab roots: `pt-14` for status-bar clearance under custom headers

## Motion (Reanimated)

Grynd motion should feel **snappy and motivating**, not decorative.

| Context | Pattern |
|---|---|
| Workout swipe | Translate + slight scale/opacity; success haptic on advance |
| Content enter | Direction-aware `FadeInLeft` / `FadeInRight`; short spring (~200–240ms) |
| Progress | Pulse active progress dot on exercise index change |
| Haptics | `useHaptics()` or `expo-haptics` — medium commit, success on meaningful advance |

Constants live in `src/features/workout/constants/swipeMotion.ts`.

**Do not:** long fades, bounce-heavy springs, emoji confetti, or motion that blocks interaction.

## Headers

- Tabs: custom `screenTitle` + `pt-14`
- Stack: `headerShown: true` via shared `stackHeaderOptions` (Inter bold, `sizes.base`, surface-1)
- Content under stack: `listTitle` or `cardTitle` for identity, not a second `screenTitle`

## Forms & sheets

- Labels → `fieldLabel`
- Inputs → `textRoles.body` + `placeholderTextColor={colors['text-disabled']}` (or secondary for softer placeholders)
- Sheet chrome → `colors['surface-1']` background, `colors['text-disabled']` handle
- Confirm/Cancel row → equal `flex-1` buttons, `buttonLabel`

## Checklist before shipping UI

- [ ] All text uses a `textRoles` entry
- [ ] No duplicate screen titles on stack routes
- [ ] Sheet titles are `modalTitle`
- [ ] CTA sizes match peers on the same surface
- [ ] Spacing matches px-5 / mb-8 rhythm
- [ ] Colors from tokens
- [ ] Motion is short, purposeful, and haptic-backed when it confirms progress
- [ ] `npm run typecheck && npm run lint` clean for touched files

## Anti-patterns

- Light iOS themes inside Grynd dark surfaces
- Mixing `caption` / `bodySmall` / `toggleLabel` for the same chip pattern
- Using `actionLabel` without an explicit product reason
- Cards-for-decoration (borders/shadows that aren't interactive containers)
- Purple gradients, glow stacks, or generic AI landing aesthetics — stay on Grynd charcoal + accent lime

## More detail

- Role table & size scale: [typography-reference.md](typography-reference.md)
