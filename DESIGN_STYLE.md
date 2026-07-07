# Aura Design System & Style Guidelines

## 1. Principles
- **Elegance Through Rigorous Consistency:** A unified design system is invisible but deeply felt by the user.
- **Premium Baseline:** Rely on purposeful whitespace, crisp typography, and high-contrast intentional colors.
- **Tokenized Infrastructure:** Hardcoded styles are technical debt; design tokens are scalable assets.

## 2. Token Definitions

### Colors (Tailwind Variables)
- **Backgrounds:** `var(--background)`, `var(--card)`, `var(--muted)`
- **Text:** `var(--foreground)`, `var(--muted-foreground)`
- **Interactive/Action:** `var(--primary)`, `var(--accent)`, `var(--destructive)`
- **Borders:** `var(--border)`, `var(--input)`, `var(--ring)`

### Typography
- **Families:** Primary: `Inter`
- **Scales:**
  - Micro: `text-micro` (11px, line-height 16px)
  - Tiny: `text-tiny` (10px, line-height 14px)
  - Standard Tailwind scales: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, etc.

### Spacing & Sizing
- Strict adherence to Base-4 and Base-8 spacing (`w-4`, `p-6`, `gap-2`).
- No arbitrary values (e.g., `w-[200px]`, `p-[10px]`).
- For fixed structural dimensions that fall outside basic tokens, use fractions (`w-1/2`) or specific standardized rem units.

### Elevation & Radii
- Standard shadow utilities (`shadow-sm`, `shadow-md`, `shadow-xl`)
- Border radii tied to defined tokens (`rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`)

## 3. Component Standards
- Components must rely on semantic tokens.
- No inline style hardcoding for dimensions or colors.
- High accessibility/contrast ratios maintained across all backgrounds.
