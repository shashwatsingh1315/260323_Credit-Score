# DESIGN_STYLE.md

## The Standard

The application uses a high-end, premium aesthetic characterized by rigorous consistency, purposeful whitespace, crisp typography, and intentional colors. Hardcoded styles and "magic numbers" are strictly prohibited.

### 1. Color System (Tokens)

All colors must be referenced using semantic tokens in the `globals.css` HSL format (`hsl(var(--token-name))`).

#### Base
* **`--background`**: Primary application background (dark theme default).
* **`--foreground`**: Primary text color for maximum readability.

#### Surfaces
* **`--card`**: Background color for distinct container elements (cards, dialogs).
* **`--popover`**: Background color for floating elements (dropdowns, tooltips).

#### Interaction & States
* **`--primary`**: Main brand/action color.
* **`--secondary`**: Subtle interaction color.
* **`--muted`**: Depressed or inactive state color.
* **`--accent`**: Highlighting color for selection or emphasis.
* **`--destructive`**: Danger/Error actions.

#### Borders & Outlines
* **`--border`**: Default border color for separating content.
* **`--input`**: Border color for form inputs.
* **`--ring`**: Focus ring color for keyboard accessibility.

### 2. Typography

* **Base Font**: Inter (`var(--font-inter)`). Fallback to `system-ui, sans-serif`.
* **Scales**: Avoid arbitrary pixel sizes. Use standard tailwind tokens (`text-xs`, `text-sm`, `text-base`, `text-lg`, etc.).
* **Special Cases**: Use `text-tiny` (defined in `tailwind.config.js` as `['10px', '14px']`) for micro-copy rather than hardcoding `text-[10px]`.

### 3. Spacing & Sizing

Strict adherence to the 4px/8px base scale (Tailwind standard spacing).

* **Allowed**: `p-2` (8px), `m-4` (16px), `gap-6` (24px).
* **Prohibited**: Arbitrary brackets like `p-[13px]`, `m-[7px]`, `w-[200px]`, `min-h-[80px]`.

### 4. Component Standards

* **Elevation/Shadows**: Use unified, high-quality shadows (`shadow-sm`, `shadow-md`) rather than custom `box-shadow` styles.
* **Borders & Radii**: Use variable-based border-radius: `var(--radius)`, `calc(var(--radius) - 2px)`, etc., or standard Tailwind tokens (`rounded-md`, `rounded-lg`).

### 5. Legacy Class Mapping

All legacy CSS variables must be migrated to standard HSL variables:
* `--bg-primary` ➔ `--background`
* `--bg-secondary` ➔ `--card`
* `--bg-tertiary` ➔ `--muted`
* `--text-primary` ➔ `--foreground`
* `--text-secondary` ➔ `--muted-foreground`
* `--text-muted` ➔ `--muted-foreground`
* `--accent-primary` ➔ `--accent`
* `--border-primary` ➔ `--border`
* `--border-color` ➔ `--border`
* `--danger` ➔ `--destructive`

*Note: Ensure `.dark` includes `color-scheme: dark;` to render native UI (like `<select>` options) correctly.*