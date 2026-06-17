# 💅 High-End Design Style Document (Aura)

This document establishes the structural styling foundation for the application, enforcing a premium, high-contrast, and intuitive aesthetic. All styling updates must strictly adhere to these guidelines to maintain systemic uniformity.

## 1. 🎨 The Token System (Colors)

Our color system relies on CSS variables using HSL (Hue, Saturation, Lightness) to enable fluid dark/light mode transitions and maintain WCAG compliance.

**Do not use hardcoded hex values (e.g., `#FFFFFF`) or legacy custom properties (e.g., `var(--bg-primary)`).**

| Semantic Role | Legacy Variable (Do NOT use) | ✅ Standard Token (Use this) | Purpose |
| :--- | :--- | :--- | :--- |
| **Background (Main)** | `--bg-primary` | `hsl(var(--background))` | Main app canvas |
| **Surface (Cards)** | `--bg-secondary` | `hsl(var(--card))` | Card and container backgrounds |
| **Surface (Muted)** | `--bg-tertiary` | `hsl(var(--muted))` | Subtle backgrounds, disabled states, inputs |
| **Text (Primary)** | `--text-primary` | `hsl(var(--foreground))` | High-contrast body and headings |
| **Text (Secondary)** | `--text-secondary`, `--text-muted`| `hsl(var(--muted-foreground))` | Supporting text, metadata |
| **Border / Line** | `--border-primary`, `--border-color`| `hsl(var(--border))` | Dividers, subtle outlines |
| **Action (Primary)** | N/A | `hsl(var(--primary))` | Primary buttons, active states |
| **Action (Secondary)**| `--accent-primary` | `hsl(var(--accent))` | Secondary buttons, focus states |
| **Danger / Error** | `--danger` | `hsl(var(--destructive))` | Destructive actions, errors |

*Note: In CSS modules (`.module.css`), use `var(--background)` directly if not using `hsl()`, but prefer mapping to Tailwind classes where possible.*

## 2. 📏 Spacing & Sizing Rhythm

We use a strict **Base-4/Base-8 spacing scale**. Magic numbers (e.g., `13px`, `17px`, `22px`) are strictly forbidden.

| Token | Pixels (rem) | Usage |
| :--- | :--- | :--- |
| `space-1` | 4px (0.25rem) | Internal component padding (e.g., badges) |
| `space-2` | 8px (0.5rem) | Gap between related elements |
| `space-4` | 16px (1rem) | Standard padding for containers/cards |
| `space-6` | 24px (1.5rem) | Section spacing |
| `space-8` | 32px (2rem) | Major layout divisions |

## 3. ✍️ Typography

Keep typography crisp, clean, and legible. Ensure a strong visual hierarchy.

| Token | Class | Size / Weight | Usage |
| :--- | :--- | :--- | :--- |
| **Tiny** | `text-tiny` | 10px / 14px | Microcopy, badges |
| **Small** | `text-sm` | 14px | Supporting text, standard buttons |
| **Base** | `text-base` | 16px | Body text |
| **Large** | `text-lg font-semibold`| 18px / 600 | Card headers, subsection titles |
| **Heading** | `text-2xl font-bold` | 24px / 700 | Page titles |

## 4. 🎛️ Interaction & Elevation

Focus rings, hover states, and shadows must be intentional and uniform.

*   **Focus Rings:** Always use standard focus rings (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`).
*   **Shadows:** Use standard Tailwind shadows (`shadow-sm`, `shadow-md`) for elevation; do not invent custom box-shadows.
*   **Radii:** Use standard tokens (`rounded-sm`, `rounded-md`, `rounded-lg`).

## 5. 🚫 Anti-Patterns (What to Avoid)

*   `mt-[13px]`, `w-[200px]` - No arbitrary brackets unless absolutely necessary for external integration.
*   `color: #333` - No hardcoded colors.
*   `font-size: 15px` - Use standard scale sizes.
