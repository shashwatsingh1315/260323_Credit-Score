# Aura Design System (CreditFlow)

## 1. Core Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user.

- **Tokens over hex codes:** All colors, spacing, and typography must use standardized variables or Tailwind classes. No magic numbers or hardcoded values.
- **Premium, clean, high-contrast:** A dark-first aesthetic matching high-end products (Uber, Linear, Apple). Crisp text on deep backgrounds.
- **Predictable spacing:** Strict adherence to a base-4 (or base-8) scaling system.

## 2. Global Tokens

### Colors (HSL-based, Dark Theme First)
The system uses `hsl(var(--token))` variables mapped in `tailwind.config.js`.

**Foundation**
- `background`: The deep primary canvas.
- `card` / `popover`: Elevated surfaces.
- `foreground`: Primary text color (high contrast).

**Accents & Interactivity**
- `primary`: Main brand/action color.
- `secondary`: Subdued action color.
- `muted`: Disabled or low-priority areas.
- `border` / `input`: Standard element borders.

*Legacy hex codes (e.g., `--bg-primary`, `--text-secondary`) are deprecated and being phased out.*

### Typography
- **Sans-serif stack:** Primary interface text uses Inter (or system sans-serif fallback).
- Sizes follow Tailwind defaults (`text-sm`, `text-base`, `text-lg`), with a custom `text-tiny` (`10px`).

### Radii & Elevation
- **Radius:** Standardized around `var(--radius)` (e.g., `rounded-lg`, `rounded-md`).
- **Shadows:** Kept subtle for dark mode, relying mostly on borders and surface color differentiation.

## 3. Implementation Rules

1. **CSS Modules:** Any `*.module.css` file must use the standard CSS custom properties for HSL (e.g., `hsl(var(--background))`) instead of deprecated hex properties like `var(--bg-primary)`.
2. **Tailwind Utility Classes:** Prefer standard classes like `bg-background`, `text-foreground`, `border-border` over custom CSS rules.
3. **Dropdowns & Inputs in Dark Mode:** Elements should specify `color-scheme: dark;` to ensure native rendering aligns with the dark theme.

## 4. Aura Checklist
- [ ] No `var(--bg-*)`, `var(--text-*)`, or `var(--border-*)` legacy variables.
- [ ] No `[]` arbitrary Tailwind values for spacing (e.g., `w-[15px]`).
- [ ] All interactive elements have visible `hover` and `focus` (ring) states.
