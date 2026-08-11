# Grynd — UI/UX Improvement Backlog

Observations from the v1 screenshots, organized by screen, with concrete upgrades to
prototype in `mockup.html` before porting to the React Native app. Ranked **P1 (do first)**
→ **P3 (polish)** within each area.

---

## 0. Cross-cutting (system-level)

| # | Pri | Issue | Upgrade |
|---|-----|-------|---------|
| 0.1 | **P1** | Tab bar shows a stray **`▾ picker`** item — a dev/debug route leaking into production nav. | Remove from the tab bar; 5 tabs max (Home, Splits, Progress, History, Settings). |
| 0.2 | **P1** | **"Progr…"** label is truncated. | Rename tab to **"Progress"** (fits at 5 tabs) or use icon-only with smaller label. |
| 0.3 | P2 | Only one accent color carries every meaning (CTA, active state, PB, links, chart). | Keep lime as the single brand accent but add subtle tonal steps so a primary CTA doesn't compete visually with an active tab and a link. |
| 0.4 | P2 | No empty/loading/skeleton states visible. | Define empty states for History, Progress, and a fresh Splits list. |
| 0.5 | P3 | Inconsistent corner radii between cards and chips. | Standardize on tokens: `18px` cards, `12px` controls. |

---

## 1. Workouts (Home)

| # | Pri | Issue | Upgrade |
|---|-----|-------|---------|
| 1.1 | **P1** | "Tomorrow · Rest" chip is small and easy to miss; no sense of the week ahead. | Replace with a compact **8-day cycle strip** (dots/pills) showing current day, so "Day 5 of 8" is visual, not just text. |
| 1.2 | P2 | All Splits rows are visually identical to *today's* split — today isn't distinguished in the list. | Mark today's split in the list (accent left-border or "Today" tag) so the hero and list stay in sync. |
| 1.3 | P2 | "5 exercises" is the only metadata per split. | Add muscle-group tags or estimated duration; show last-performed date. |
| 1.4 | P3 | Emoji 🏋️ used as the split icon. | Ship a proper vector glyph set per split type (Push/Pull/Legs). |

---

## 2. Progress (list)

| # | Pri | Issue | Upgrade |
|---|-----|-------|---------|
| 2.1 | **P1** | List of splits looks identical to the Home splits list — unclear this is "tap to see charts." | Add a mini sparkline or "▲ 4%" trend chip on each row so the row previews progress. |
| 2.2 | P2 | "Yse" row (2 exercises) looks like a typo/junk split. | Add a way to rename/archive junk splits; validate split names on create. |
| 2.3 | P2 | "Workout volume" card sits alone at the top with no data preview. | Inline a small volume sparkline + current-week total on the card. |

---

## 3. Exercise detail (RDL chart)

| # | Pri | Issue | Upgrade |
|---|-----|-------|---------|
| 3.1 | **P1** | Y-axis is fixed 195–215 so a flat 205 line reads as "no progress" even though reps went up. | Auto-scale the axis, and/or plot **estimated 1RM** (weight×reps) so rep gains show as a rising line. |
| 3.2 | P2 | "Dot size = reps" is clever but undiscoverable and hard to compare. | Add an explicit reps label on the latest point, or a secondary faint reps line. |
| 3.3 | P2 | Time-range chips (1/2/6 mo, All) don't show which has data. | Disable/subdue ranges with no data; default to the smallest range that has ≥3 points. |
| 3.4 | P3 | No interaction on the chart. | Add tap-to-inspect a point (date, weight × reps, RPE). |

---

## 4. History

| # | Pri | Issue | Upgrade |
|---|-----|-------|---------|
| 4.1 | **P1** | Dense monospace set lines with `^`, `˅`, `L`, `Assist`, `FAIL`, `RPE 10`, `0RIR` have no legend — high cognitive load. | Add a one-time legend / info sheet; consider replacing `^ ^` ASCII with real trend icons and a color key. |
| 4.2 | **P1** | Multi-drop sets render as raw math: `45 × 1, 25 × 1 × 8 reps`. | Design a clear **drop-set / cluster-set** row format (e.g. stacked "45→25 · 8 reps"). |
| 4.3 | P2 | "+1 exercises / 9 sets total" footer is muted and easy to miss. | Make the card tappable → full session (screen 6); show a session summary chip (volume, PRs). |
| 4.4 | P2 | "1 sets" grammar. | Pluralize correctly ("1 set"). |
| 4.5 | P3 | No filtering/search by exercise or split. | Add filter chips (by split) and jump-to-date. |

---

## 5. Settings

| # | Pri | Issue | Upgrade |
|---|-----|-------|---------|
| 5.1 | P2 | "Reset to Day 1" (destructive) sits inline with normal rows, styled only by red text. | Add a confirmation step and visually separate destructive actions. |
| 5.2 | P2 | Rest presets are fixed (60/90/120/180). | Allow a custom value; per-exercise rest override. |
| 5.3 | P3 | No import counterpart shown next to Export data. | Surface Import/restore next to Export for backup symmetry. |

---

## 6. Session (read-only)

| # | Pri | Issue | Upgrade |
|---|-----|-------|---------|
| 6.1 | P2 | Identical density to History with no summary. | Add a session header stat row: total volume, sets, PR count, duration. |
| 6.2 | P2 | Notes ("Good reps 0RIR", "L", "Assist") float without labels. | Prefix as "Note:" or move into a tag system so free-text vs. structured tags are distinct. |
| 6.3 | P3 | No edit/share affordance. | Add edit + share-as-image from a session. |

---

## 7. Active workout (logging)

| # | Pri | Issue | Upgrade |
|---|-----|-------|---------|
| 7.1 | **P1** | The `✕` close is tiny and top-left, overlapping the carousel — accidental-exit risk during a live session (there's already a fix branch for this). | Move close into a safe zone; keep the existing "confirm exit during active session" guard. |
| 7.2 | **P1** | Screen is mostly empty until you tap **Set**; "Last time" is the only context. | Show target/suggested next set (progressive overload hint) and an inline quick-add so logging is one tap. |
| 7.3 | P2 | "0 sets" with lime `0` is ambiguous (looks like a bug vs. intentional). | Use "No sets yet — tap Set to log your first." empty prompt. |
| 7.4 | P2 | Rest timer (configured in Settings) isn't visible on this screen. | Surface the countdown here after each logged set. |
| 7.5 | P3 | "Substitute" and carousel arrows compete for attention. | Consolidate exercise-switching into the carousel; make Substitute a secondary action in an overflow. |

---

## Suggested prototyping order

1. **P1 nav cleanup** (0.1, 0.2) — quick, high signal.
2. **Active-workout logging flow** (7.1, 7.2, 7.3) — core loop, highest usage.
3. **History readability** (4.1, 4.2) — biggest comprehension win.
4. **Progress chart scaling** (3.1) — makes the feature actually useful.
5. Everything else as polish.
