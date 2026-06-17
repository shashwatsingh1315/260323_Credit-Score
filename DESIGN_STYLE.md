# Aura Design Style System
## High-End Baseline

This document outlines the high-end baseline for the application's design system. The goal is to establish a premium, clean, high-contrast, and scalable aesthetic, similar to world-class products.

### 1. Typography Scales
- **Display**: Reserved for main marketing headers. (`font-display`)
- **Heading**: H1-H6 headers. Standardized spacing around headers.
- **Body**: Main paragraph text.
- **Tiny**: 10px text, used sparingly for very minor metadata (`text-tiny`).
- **Micro**: 11px text, used for tags, pills, or minor structural text (`text-micro`).

### 2. Spacing Scales (Base-4/Base-8)
We strictly adhere to a 4px/8px rhythm. Avoid all magic pixel values (e.g., no `mt-[13px]`, `w-[50px]`).
- `0.5`: 2px
- `1`: 4px
- `2`: 8px
- `3`: 12px
- `4`: 16px
- ...and so on.

### 3. Color Tokens
All colors must use semantic CSS variables mapped to HSL tokens.
- **Surface**: `bg-background`, `bg-card`, `bg-muted`
- **Text**: `text-foreground`, `text-muted-foreground`
- **Action**: `bg-primary`, `bg-secondary`
- **Border**: `border-border`
- **Feedback**: `bg-destructive`, `text-success`

### 4. Elevation and Radii
- **Radii**: Tokenized via `--radius` (`rounded-lg`, `rounded-md`, `rounded-sm`).
- **Shadows**: Tokenized elevation for depth (`shadow-sm`, `shadow-md`).

### AURA Core Principle
Hardcoded styles are technical debt; design tokens are scalable assets. True elegance comes from rigorous consistency.
