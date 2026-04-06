# Aura Design System Guidelines

This document outlines the high-end design token scales for colors, typography, spacing, elevation/shadows, and radii for the application.

## 1. Colors
Using HSL semantic tokens across the app.
- `--background`: Base page background.
- `--foreground`: Primary text color.
- `--card`: Card background.
- `--card-foreground`: Card text color.
- `--popover`: Popover/dropdown background.
- `--popover-foreground`: Popover text color.
- `--primary`: Primary brand color for main actions.
- `--primary-foreground`: Text color on primary background.
- `--secondary`: Secondary actions and subtle highlights.
- `--secondary-foreground`: Text color on secondary background.
- `--muted`: Subtle background for inactive/disabled/less-prominent items.
- `--muted-foreground`: De-emphasized text.
- `--accent`: Accent highlights.
- `--accent-foreground`: Text color on accent background.
- `--destructive`: Error/Danger actions.
- `--destructive-foreground`: Text color on destructive background.
- `--border`: Standard border color.
- `--input`: Input field borders.
- `--ring`: Focus ring color.

### Utility Colors
- `--color-success`: Positive actions/indicators.
- `--color-warning`: Warning indicators.
- `--color-info`: Informational highlights.
- `--color-attention`: Actions requiring attention.
- `--color-brand`: Additional brand colors.

## 2. Typography
- Display/Heading: Clean, stark sans-serif.
- Body text: High legibility, neutral sizing.
- Sizing scale: `tiny` (10px), `xs`, `sm`, `base`, `lg`, `xl`, `2xl`, etc.
- Standard line heights and exact font-weights.

## 3. Spacing Rhythm (Base-4/8 Scale)
- Space is implemented via Tailwind primitives (px-4, py-2, gap-4).
- 4px -> 1
- 8px -> 2
- 12px -> 3
- 16px -> 4
- 20px -> 5
- 24px -> 6
- 32px -> 8
- Replace all magic padding values (e.g., 22px, 13px) with proper scale equivalents.

## 4. Radii (Squircles)
- `rounded-sm`: 0.25rem (4px)
- `rounded-md`: 0.375rem (6px)
- `rounded-lg`: 0.5rem (8px)
- `rounded-xl`: 0.75rem (12px)
- `rounded-2xl`: 1rem (16px)

## 5. Elevation / Shadows
- Consistent use of `shadow-sm`, `shadow-md`, `shadow-lg` utilizing multi-stop elevations without hardcoded `rgba()` values.

## Refactor Strategy
1. **Analyze:** Check for `px-[number]` or hardcoded color values.
2. **Remove & Replace:** Replace with standard Tailwind `px-*`, `py-*`, `bg-muted`, etc.
3. **Verify:** Check visual consistency and that the spacing creates adequate white space hierarchy.
