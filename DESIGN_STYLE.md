# Design System & UX Guidelines (Aura)

This document outlines the high-end aesthetic standard for the application.

## Core Principles
1. **Consistency is Key:** Use standard design tokens for colors, spacing, and typography across the entire application.
2. **Standardization over Customization:** Avoid one-off CSS values, magic numbers, or custom hex codes.
3. **Accessibility:** Ensure high contrast and clear focus states for interactive elements.

## Token Reference

### Colors (HSL-based)
* `--background`: The primary application background.
* `--foreground`: Default text color.
* `--card`: Surface color for cards, panels, and sidebars.
* `--card-foreground`: Text inside cards.
* `--muted`: Secondary backgrounds, subtle fills.
* `--muted-foreground`: Secondary text, placeholders, subtitles.
* `--border`: Universal border color.
* `--accent`: Primary interactive or highlighted areas.
* `--destructive`: Errors, dangerous actions, or rejections.

*Legacy Hex Variables (Removed)*: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-primary`, `--accent-hover`, `--border-primary`, `--border-color`, `--danger`

### Spacing & Layout
* Adhere strictly to the Tailwind 4px/8px rhythm base scales (e.g., `p-4`, `m-2`, `gap-6`).
* Refrain from using magic numbers via bracket notation (e.g., `w-[17px]`).

### Typography
* Maintain semantic heading scales.
* Standard UI font: `var(--font-family)`.
