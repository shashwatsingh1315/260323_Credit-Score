# Aura Design System & UX Baseline

## Core Philosophy
True elegance comes from rigorous consistency. This design system establishes a high-end, premium aesthetic inspired by clean, uniform interfaces (e.g., Apple, Linear, Uber). We rely on:
- **Purposeful whitespace**
- **Crisp typography**
- **High-contrast, intentional colors**
- **Unified structural rhythm**

## Token Scales

### 1. Colors (HSL variables mapped in `globals.css` and `tailwind.config.js`)
- **Backgrounds**: `--background`, `--card`, `--popover`, `--secondary`, `--muted`, `--accent`
- **Text**: `--foreground`, `--primary-foreground`, `--secondary-foreground`, `--muted-foreground`
- **Actions**: `--primary`, `--secondary`, `--destructive`
- **Borders/Interactive**: `--border`, `--input`, `--ring`
- **Semantic Status**: `--color-success`, `--color-warning`, `--color-destructive`, `--color-info`, `--color-attention`, `--color-brand`

*Note: The application primarily forces a dark theme (`<html class="dark">`). Legacy hex variables (e.g., `--bg-primary`, `--bg-tertiary`) should be deprecated in favor of semantic HSL tokens where applicable, but we maintain backward compatibility for unmigrated components.*

### 2. Typography
- **Font Stack**: Inter (`var(--font-inter)`), fallback to system-ui.
- **Sizes**: Defined via standard Tailwind text scales (`text-xs` to `text-6xl`), plus a custom `text-tiny` (`10px`).

### 3. Spacing Rhythm
- Strict Base-4/Base-8 scale utilizing standard Tailwind spacing (`p-2`, `m-4`, `gap-6`, etc.).
- Arbitrary "magic number" spacings (e.g., `w-[200px]`, `h-[50vh]`) should be eliminated and replaced with robust flex/grid layouts or token-based sizing (e.g., `w-48`, `max-w-xs`, `h-full`, `min-h-screen`).

### 4. Radii & Squircles
- **Base Radius**: `--radius` (`0.75rem` / 12px)
- **Scale**: `rounded-lg` (`var(--radius)`), `rounded-md` (radius - 2px), `rounded-sm` (radius - 4px).

### 5. Interactive States & Elevation
- **Hover/Active**: Semantic transition opacities/scales (e.g., `hover:opacity-90 active:scale-[.98]`).
- **Focus Rings**: Standardized using `focus-visible:ring-1 focus-visible:ring-ring`.

## Cleanup Directives
1. Remove arbitrary values like `w-[200px]`, `max-w-[150px]`, `h-[50vh]` across the app.
2. Standardize layout alignments using Tailwind flex/grid utility classes.
3. Replace hardcoded inline colors (e.g., `text-[#333]`) with design tokens.
