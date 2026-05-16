# Aura Design System: High-End Styling Standards

## Core Philosophy
- **Premium aesthetic**: Clean, uniform, high-contrast, scalable design (inspired by Uber, Linear, Apple).
- **Strict Token Usage**: No magic numbers (`mt-[13px]`) or hardcoded hex colors (`bg-[#141414]`).
- **Consistency**: A unified design system relies on purposeful whitespace, crisp typography, and intentional colors.

## Token Specifications

### 1. Colors (Tailwind Variables based on HSL)
- `background`, `foreground`
- `card`, `card-foreground`
- `popover`, `popover-foreground`
- `primary`, `primary-foreground`
- `secondary`, `secondary-foreground`
- `muted`, `muted-foreground`
- `accent`, `accent-foreground`
- `destructive`, `destructive-foreground`
- `border`, `input`, `ring`
- `success`, `warning`, `info`, `attention`, `brand`

### 2. Typography
- **Font Family**: Inter (sans-serif default).
- **Scale**: Use standard tailwind classes (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, etc.). Use `text-tiny` (`10px`/`14px`) instead of arbitrary sizes.

### 3. Spacing & Sizing
- **Strict Base-4/Base-8 rhythm**: Use standard Tailwind spacing (e.g., `p-4`, `m-2`, `gap-3`, `w-48`).
- **No arbitrary values**: Avoid `w-[200px]`, `h-[50vh]`.

### 4. Radii & Elevation
- **Radii**: Use tokens (`rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full`).
- **Shadows/Elevation**: Use standard Tailwind shadows (`shadow-sm`, `shadow-md`, `shadow-lg`).

## Refactoring Guidelines
- Strip out hardcoded hex codes and magic numbers.
- Standardize focus rings, hover states, and disabled states.
- Follow the accessibility and contrast requirements.
- Use `cn` from `src/lib/utils.ts` for clean class merging.
