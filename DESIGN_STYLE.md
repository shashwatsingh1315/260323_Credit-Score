# High-End Design Style Document

## Core Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user. Premium design relies on purposeful whitespace, crisp typography, and high-contrast intentional colors.

## Design Tokens

### Colors
- **Background:** `bg-background` (hsl(var(--background)))
- **Surface/Card:** `bg-card` (hsl(var(--card)))
- **Text:**
  - Primary: `text-foreground` (hsl(var(--foreground)))
  - Muted: `text-muted-foreground` (hsl(var(--muted-foreground)))
- **Action:**
  - Primary: `bg-primary`, `text-primary-foreground`
  - Secondary/Muted: `bg-muted`, `text-muted-foreground`
- **Border:** `border-border` (hsl(var(--border)))
- **Status Colors:**
  - Success: `text-success` (hsl(var(--color-success)))
  - Warning: `text-warning` (hsl(var(--color-warning)))
  - Destructive: `text-destructive` (hsl(var(--destructive)))
  - Info: `text-info` (hsl(var(--color-info)))
  - Attention: `text-attention` (hsl(var(--color-attention)))

### Typography
- **Font Family:** Inter (var(--font-inter))
- **Sizes:** Use standard Tailwind text scales (`text-xs`, `text-sm`, `text-base`, `text-lg`, etc.).
- **Micro Typography:** Use `text-tiny` for the smallest allowed text (10px size / 14px line-height) instead of magic numbers like `text-[10px]`.

### Spacing & Layout
- Use strict 4px/8px rhythm.
- Stick to standard Tailwind spacing tokens (`p-2`, `m-4`, `gap-3`).
- Avoid arbitrary spacing like `px-[17px]` or `mt-[13px]`.

### Elevation & Radii
- Use standard Tailwind shadow tokens (`shadow-sm`, `shadow-md`).
- Use standard Tailwind border radius tokens (`rounded-md`, `rounded-lg`, `rounded-xl`).

## Guidelines
1. **No Magic Numbers:** Replace `text-[10px]` with `text-tiny`. Replace arbitrary paddings with standard tokens.
2. **No Hardcoded Hex Colors:** Replace `#FFF` or `#141414` with semantic color tokens.
3. **No Legacy Classes:** Use structural UI components from `shadcn/ui` instead of legacy utility classes when possible, or ensure legacy classes map to standard tokens.
