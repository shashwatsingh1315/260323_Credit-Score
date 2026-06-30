# High-End Design Style Document

## Overview
This document outlines the target aesthetic (Premium, clean, high-contrast, scalable) and the token scales used to maintain a consistent design system.

## Design Principles
- **Rigorous Consistency:** True elegance comes from a unified design system.
- **Premium Design:** Relies on purposeful whitespace, crisp typography, and high-contrast intentional colors.
- **Tokenized Infrastructure:** Hardcoded styles are technical debt. Everything must be based on standard tokens.

## Token Scales

### Colors (HSL Tokens)
- **Backgrounds:** `hsl(var(--background))`, `hsl(var(--card))`, `hsl(var(--popover))`
- **Surfaces/Muted:** `hsl(var(--muted))`, `hsl(var(--secondary))`
- **Text:** `hsl(var(--foreground))`, `hsl(var(--muted-foreground))`
- **Action (Primary):** `hsl(var(--primary))`, `hsl(var(--primary-foreground))`
- **Border:** `hsl(var(--border))`, `hsl(var(--input))`
- **Semantic/Status:** `hsl(var(--destructive))`, `hsl(var(--color-success))`, `hsl(var(--color-warning))`, `hsl(var(--color-info))`

*Note: Legacy hex variables (e.g. `--bg-primary`, `--text-primary`) are mapped to the HSL tokens.*

### Typography
- **Families:** Inter (sans) as the standard, system-ui fallback.
- **Sizes (Standard Tailwind scale):** `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, etc.
- **Micro/Tiny Typography (Custom):** `text-tiny` (10px/14px) and `text-micro` (11px/16px) for minor structural text. Avoid arbitrary brackets (`text-[10px]`).

### Spacing & Layout
- **Rhythm:** Strict base-4 and base-8 scale spacing (`p-4`, `m-2`, `gap-6`).
- **Sizing:** Use standard tokens (`w-48`, `h-96`, `w-px`). **Do not use arbitrary magic numbers** (e.g., `w-[200px]`, `h-[120px]`).

### Elevation/Shadows
- **Shadows:** Standardized shadow utilities (`shadow-sm`, `shadow-md`, `shadow-lg`) for uniform elevation.

### Radii
- **Border Radius:** `rounded-sm`, `rounded-md`, `rounded-lg` utilizing the global `--radius` variable.

## Best Practices
- Never use magic numbers for margins, paddings, width, or height.
- Do not hardcode colors in components.
- Ensure high contrast and accessibility for all UI elements.
