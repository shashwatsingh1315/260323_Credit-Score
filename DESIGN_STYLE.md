# Aura Design System - Token Foundation

## 1. The Strategy
The UI is transitioning from arbitrary hex codes and magic numbers to a strict token-based architecture. This ensures a uniform, predictable, and premium aesthetic (similar to Linear or Vercel). We strictly use Tailwind HSL variables for color to gracefully handle dark mode and consistent theming.

## 2. Global Colors
We map all previous hardcoded hex colors to semantic Tailwind tokens:

### Surfaces
- `--background`: The primary app background.
- `--card`: Surface background for containers, cards, and modal windows.
- `--muted`: Subtle backgrounds (e.g., table headers, disabled states, hover states).

### Text
- `--foreground`: Primary high-contrast text.
- `--muted-foreground`: Secondary/tertiary text for metadata or disabled elements.

### Borders
- `--border`: Universal border color for all standard components.

### Accents / Semantic
- `--accent`: Interactive hover states or soft highlights.
- `--destructive`: Red token for delete/error actions.
- `--color-success`: Green token for success states.
- `--color-warning`: Yellow/Orange token for warnings.

## 3. Typography
- **Font Stack**: Inter (sans-serif) as primary.
- **Scale**: Strict usage of Tailwind text sizes (`text-xs`, `text-sm`, `text-base`, `text-lg`, etc.). Avoid arbitrary sizes like `text-[13px]`. We added `text-tiny` (`10px`/`14px`) to `tailwind.config.js` for micro-copy.

## 4. Spacing & Layout
- Strictly base-4 spacing scale (4px = `1`, 8px = `2`, 16px = `4`, etc.).
- Avoid magic numbers (`mt-[17px]`).
- Flex and Grid layouts must use standard `gap` tokens (`gap-2`, `gap-4`).

## 5. Interaction
- Interactive elements must use `transition-colors`, `transition-opacity`, or `transition-transform` with predictable durations.
- Avoid using JS-based style injection or `rgba()` opacities directly in components where possible.
