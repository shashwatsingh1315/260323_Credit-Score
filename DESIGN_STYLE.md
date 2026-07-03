# Aura Design System & Style Guide ✨

This document serves as the absolute source of truth for the application's aesthetic and styling baseline. We adhere to a premium, high-contrast, scalable design language, inspired by the rigorous consistency of industry leaders (e.g., Apple, Linear, Vercel).

## Core Principles
1. **Rigorous Consistency:** True elegance stems from strict adherence to tokenized scales.
2. **High Contrast:** Colors must have intentional contrast, avoiding "muddy" mid-tones.
3. **Purposeful Whitespace:** Layouts breathe through standardized base-4/base-8 rhythm.
4. **No Magic Numbers:** Arbitrary CSS brackets (e.g., `w-[200px]`, `px-[17px]`) are technical debt and strictly forbidden.
5. **Token-Driven:** Every color, spacing, typography, and layout decision relies on an underlying design token.

## 1. Color Tokens (Semantic & Themeable)
The app uses HSL-based CSS variables applied via Tailwind to support scalable theming (Light/Dark).

- **Backgrounds:** `bg-background`, `bg-card`, `bg-popover`
- **Surfaces:** `bg-muted` (tertiary areas, subtle fills)
- **Text:** `text-foreground` (primary), `text-muted-foreground` (secondary)
- **Borders:** `border-border`, `border-input`
- **Actions:** `bg-primary` (solid actions), `bg-secondary` (secondary actions), `bg-accent` (hover states)
- **States:** `bg-destructive` (danger/error), `bg-success`, `bg-warning`, `bg-info`
- **Focus Rings:** `focus-visible:ring-1 focus-visible:ring-ring` (elegant, uniform outline)

*Rule:* Never hardcode hex colors (e.g., `#FFF`, `#141414`) in component files. Always use the mapped Tailwind classes (e.g., `bg-card`, `text-primary`).

## 2. Spacing & Rhythm (The Grid)
We use a strict 4px / 8px baseline scale. The Tailwind default spacing scale maps perfectly to this.

- **Micro:** `gap-1` (4px), `gap-2` (8px)
- **Small:** `p-3` (12px), `p-4` (16px)
- **Medium:** `p-6` (24px), `p-8` (32px)
- **Large:** `p-12` (48px)

*Rule:* Never use arbitrary spacing or sizing classes like `mt-[13px]`, `w-[200px]`, `h-[50vh]`. If a specific size is needed, adjust the layout flex/grid structure or use fractional tokens (e.g., `w-1/2`).

## 3. Typography Hierarchy
Typography is controlled via Tailwind's text tokens.

- **Micro/Tiny:** `text-micro`, `text-tiny` (10px - 11px structural text)
- **Small:** `text-xs`, `text-sm` (dense UI, tables, badges)
- **Body:** `text-base` (default reading text)
- **Headings:** `text-lg`, `text-xl`, `text-2xl` etc.
- **Font:** `font-sans` (Inter/System stack)

*Rule:* Never use arbitrary font sizing like `text-[10px]` or `text-[14px]`. Rely on semantic sizing tokens.

## 4. Radii & Borders
Corners are rounded systematically based on the element's size.

- **Small elements (badges, inputs):** `rounded-md`, `rounded-sm`
- **Standard elements (buttons, cards):** `rounded-lg`
- **Containers/Modals:** `rounded-xl`
- **Full rounding:** `rounded-full` (pills, avatars)

*Rule:* Always apply a `border border-border` to cards and distinct surface areas to ensure crisp edges in high-contrast environments (especially dark mode).

## 5. Interactions & States
Interactive elements must have clear, immediate feedback without heavy animations.

- **Hover:** Use `hover:bg-accent` or `hover:opacity-90`.
- **Active (Click):** Use `active:scale-[.98]` sparingly for main buttons to provide tactile feedback.
- **Focus:** Use Tailwind's `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring` for a consistent, accessible ring.
- **Transitions:** Keep them snappy `transition-all` or `transition-colors`. Avoid long durations.

## 6. Shadows & Elevation
Elevation is conveyed through subtle shadows.

- **Low (Cards):** `shadow-sm`
- **Medium (Dropdowns, Popovers):** `shadow-md`
- **High (Modals):** `shadow-xl`

## Component Guidelines
- **Buttons:** Consolidate to variants using the tokens (e.g., Primary: `bg-primary text-primary-foreground`, Secondary: `bg-secondary text-secondary-foreground border border-border`).
- **Inputs:** Clean borders (`border-input`), transparent backgrounds (`bg-transparent` or `bg-background`), and clear focus rings.
- **Badges:** Use the established semantic colors (e.g., success, warning, destructive) with a low opacity background and solid text.
