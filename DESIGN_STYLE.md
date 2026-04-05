# Aura High-End Design Style Document

## 1. Philosophy
The design system emphasizes rigorous consistency, precise semantic tokens, and high-end aesthetic refinement. Inspired by industry-leading design languages (such as Uber, Linear, and Apple), the goal is to create an interface that is visually crisp, universally accessible, and structural in its use of whitespace.
Hardcoded hex values and "magic numbers" are considered technical debt; semantic, scalable tokens are the standard.

## 2. Token Infrastructure (Global CSS Variables)
The project utilizes Tailwind CSS heavily combined with a robust CSS Variable infrastructure for theming (supporting both `:root` for light mode and `.dark` for dark mode). Variables are defined in HSL to allow for native alpha/opacity support via Tailwind's `<alpha-value>` placeholder.

### 2.1 Colors
All colors follow a chromatic darkness scale ensuring proper contrast ratios. We utilize semantic naming.

#### Background & Surface Levels
*   **Background (`--background`)**: The deepest layer. Absolute base.
*   **Foreground (`--foreground`)**: Primary text color on top of background.
*   **Card (`--card`)**: First elevation layer, typically used for prominent structural panels.
*   **Popover (`--popover`)**: Highest structural layer, for menus and tooltips.
*   **Muted (`--muted`)**: Subdued background for low-emphasis structural areas or secondary tabs.

#### Action & Interaction
*   **Primary (`--primary`)**: High-contrast, core brand interaction color.
*   **Secondary (`--secondary`)**: Subdued interaction layer.
*   **Accent (`--accent`)**: For highlighting specific states without overpowering primary actions.
*   **Border (`--border`)**: Standard stroke color for all boundaries.
*   **Input (`--input`)**: Default background or border for form elements.
*   **Ring (`--ring`)**: Intense, focused interaction boundary for accessibility.

#### Status & Feedback
*   **Success (`--color-success`)**: For positive, confirmed actions.
*   **Warning (`--color-warning`)**: For cautionary states (avoiding red, typically orange/amber).
*   **Destructive (`--color-destructive` / `--destructive`)**: For critical or destructive actions (reds).
*   **Info (`--color-info`)**: For neutral informational feedback.
*   **Attention (`--color-attention`)**: Distinct visual pull, stronger than warning but non-destructive.
*   **Brand (`--color-brand`)**: Reserved for pure marketing or core brand identity injections.

### 2.2 Typography
Typography is crisp, geometric, and functional.
*   **Font Family**: `Inter` as the primary sans-serif base, falling back to system stacks.
*   **Scaling**: Fluid and explicit sizes defined via Tailwind (`text-sm`, `text-base`, `text-lg`), removing arbitrary pixel overrides.
*   **Weight**: Structural hierarchy established through weight mapping (e.g., `font-medium` for interactive, `font-bold` for core headings).

### 2.3 Spacing (Rhythm & Layout)
Strict adherence to a 4px/8px rhythm base.
*   Magic numbers (e.g., `13px`, `22px`) are strictly forbidden.
*   All margins and paddings must map to Tailwind's default spacing scale (`p-4` = 16px, `gap-6` = 24px).

### 2.4 Radii & Shape (Continuous Curve)
We employ squircles and continuous curves to create a modern, friendly but sharp aesthetic.
*   **Base Radius (`--radius`)**: Configured globally.
*   **Derivatives**: `calc(var(--radius) - 2px)` and `calc(var(--radius) - 4px)` ensure nested components (like a button inside a card) have perfectly concentric rounding.

### 2.5 Shadows & Elevations
Elevation is not just a drop shadow; it represents structural height. We use multi-stop gradients/shadows to ensure realism.
*   Always favor `shadow-sm` for standard interactive elements.
*   Avoid single heavy black box-shadows.

## 3. Strict Rules of Application
1.  **Never hardcode hex values.** Always use `hsl(var(--token))`.
2.  **Use Alpha Syntax.** When you need an opacity of a token, define the token in the config with `<alpha-value>` and apply via Tailwind (`bg-primary/20`).
3.  **Dark Mode Compliance.** All new components must gracefully flip when `.dark` is applied to the root document. Do not use legacy color names that assume a light theme (e.g., `bg-white`).
4.  **Form Contrast.** Forms inputs (selects, textareas) must explicitly declare their background and foreground semantic tokens to prevent dark-mode invisible-text bugs.
