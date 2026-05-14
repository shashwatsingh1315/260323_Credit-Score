# High-End Design Style Document

## Core Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user. Premium design relies on purposeful whitespace, crisp typography, and high-contrast intentional colors. Hardcoded styles are technical debt; design tokens are scalable assets.

## Aesthetic Targets
*   **Premium & Clean**: Inspired by minimal UI patterns seen in modern apps (e.g. Uber, Linear).
*   **Uniformity**: 100% adherence to defined token sets; no "magic numbers" (`w-[100px]`) or one-off styling tweaks.
*   **High-Contrast Accessibility**: Meeting at least WCAG AA standards.
*   **Scalable Architecture**: Everything maps strictly to global CSS variables.

## Token Foundations

### 1. Colors
*   **Backgrounds**: Uses `var(--background)`, `var(--card)`, `var(--popover)` and `var(--muted)`.
*   **Text/Foreground**: Strictly `var(--foreground)` for primary copy and `var(--muted-foreground)` for secondary/helper text.
*   **Interactive/Action**: `var(--primary)`, `var(--secondary)`, `var(--accent)`.
*   **Feedback/Semantic**: `var(--destructive)`, `var(--success)`, `var(--warning)`, `var(--info)`.
*   **Borders**: Strictly `var(--border)` or `var(--input)` / `var(--ring)` depending on context.

### 2. Spacing & Rhythm (Base-4 scale)
We follow standard Tailwind utility rhythms without brackets:
*   `0.5` = `2px`
*   `1` = `4px`
*   `2` = `8px`
*   `3` = `12px`
*   `4` = `16px`
*   `6` = `24px`
*   `8` = `32px`
*   `12` = `48px`
*   `16` = `64px`

*No arbitrary values like `p-[13px]` allowed.*

### 3. Typography
*   **Primary Font**: Inter (or system-ui fallbacks), scaled through Tailwind's utility classes.
*   **Hierarchy**:
    *   Display/Headings (e.g., `text-2xl font-semibold tracking-tight`)
    *   Body (e.g., `text-sm text-foreground`)
    *   Muted/Micro-copy (e.g., `text-xs text-muted-foreground`)
    *   Micro: Uses specific token `text-tiny` (10px size / 14px line-height). *Do not use `text-[10px]`.*

### 4. Sizing & Layout Constraints
*   Avoid arbitrary pixel values for width/height.
*   Instead of `w-[50px]`, use `w-12`.
*   Instead of `w-[100px]`, use `w-24`.
*   Instead of `w-[200px]`, use `w-48`.
*   Instead of `min-w-[120px]`, use `min-w-32` (or adjust closer tokens like `min-w-32` `128px`).
*   Instead of `min-h-[80px]`, use `min-h-20` (80px).

### 5. Radii & Borders
*   Tokens scale via `--radius` in `globals.css`:
    *   `rounded-lg`: Standard for cards.
    *   `rounded-md`: Slightly sharper (e.g., inputs).
    *   `rounded-sm`: Tiny containers (e.g., badges).

### 6. Elevation
*   Use native tailwind shadows (`shadow-sm`, `shadow-md`) avoiding complex or un-tokenized dropshadow implementations.

## Rules of Engagement
1.  **Extract Hardcoded Values**: Any hex code or bracketed dimension (like `mt-[13px]` or `text-[#141414]`) is considered technical debt.
2.  **Consolidate Variants**: If 15 button styles exist, map them to 3 core token-based variants (Primary, Secondary, Outline/Ghost).
3.  **Accessibility Check**: Verify contrast ratios during application.
