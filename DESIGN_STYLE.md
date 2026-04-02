# DESIGN_STYLE.md

## Overview
This document outlines the core design tokens and guidelines for achieving a premium, highly refined standard (inspired by clean, uniform, and high-end design languages of companies like Uber, Linear, or Apple). True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user.

## Design Philosophy
*   **Structural Whitespace**: Treat empty space as an active, luxurious design element.
*   **Continuous Curve Radii**: Utilize "squircle" mathematics for all rounded corners.
*   **Immersive Bleed & Multi-Stop Elevations**: Extend hero imagery, and construct shadows using distinct layers.
*   **Chromatic Darkness**: Deeply saturated, cool-toned charcoals and midnight blues for dark modes.
*   **Typographic Contrast**: Pairing expressive headers with start geometric sans-serif for body copy.
*   **Haptic Visuals & Physics-Driven Easing**: Heavily damped spring physics and bounce.
*   **Invisible Scaffolding**: Align absolutely every element to a strict, invisible geometric grid.

## Design Tokens

### Color Palette (Chromatic Darkness & High-Contrast)
*   `--background`: `222 47% 11%` (Midnight Blue/Charcoal for dark mode depth).
*   `--foreground`: `210 40% 98%` (High contrast text on dark background).
*   `--card`: `222 47% 11%` (Surface colors blending into background or subtly distinct).
*   `--card-foreground`: `210 40% 98%`.
*   `--popover`: `222 47% 11%`.
*   `--popover-foreground`: `210 40% 98%`.
*   `--primary`: `210 40% 98%` (Inverted high contrast for primary actions).
*   `--primary-foreground`: `222 47% 11%`.
*   `--secondary`: `215.4 16.3% 46.9%` (Subtle grey for secondary).
*   `--secondary-foreground`: `210 40% 98%`.
*   `--muted`: `215.4 16.3% 46.9%`.
*   `--muted-foreground`: `210 40% 80%`.
*   `--accent`: `210 40% 96.1%`.
*   `--accent-foreground`: `222 47% 11%`.
*   `--destructive`: `0 84.2% 60.2%`.
*   `--destructive-foreground`: `210 40% 98%`.
*   `--border`: `215.4 16.3% 46.9%`.
*   `--input`: `215.4 16.3% 46.9%`.
*   `--ring`: `210 40% 98%`.

### Spacing & Grid (Invisible Scaffolding)
*   Base-4 / Base-8 rhythm.
*   `space-1`: 4px
*   `space-2`: 8px
*   `space-3`: 12px
*   `space-4`: 16px
*   `space-5`: 20px
*   `space-6`: 24px
*   `space-8`: 32px
*   `space-10`: 40px
*   `space-12`: 48px

### Typography
*   `font-sans`: 'Inter', system-ui, sans-serif
*   `font-display`: Ex: 'Inter Display' (expressive header font)
*   Fluid scaling preferred.

### Radii (Continuous Curve)
*   `--radius`: `0.75rem` (12px)
*   `--radius-md`: `0.5rem` (8px)
*   `--radius-sm`: `0.25rem` (4px)

### Shadows / Elevation (Multi-stop)
*   `shadow-sm`: Ultra-soft 1st layer.
*   `shadow-md`: 2-stop shadow.
*   `shadow-lg`: 4-stop soft shadow.
*   `shadow-xl`: 6-stop dimensional shadow.

## Implementation Guidelines
1.  **Refactor CSS**: Remove hardcoded variables (`--bg-primary: #f8fafc;`) from `globals.css` in favor of single source of truth semantic HSL tokens.
2.  **Tailwind Theme**: Extend `tailwind.config.js` to strictly map to semantic tokens.
3.  **Components**: Use only tokens (e.g. `bg-primary`, `text-muted-foreground`, `gap-4`). No `mt-[13px]`.
4.  **Aura's Journal**: Document critical conflicts or accessibility learnings.
