# High-End Design Style Document

## Core Philosophy
True elegance comes from rigorous consistency.
A unified design system is invisible but deeply felt by the user.
Premium design relies on purposeful whitespace, crisp typography, and high-contrast intentional colors.
Hardcoded styles are technical debt; design tokens are scalable assets.

## Token Scales

### Colors
We strictly use semantic tokens mapped to Tailwind HSL variables.

- **Backgrounds:**
  - `--background`: Base application background.
  - `--card`: Surface background for cards, modals, dropdowns.
  - `--muted`: Secondary surfaces or slight emphasis.

- **Text:**
  - `--foreground`: Primary high-contrast text.
  - `--muted-foreground`: Secondary text, metadata, labels.

- **Interactive / Actions:**
  - `--primary`: Main actions and primary emphasis.
  - `--secondary`: Alternate actions and secondary emphasis.
  - `--accent`: Subtle hover states.

- **Feedback & Status:**
  - `--destructive` / `--color-destructive`: Error, danger, delete actions.
  - `--color-success`: Success states.
  - `--color-warning`: Warnings and attention-needed states.
  - `--color-info`: Informational states.

- **Borders:**
  - `--border`: Standard structural borders.
  - `--input`: Form input borders.
  - `--ring`: Focus rings (highly visible, elegant).

*Note: Legacy hex colors (e.g., `--bg-primary`, `--danger`) are deprecated and being replaced by these standard HSL semantic tokens.*

### Typography
We use standard Tailwind typography scales with added micro-typography.

- **Family:** `Inter` (sans-serif)
- **Sizes:**
  - `text-micro` (11px / 16px) - For extremely dense data tables and subtle structural hints.
  - `text-tiny` (10px / 14px) - For the smallest UI metadata and badges.
  - standard Tailwind sizes (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, etc.)

### Spacing (Base-4/Base-8 Rhythms)
Strict adherence to the 4px grid. No arbitrary or magic numbers allowed.
- `0.5` = 2px
- `1` = 4px
- `1.5` = 6px
- `2` = 8px
- `3` = 12px
- `4` = 16px
- `6` = 24px
- `8` = 32px

### Radii
Standardized border-radius tokens based on `--radius`:
- `rounded-sm`: Minor internal elements.
- `rounded-md`: Standard inputs, small buttons.
- `rounded-lg`: Standard cards, modals, primary buttons.
- `rounded-xl`: Large container sections.

### Shadows & Elevation
Rely on standard shadcn/Tailwind shadows (`shadow-sm`, `shadow-md`, `shadow-lg`) tied to elevation.

## Implementation Guidelines
- **Always** use `tailwind.config.js` scales.
- **Never** use arbitrary brackets (e.g. `mt-[13px]`, `w-[200px]`, `text-[11px]`).
- **Never** hardcode hex colors (e.g. `bg-[#141414]`).
- Ensure high contrast ratios (minimum 4.5:1 for normal text).
