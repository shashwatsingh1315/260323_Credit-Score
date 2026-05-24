# Design Style Guide & Token Architecture

## Design Philosophy (Aura)
- **True elegance comes from rigorous consistency.**
- **A unified design system is invisible but deeply felt by the user.**
- **Premium design** relies on purposeful whitespace, crisp typography, and high-contrast intentional colors.
- **Hardcoded styles are technical debt;** design tokens are scalable assets.

## The Scales

### 1. Color System (HSL Tokens)
We use a global CSS variable system (`globals.css`) built on top of Tailwind's HSL notation.
- **Background**: `bg-background` (`hsl(var(--background))`)
- **Surface**: `bg-card` (`hsl(var(--card))`) and `bg-popover`
- **Text**: `text-foreground` (`hsl(var(--foreground))`)
- **Muted Text**: `text-muted-foreground` (`hsl(var(--muted-foreground))`)
- **Action/Primary**: `bg-primary text-primary-foreground`
- **Border**: `border-border` (`hsl(var(--border))`)

*Legacy Hex variables mapped to tokens:*
- `--bg-primary` -> `var(--background)`
- `--bg-secondary` -> `var(--card)`
- `--bg-tertiary` -> `var(--muted)`
- `--text-primary` -> `var(--foreground)`
- `--text-secondary` -> `var(--muted-foreground)`
- `--text-muted` -> `var(--muted-foreground)`
- `--border-primary` / `--border-color` -> `var(--border)`
- `--danger` -> `var(--destructive)`

### 2. Spacing System
Standard 4px/8px rhythm.
*Do not use arbitrary bracket notation (e.g. `w-[20px]`).*
- Scale: `p-1`, `p-2`, `p-4`, `p-6`, `p-8`

### 3. Typography Scale
We use standard standard inter sizing and have customized `tiny` in tailwind.
*Do not use arbitrary bracket notation (e.g. `text-[10px]`).*
- Scale: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, etc.
- Custom: `text-tiny` ('10px', '14px') should replace instances of `text-[10px]`.

### 4. Radii Scale
- Scale: `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full`

### 5. Elevation/Shadows
- Use: `shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`

## Coding Standards

### React Components
- Use `cn()` from `@/lib/utils` for composing class names safely.
- Avoid inline styles for standard layout positioning.
- Use explicit semantic layout variables.
