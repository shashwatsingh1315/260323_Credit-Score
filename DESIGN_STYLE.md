# 🎨 Aura Design System - Core Tokens

Our goal is a premium, high-contrast, scalable aesthetic relying on rigorous consistency.

## The Standard (Tokens)

We use the standard Tailwind semantic token system backed by HSL variables defined in `src/app/globals.css`.

### Colors

*   **Backgrounds:**
    *   `--background`: Primary application background (replacing `--bg-primary`).
    *   `--card`: Surface background for containers/cards (replacing `--bg-secondary`).
    *   `--muted`: Tertiary backgrounds/inactive states (replacing `--bg-tertiary`).
*   **Text:**
    *   `--foreground`: Primary text (replacing `--text-primary`).
    *   `--muted-foreground`: Secondary/subdued text (replacing `--text-secondary`, `--text-muted`).
*   **Borders:**
    *   `--border`: Standard borders (replacing `--border-primary`, `--border-color`).
*   **Interactive / Accent:**
    *   `--primary` & `--primary-foreground`: Primary actions.
    *   `--accent` & `--accent-foreground`: Hover states and subtle highlights (replacing `--accent-primary`, `--accent-hover`).
*   **Feedback:**
    *   `--destructive` & `--destructive-foreground`: Errors and dangerous actions (replacing `--danger`).

### Typography & Spacing
*   Adhere to Tailwind's default base-4 scale (`p-4`, `m-2`, `gap-6`). No arbitrary magic numbers (e.g., `17px`, `22px`).
*   Standard Tailwind font scales (`text-sm`, `text-base`, `text-lg`). No hardcoded font sizes.

## 🧹 The Cleanup (Legacy Pattern Replacement)

We are systematically deprecating the following legacy CSS custom properties used in `*.module.css` files. They must be replaced with the correct `hsl(var(--token))` equivalent.

**Mapping:**
*   `var(--bg-primary)` -> `hsl(var(--background))`
*   `var(--bg-secondary)` -> `hsl(var(--card))`
*   `var(--bg-tertiary)` -> `hsl(var(--muted))`
*   `var(--text-primary)` -> `hsl(var(--foreground))`
*   `var(--text-secondary)` -> `hsl(var(--muted-foreground))`
*   `var(--text-muted)` -> `hsl(var(--muted-foreground))`
*   `var(--border-primary)` -> `hsl(var(--border))`
*   `var(--border-color)` -> `hsl(var(--border))`
*   `var(--danger)` -> `hsl(var(--destructive))`
*   `var(--accent-primary)` -> `hsl(var(--accent))`
*   `var(--accent-hover)` -> `hsl(var(--accent))`

*Note: The `globals.css` base layer handles assigning HSL values to these `--*` variables.*
