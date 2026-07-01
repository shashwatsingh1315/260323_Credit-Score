# Design Style Document (Aura)

This document serves as the strict source of truth for the project's design tokens and aesthetic guidelines. It outlines overarching rules for styling standards to ensure uniformity and prevent technical debt like 'magic numbers'.

## The Aesthetic Vision
- **Premium:** Clean, high-contrast, intentional design inspired by top-tier modern applications (e.g., Apple, Linear).
- **Consistent:** Strict adherence to design tokens. No arbitrary exceptions.
- **Accessible:** Semantic color usage and clear typography hierarchy.

## Core Directives

### 1. Magic Numbers are Banned
Never use arbitrary bracket notation for sizing, spacing, or positioning unless absolutely mathematically necessary (e.g., dynamic grid calculations).
- **❌ BAD:** `w-[200px]`, `h-[50vh]`, `p-[17px]`, `left-[50%]`
- **✅ GOOD:** `w-48`, `min-h-96`, `p-4`, `left-1/2`

### 2. Spacing & Sizing Scale
Strictly utilize the standard Tailwind Base-4 / Base-8 rhythm.
- `0.5` = 2px
- `1` = 4px
- `2` = 8px
- `3` = 12px
- `4` = 16px
- `8` = 32px
- `12` = 48px
- `16` = 64px
- `24` = 96px
- `32` = 128px
- `48` = 192px
- `64` = 256px
- `96` = 384px

For 1px borders or dividers, use `px`.

### 3. Typography
Use the established design tokens for typography.
- Standard sizes: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, etc.
- Custom defined tiny sizes (defined in tailwind config): `text-tiny`, `text-micro`.
- Never use: `text-[11px]` or similar.

### 4. Color and Theming
Colors must always use semantic CSS variable references mapped via the Tailwind config. Never hardcode hex codes or RGB values in components.
- **Backgrounds:** `bg-background`, `bg-card`, `bg-muted`
- **Text:** `text-foreground`, `text-muted-foreground`
- **Borders:** `border-border`, `border-input`

### 5. Layout and Structure
Prefer `flex` or `grid` with standard `gap-*` tokens. Avoid arbitrary margins for structure where a parent container can handle spacing via gaps.

*These rules ensure our application remains scalable, predictable, and visually pristine.*