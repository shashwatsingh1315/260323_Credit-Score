# Aura Design System & Style Guidelines

## Core Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user.

## Tokens

### Colors
Strictly adhere to the Tailwind semantic tokens (e.g., `--background`, `--primary`, `--muted`). Hardcoded hex codes or arbitrary `bg-[]` classes are strictly forbidden.

### Typography
- Display: `font-sans font-bold` with tight tracking.
- Body: `text-sm` or `text-base`
- Micro/Overline: `text-tiny uppercase tracking-widest font-bold` (Do not use `text-[10px]` or `text-[11px]`)

### Spacing & Layout
Strictly use standard Tailwind 4px/8px rhythm tokens (e.g., `p-4`, `gap-2`, `mt-6`). Do not use magic numbers like `mt-[13px]`.
