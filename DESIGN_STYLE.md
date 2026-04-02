# CreditFlow Design Style Document

## Core Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user. Premium design relies on purposeful whitespace, crisp typography, and high-contrast intentional colors. Hardcoded styles are technical debt; design tokens are scalable assets.

## Token Scales

### Colors
We use strict semantic tokens based on HSL, supporting robust dark/light themes.

- **Background:** `--background` (`bg-background`)
- **Surface/Card:** `--card`, `--popover` (`bg-card`, `bg-popover`)
- **Text:** `--foreground`, `--muted-foreground` (`text-foreground`, `text-muted-foreground`)
- **Action/Primary:** `--primary` (`bg-primary`, `text-primary-foreground`)
- **Action/Secondary:** `--secondary` (`bg-secondary`, `text-secondary-foreground`)
- **Border:** `--border` (`border-border`)

#### Status Colors
Strict usage for status items (badges, highlights, etc.):
- **Success:** `--color-success` (`text-success`, `bg-success/10` for subtle backgrounds)
- **Warning:** `--color-warning` (`text-warning`, `bg-warning/10`)
- **Destructive/Error:** `--destructive` (`text-destructive`, `bg-destructive/10`)
- **Info:** `--color-info` (`text-info`, `bg-info/10`)

### Typography
Consistent font hierarchy. Font family: Inter (sans-serif).

- **Display:** `text-3xl`, `font-bold`
- **Heading 1:** `text-2xl`, `font-bold`
- **Heading 2:** `text-base`, `font-semibold`
- **Body:** `text-sm`, `font-normal`
- **Caption/Detail:** `text-xs`, `text-muted-foreground`

### Spacing (Base-4 Scale)
Adhere to Tailwind's default spacing scale (`4px` intervals):
- `p-2` (8px), `p-3` (12px), `p-4` (16px), `p-5` (20px), `p-6` (24px)
- `gap-2` (8px), `gap-3` (12px), `gap-4` (16px)

### Radii
Standardized border radii values:
- **Card/Container:** `--radius` (`rounded-xl` or `rounded-lg`)
- **Button/Input:** `calc(var(--radius) - 2px)` (`rounded-md`)
- **Badge/Small:** `calc(var(--radius) - 4px)` (`rounded-sm` or `rounded-full`)

## UX Boundaries
- **Always:** Use design tokens. Rely on `class-variance-authority` (CVA) for standardized component variants.
- **Never:** Use arbitrary magic numbers (`mt-[13px]`) or hardcoded hex colors (`bg-[#141414]`). Avoid inline styles unless strictly necessary for dynamic dynamic widths/heights calculated via JS.
