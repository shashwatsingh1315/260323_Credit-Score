# Aura Design System & Style Guidelines

## 1. Core Philosophy
- **Premium Aesthetic**: We aim for a high-end, clean, and uniform UI inspired by modern SaaS and financial products (e.g. Linear, Stripe, Uber).
- **Dark Theme First**: The primary interface is dark-mode (`<html class="dark">`).
- **Semantic Tokens**: We strictly use semantic tokens defined in Tailwind CSS configuration and `globals.css` via CSS variables. Never use arbitrary values like `w-[15px]` or `#fff`.
- **Consistency**: Unified typography, deliberate spacing, and structured elevation.

## 2. Token Definitions (Global Scales)

### Colors
Defined in `src/app/globals.css` and `tailwind.config.js`. Use the HSL values implicitly via Tailwind classes.

- **Backgrounds**:
  - `bg-background`: The main app background.
  - `bg-card`: Surface background for distinct blocks (panels, cards).
  - `bg-popover`: Elevated background for dropdowns and tooltips.
  - `bg-muted`: Secondary or slightly recessed background.

- **Text**:
  - `text-foreground`: Primary legible text.
  - `text-muted-foreground`: Secondary text, placeholders, metadata.
  - `text-primary-foreground` / `text-secondary-foreground`: Text sitting on top of primary or secondary brand colors.

- **Borders & Inputs**:
  - `border-border`: The universal subtle border color.
  - `border-input`: Borders for text fields and interactive form elements.

- **Brand & Action**:
  - `bg-primary`: The primary action color.
  - `bg-secondary`: The secondary action color.
  - `bg-destructive`: High-contrast destructive action color.
  - *Status Tokens*: `bg-success`, `bg-warning`, `bg-info`, `bg-attention`, `bg-brand` (used with their respective `*-foreground` tokens).

### Typography
- **Font Family**: Inter (`font-sans`), established via Next.js `next/font/google`.
- **Scale**: Stick to standard Tailwind scales (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, etc.).
- **Weights**: `font-normal` for body text, `font-medium` for buttons/labels, `font-semibold` for headings.
- **Tiny Text**: For exceptionally small, but readable text, use `text-tiny` (defined as 10px in the Tailwind config).

### Spacing & Sizing
- **Strict Grid System**: Always use the 4px base scale.
  - Small gaps/paddings: `p-1`, `p-2`, `gap-2`
  - Standard gaps/paddings: `p-4`, `p-6`, `gap-4`, `gap-6`
  - Large gaps/paddings: `p-8`, `p-12`, `gap-8`
- **Zero Magic Numbers**: Avoid `w-[200px]`, `h-[50px]`. Use `w-48`, `h-12`, etc.

### Elevation & Radii
- **Radii**:
  - `rounded-md`: Standard interactive elements (buttons, inputs).
  - `rounded-lg`: Standard cards and panels.
  - `rounded-xl` or larger: Elevated modals or high-level structural containers.
- **Shadows**:
  - `shadow-sm`: Cards and subtle elevation.
  - `shadow-md`: Dropdowns, popovers.
  - `shadow-lg`: Modals.

## 3. Implementation Rules

1. **Class Merging**: Always use the `cn` utility (from `@/lib/utils`) when dynamically joining Tailwind classes or resolving conflicts.
2. **Interactive States**: Use standard Tailwind pseudo-classes: `hover:bg-accent`, `focus:ring`, `disabled:opacity-50`, `disabled:pointer-events-none`. Do not write custom inline styles for these.
3. **No Legacy Hex Variables**: Do not use `--bg-primary`, `--text-primary`, `--border-color`. If found, refactor to `--background`, `--foreground`, `--border`.
4. **Icons**: Use Lucide React icons, sized consistently (e.g. `w-4 h-4` or `w-5 h-5`) with appropriate coloring (`text-muted-foreground` by default).
