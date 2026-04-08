# 📐 Design System & UX Guidelines (Aura)

This document serves as the high-end design baseline for the Credit Issuance App, establishing a rigorous, token-based foundation for a premium, clean, high-contrast, scalable user interface inspired by world-class products.

## 🎯 The Aesthetic Vision

* **Premium & Clean:** Purposeful structural whitespace, uncluttered layouts.
* **High Contrast & Intentional Colors:** Deep darks, crisp whites, and muted secondary elements. Semantic colors over hardcoded hex codes.
* **Scalable & Uniform:** Strict reliance on base-4/8 scaling for spacing and unified typographies.
* **Continuous Flow:** "Squircle" (continuous curve radii) and physics-driven transition easing.

---

## 🎨 1. Design Tokens

### Colors

Colors are strictly semantic. All hex values are forbidden in component code. We utilize `hsl` and `hsla` with CSS variables to ensure dark mode scalability.

* **Backgrounds & Surfaces:**
  * `background`: `hsl(var(--background))` - App canvas.
  * `surface-primary` (Card): `hsl(var(--card))` - Primary floating elements.
  * `surface-secondary` (Popover): `hsl(var(--popover))` - Dropdowns, popovers.
  * `surface-muted`: `hsl(var(--muted))` - Disabled or subdued containers.
* **Text & Content:**
  * `text-primary`: `hsl(var(--foreground))` - Default text, headings.
  * `text-muted`: `hsl(var(--muted-foreground))` - Helper text, subtitles.
* **Interactive & Actions:**
  * `action-primary`: `hsl(var(--primary))`
  * `action-secondary`: `hsl(var(--secondary))`
  * `action-accent`: `hsl(var(--accent))`
* **Feedback & States:**
  * `success`: `hsl(var(--color-success))`
  * `warning`: `hsl(var(--color-warning))`
  * `error` / `destructive`: `hsl(var(--destructive))`
  * `info`: `hsl(var(--color-info))`
  * `attention`: `hsl(var(--color-attention))`
* **Borders & Dividers:**
  * `border-primary`: `hsl(var(--border))`
  * `input-border`: `hsl(var(--input))`
  * `ring-focus`: `hsl(var(--ring))`

**Alpha/Opacity (hsla):**
Instead of `rgba(255, 255, 255, 0.05)`, use `hsl(var(--foreground) / 0.05)` or `hsla(var(--foreground) / 0.05)` for semi-transparent elements to ensure consistency across light/dark modes.

### Typography

* **Font Family:** `var(--font-inter)` (Inter), system fallbacks.
* **Scales:**
  * `heading-1`: `1.875rem` (30px)
  * `heading-2`: `1.5rem` (24px)
  * `heading-3`: `1.25rem` (20px)
  * `body`: `0.875rem` (14px)
  * `tiny`: `0.6875rem` (11px)

### Spacing (Base-4 / Base-8)

Magic numbers (`mt-[13px]`) are forbidden. Use Tailwind's spacing scale (which maps to 4px increments):
* `spacing-1` = `0.25rem` = `4px`
* `spacing-2` = `0.5rem` = `8px`
* `spacing-3` = `0.75rem` = `12px`
* `spacing-4` = `1rem` = `16px`
* `spacing-6` = `1.5rem` = `24px`
* `spacing-8` = `2rem` = `32px`

### Elevation & Shadows

Multi-stop elevations for premium depth.
* `elevation-low`: `0 1px 2px 0 rgb(0 0 0 / 0.05)`
* `elevation-md`: `0 4px 6px -1px rgb(0 0 0 / 0.1)`
* `elevation-lg`: `0 10px 15px -3px rgb(0 0 0 / 0.1)`

### Radii (Continuous Curves)

* `radius-sm`: `calc(var(--radius) - 4px)` (approx 8px)
* `radius-md`: `calc(var(--radius) - 2px)` (approx 10px)
* `radius-lg`: `var(--radius)` (12px)
* `radius-full`: `9999px`

---

## 🛠️ Application Rules

1. **NO Magic Numbers:** Never hardcode margins/paddings like `13px`.
2. **NO Hardcoded Hex:** Use `bg-card`, `text-muted-foreground`, etc.
3. **NO Arbitrary rgba:** Replace `rgba(251, 191, 36, 0.1)` with `hsla(var(--color-warning) / 0.1)`.
4. **CSS Modules:** Use `hsl(var(--variable))` notation in `.module.css` files instead of legacy css variables where appropriate to enforce token usage.
