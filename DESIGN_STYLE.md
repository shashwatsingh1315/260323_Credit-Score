# Aura Design System & Style Guide

## 1. Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user. Our goal is a premium, high-contrast, intentionally scaled aesthetic built entirely on design tokens. Hardcoded styles and magic numbers are strictly forbidden.

## 2. Design Tokens

### Colors
We use a semantic HSL-based scale.
- **Background**: `hsl(var(--background))`
- **Surface/Card**: `hsl(var(--card))`
- **Foreground (Text)**: `hsl(var(--foreground))`
- **Primary Action**: `hsl(var(--primary))`
- **Secondary Action**: `hsl(var(--secondary))`
- **Muted**: `hsl(var(--muted))`
- **Borders**: `hsl(var(--border))`

### Typography
- **Display/Headings**: Inter, tracking-tight, font-semibold or font-bold.
- **Body**: Inter, sans-serif.

### Spacing (Base-4 scale)
- Strict 4px (0.25rem) increments.
- Typical tokens: `p-2` (8px), `p-4` (16px), `p-6` (24px), `gap-2`, `gap-4`.

### Radii
- **lg**: `var(--radius)` (12px)
- **md**: `calc(var(--radius) - 2px)` (10px)
- **sm**: `calc(var(--radius) - 4px)` (8px)

### Elevation & Shadows
- Use systematic shadow tokens (e.g., `shadow-sm`, `shadow-md`, `shadow-lg`) instead of custom rgba box-shadows.

## 3. Interactive States
- **Hover**: Semantic hover modifiers (e.g., `hover:bg-accent`, `hover:opacity-90`).
- **Focus**: Uniform focus rings (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`).
- **Disabled**: `disabled:opacity-50 disabled:pointer-events-none`.
