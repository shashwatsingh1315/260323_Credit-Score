# 📐 DESIGN_STYLE.md - Aura's High-End Baseline

## The Aesthetic Vision
Premium, clean, high-contrast, scalable, and intuitive. Inspired by Uber, Linear, and Apple.
This project uses a primarily dark-themed environment (`<html class="dark">`).
All stylistic definitions must be derived from token-based definitions mapping semantic values to HSL components.

## Core Directives
1. **No Hardcoded Hex Colors**: Use `hsl(var(--token))` with `<alpha-value>` for opacities (e.g. `bg-primary/20`).
2. **Consistent Whitespace**: Base-4 or Base-8 scales strictly. Use tailwind utility classes (`p-4`, `m-8`, `gap-2`).
3. **Typography Rhythm**: No arbitrary bracket notation (`text-[13px]`). Use standard text utilities or customized tokens (e.g., `text-tiny`).
4. **Structural Radii**: Squircles and rounded corners should follow the `--radius` variables.
5. **No inline styles**: Avoid `style={{}}` embedding conditional logic. Use Tailwind pseudo-classes (`hover:`, `disabled:`).
6. **CSS Modules**: In `.module.css` files, legacy `--bg-primary` variables are deprecated. Strictly use standard `hsl(var(--background))` formats to match Tailwind.

## Design Tokens (Tailwind & CSS Variables)

### 1. Colors
Tokens are configured in `tailwind.config.js` and `src/app/globals.css`.
*   `--background`: `hsl(var(--background))`
*   `--foreground`: `hsl(var(--foreground))`
*   `--card`: `hsl(var(--card))`
*   `--popover`: `hsl(var(--popover))`
*   `--primary`: Action primary elements
*   `--secondary`: Action secondary elements
*   `--muted`: De-emphasized surfaces/text
*   `--accent`: Interactive hover surfaces
*   `--border`: Standard structural borders
*   `--destructive`: Destructive actions

### 2. Status & Badge Colors (Semantic)
*   `--color-success`: `hsl(var(--color-success))`
*   `--color-warning`: `hsl(var(--color-warning))`
*   `--color-destructive`: `hsl(var(--color-destructive))`
*   `--color-info`: `hsl(var(--color-info))`
*   `--color-attention`: `hsl(var(--color-attention))`

### 3. Alpha Transparencies (hsla)
Use division syntax when using custom logic: `hsla(var(--color-warning) / 0.1)`. Avoid `rgba(255, 255, 255, 0.05)`.

### 4. Typography
*   `font-sans`: Primary application font (`var(--font-inter)`).
*   `text-tiny`: 10px / 14px size token.

### 5. Radii
*   `rounded-lg`, `rounded-md`, `rounded-sm` defined relative to `--radius`.
