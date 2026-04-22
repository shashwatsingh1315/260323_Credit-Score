# High-End Design Style Document

## Core Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user. Premium design relies on purposeful whitespace, crisp typography, and high-contrast intentional colors. Hardcoded styles are technical debt; design tokens are scalable assets.

## The Standard (Dark Theme Primarily)

### Colors (HSL based with `<alpha-value>` support)
- **Background**: Deep, structured base `hsl(240 10% 4%)`.
- **Foreground**: High contrast text `hsl(0 0% 98%)`.
- **Card**: Slightly elevated surface `hsl(240 10% 6%)`.
- **Card Foreground**: `hsl(0 0% 98%)`.
- **Popover**: Same as card `hsl(240 10% 6%)`.
- **Primary Action**: Crisp white/accent `hsl(0 0% 98%)`, text is dark `hsl(240 5.9% 10%)`.
- **Secondary Action**: Muted interaction `hsl(240 4% 16%)`.
- **Muted**: `hsl(240 4% 16%)` with `hsl(240 5% 65%)` text.
- **Accents**: For interactions `hsl(240 4% 16%)`.
- **Borders & Rings**: Subtle outlines `hsl(240 4% 16%)` and focus rings `hsl(240 5% 65%)`.
- **Status (Success/Warning/Error/Info)**: Standardized semantic scales.

### Typography
- **Font Stack**: Primary: Inter (`var(--font-inter)`).
- **Scale**:
  - `text-tiny`: 10px / 14px line height.
  - `text-xs`: 12px
  - `text-sm`: 14px
  - `text-base`: 16px
  - `text-lg`: 18px
  - `text-xl` ...

### Spacing & Sizing
- Strict Base-4/Base-8 rhythm.
- Disallow arbitrary bracket values (e.g. `w-[200px]`, `px-[17px]`).
- Allowed classes: `p-2`, `p-4`, `px-6`, `py-3`, `gap-2`, `gap-4`.

### Radii
- Continuous curves ('squircles') pattern.
- Radius scale: `md` `calc(var(--radius) - 2px)`, `lg` `var(--radius)`, `xl` `calc(var(--radius) + 4px)`.
- Base radius: `0.75rem` (12px).

### Shadows / Elevations
- High-quality, multi-stop elevations rather than basic flat shadows.

## Boundaries & Rules
1. Never use magic numbers for spacing/sizing.
2. Never hardcode colors in components.
3. Keep animations snappy and lightweight.
4. Replace legacy CSS hex variables with semantic tokens.
