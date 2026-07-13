# Design System & Token Guidelines

## The Aura Philosophy
- **True elegance comes from rigorous consistency.**
- A unified design system is invisible but deeply felt by the user.
- Premium design relies on purposeful whitespace, crisp typography, and high-contrast intentional colors.
- Hardcoded styles are technical debt; design tokens are scalable assets.

## The Standard

### 1. Typography
- **Font Stack:** Inter (Sans Serif), Monospace for data.
- **Sizes:** Use standard Tailwind typography tokens. Use `text-tiny` (`10px`/`14px`) and `text-micro` (`11px`/`16px`) for structural text.

### 2. Spacing
- **Base Rhythm:** Follow the 4px/8px Tailwind scale (e.g., `p-4` is `16px`, `gap-2` is `8px`).
- **Do not use** magic bracket values (`mt-[13px]`).

### 3. Colors (Tokens vs Legacy)
All legacy CSS variables have been mapped to our standard design tokens:

- `--bg-primary` ➔ `hsl(var(--background))`
- `--bg-secondary` ➔ `hsl(var(--card))`
- `--bg-tertiary` ➔ `hsl(var(--muted))`
- `--text-primary` ➔ `hsl(var(--foreground))`
- `--text-secondary` ➔ `hsl(var(--muted-foreground))`
- `--text-muted` ➔ `hsl(var(--muted-foreground))`
- `--border-primary` ➔ `hsl(var(--border))`
- `--border-color` ➔ `hsl(var(--border))`
- `--danger` ➔ `hsl(var(--destructive))`
- `--accent-primary` ➔ `hsl(var(--accent))`
- `--accent-hover` ➔ `hsl(var(--accent))`

*Note: Never hardcode hex colors in components.*

### 4. Layout
- Use Flexbox or Grid for structural layouts.
- Utilize standard gap sizes (`gap-4`, `gap-8`).

### 5. Best Practices
- Consolidate legacy classes into robust standard components.
- Ensure focus rings are accessible and visually uniform across interactive elements.
- Validate layouts on both structural integrity and visual rhythm.
