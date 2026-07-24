# CreditFlow Design System Baseline

This document dictates the structural token system required to ensure the application maintains a premium, cohesive, and scalable aesthetic.

## Typography
- The application uses `Inter` font.
- We rely on standard Tailwind typographic scales.
- Exceptions added to config: `text-tiny` (`['10px', '14px']`) and `text-micro` (`['11px', '16px']`).
- **Never use bracket notation** (e.g. `text-[10px]`, `text-[11px]`) for typography.

## Spacing & Sizing
- We follow a strict base-4 (4px) and base-8 (8px) token rhythm.
- Spacing classes (`p-4`, `m-2`, `gap-3`) represent multiples of 0.25rem (4px).
- **Never use bracket notation** for padding, margins, gaps, width, height unless absolutely critical (and even then, only for precise external container bounding, not routine UI).
- Sizes like `h-[26px]`, `w-[26px]`, `w-[200px]`, `min-h-[80px]` should be replaced by nearest equivalents: `h-6`, `w-6` (or `h-7`, `w-7`), `w-48` or `w-64`, `min-h-20`.

## Colors
- All colors must be tokenized via CSS custom properties mapped in Tailwind config.
- Hex codes (e.g. `bg-[#141414]`) are strictly forbidden. Use tokens like `bg-primary`, `text-muted-foreground`.

## Borders & Radii
- Use standard radii classes like `rounded-md`, `rounded-lg`, `rounded-full`.
- Border widths are strictly `border`, `border-2`, etc. Avoid `border-[1px]`.
- Border colors must use tokens (`border-border`, `border-primary`).
