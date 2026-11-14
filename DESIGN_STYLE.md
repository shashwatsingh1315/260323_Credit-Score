# High-End Design Style Document (Aura)

## 📐 The Standard

Our goal is a Premium, clean, high-contrast, scalable design system. We favor Tailwind CSS utility classes and native design tokens via standard `hsl(var(--token))` definitions in `globals.css` and `tailwind.config.js`.

### Color Tokens
*   **Background:** `bg-background` (Page backgrounds)
*   **Surface:** `bg-card`, `bg-popover`, `bg-muted` (Cards, dropdowns, secondary areas)
*   **Text:** `text-foreground` (Primary), `text-muted-foreground` (Secondary/Tertiary)
*   **Action:** `bg-primary`, `bg-secondary`, `bg-destructive`, `bg-accent` (Buttons, interactive elements)
*   **Border:** `border-border` (Dividers, structural outlines)

### Typography
*   We use a standard typography scale provided by Tailwind. Avoid magic numbers and explicit pixel values.
*   **Display:** Reserved for major headings.
*   **Body:** Base font size with `font-sans` (Inter).
*   **Small Structural:** Use standard `text-sm`, `text-xs`.

### Spacing & Sizing
*   Strict adherence to base-4/base-8 rhythm (e.g., `p-4`, `m-2`, `gap-6`).
*   Avoid arbitrary bracket notation (`px-[17px]`).
*   Layout sizing should use fractional or standard tokens (e.g., `w-64` for 256px sidebar).

### Layout & Structure
*   Prefer semantic HTML and flexbox/grid combinations.
*   **NO** CSS Modules with custom layout declarations (`.module.css` files) unless explicitly required for a complex interaction that cannot be achieved with Tailwind, which is extremely rare.
