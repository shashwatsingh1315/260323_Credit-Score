# Design System & Styling Guidelines (Aura)

This document defines the high-end baseline for all styling in the Credit Issuance App, inspired by premium, clean, and uniform design languages. Hardcoded styles are technical debt; these design tokens are scalable assets.

## 1. Typography Scale

We use **Inter** as the foundational sans-serif font to maintain crisp, highly legible interfaces.

| Token | Class | Size/Line-Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `text-4xl font-bold tracking-tight` | 36px / 40px | 700 | Hero sections, primary headers on major dashboards. |
| **Heading 1** | `text-2xl font-semibold tracking-tight` | 24px / 32px | 600 | Page titles, primary modal headers. |
| **Heading 2** | `text-xl font-semibold tracking-tight` | 20px / 28px | 600 | Section titles, secondary modal headers. |
| **Heading 3** | `text-lg font-semibold` | 18px / 28px | 600 | Card titles, structural group headers. |
| **Body (Large)** | `text-base` | 16px / 24px | 400 | Primary paragraph text, main inputs. |
| **Body (Default)**| `text-sm` | 14px / 20px | 400 | Secondary text, descriptions, table cells. |
| **Caption** | `text-xs font-medium` | 12px / 16px | 500 | Metadata, helper text, inline status badges. |
| **Tiny** | `text-tiny font-semibold uppercase` | 10px / 14px | 600 | Overlines, micro-labels. |

---

## 2. Color System (Semantic HSL Tokens)

Our color system relies exclusively on semantic HSL variables mapped via Tailwind CSS to ensure seamless dark mode compatibility and consistent contrast. **Never hardcode hex values.**

### Background & Surface
| Token | Variable | Tailwind Class | Usage |
| :--- | :--- | :--- | :--- |
| **Background** | `--background` | `bg-background` | App root background. |
| **Card** | `--card` | `bg-card` | Primary container surface (e.g., Cards, Dialogs). |
| **Muted** | `--muted` | `bg-muted` | Secondary surface, subtle backgrounds (e.g., disabled inputs, secondary tabs). |
| **Popover** | `--popover` | `bg-popover` | Elevated surfaces like dropdown menus and tooltips. |

### Text & Icons
| Token | Variable | Tailwind Class | Usage |
| :--- | :--- | :--- | :--- |
| **Foreground** | `--foreground` | `text-foreground` | Primary text. |
| **Muted Foreground**| `--muted-foreground` | `text-muted-foreground` | Secondary text, descriptions, placeholders. |

### Action & Interactive
| Token | Variable | Tailwind Class | Usage |
| :--- | :--- | :--- | :--- |
| **Primary** | `--primary` | `bg-primary text-primary-foreground` | Primary buttons, active states. |
| **Secondary** | `--secondary` | `bg-secondary text-secondary-foreground`| Secondary buttons, subtle interactive elements. |
| **Accent** | `--accent` | `bg-accent text-accent-foreground` | Hover states on menus, selectable list items. |

### Status & Feedback
| Token | Variable | Tailwind Class | Usage |
| :--- | :--- | :--- | :--- |
| **Success** | `--color-success` | `bg-success text-success-foreground` | Approvals, positive metrics, completed states. |
| **Warning** | `--color-warning` | `bg-warning text-warning-foreground` | Pending states, cautions. |
| **Destructive** | `--destructive` | `bg-destructive text-destructive-foreground`| Rejections, deletions, critical errors. |
| **Info** | `--color-info` | `bg-info text-info-foreground` | Neutral informational badges. |
| **Brand** | `--color-brand` | `bg-brand text-brand-foreground` | Core branded visual elements (e.g., progress bars). |
| **Attention** | `--color-attention`| `bg-attention text-attention-foreground`| Highlighting specific required user actions. |

### Structural
| Token | Variable | Tailwind Class | Usage |
| :--- | :--- | :--- | :--- |
| **Border** | `--border` | `border-border` | Default structural borders (cards, tables, inputs). |
| **Input** | `--input` | `border-input` | Specific form input borders. |
| **Ring** | `--ring` | `ring-ring` | Focus rings for interactive elements. |

---

## 3. Spacing Scale

We utilize a strict **Base-4** rhythm for granular control and a **Base-8** rhythm for structural layout.

| Value | Rem | Px | Usage |
| :--- | :--- | :--- | :--- |
| `0.5` | `0.125rem` | `2px` | Micro-adjustments, active border indicators. |
| `1` | `0.25rem` | `4px` | Tight groupings (e.g., icon next to text). |
| `2` | `0.5rem` | `8px` | Standard inner padding for small interactive elements. |
| `3` | `0.75rem` | `12px` | Spacing between related form groups. |
| `4` | `1rem` | `16px` | Standard outer padding (e.g., standard Card padding). |
| `6` | `1.5rem` | `24px` | Section padding, modal inner padding. |
| `8` | `2rem` | `32px` | Major section gaps, page-level structural spacing. |

---

## 4. Radii (Continuous Curves)

We embrace continuous curve radiuses ("squircles") for a modern, approachable feel.

| Token | Variable | Tailwind Class | Usage |
| :--- | :--- | :--- | :--- |
| **Large** | `--radius` | `rounded-xl` / `rounded-lg` | Major containers: Cards, Modals, primary structural elements. |
| **Medium** | `calc(--radius - 2px)`| `rounded-md` | Intermediate elements: Buttons, Inputs, standard UI components. |
| **Small** | `calc(--radius - 4px)`| `rounded-sm` | Micro elements: Badges, checkboxes, tooltips. |
| **Full** | `9999px` | `rounded-full` | Avatars, pill badges. |

---

## 5. Elevation & Shadows

Shadows should be built with multi-stop elevations to mimic real-world physics and provide depth without being harsh.

| Level | Tailwind Class | Usage |
| :--- | :--- | :--- |
| **Level 0** | `shadow-none` (Default) | Flat elements (e.g., secondary buttons, muted cards). |
| **Level 1** | `shadow-sm` | Default elevation for primary Cards to sit slightly off the background. |
| **Level 2** | `shadow-md` | Hover states for Cards or Buttons to indicate interactivity. |
| **Level 3** | `shadow-lg` | Dropdown menus, Popovers, and floating structural elements. |
| **Level 4** | `shadow-xl` | Major overlapping views, such as full-screen Modals or Dialogs. |

---

## Refactoring Guidelines (Aura's Rules)

1. **No Hex Codes:** If you see `#FFFFFF` or `#0F172A`, replace it with `bg-card`, `bg-background`, `text-foreground`, etc.
2. **No Magic Numbers:** Replace `mt-[13px]` or `style={{ padding: '22px' }}` with the nearest standard Tailwind spacing utility (e.g., `mt-3`, `p-6`).
3. **Use `<alpha-value>`:** In `tailwind.config.js`, all `hsl()` definitions must use `/ <alpha-value>` to allow Tailwind's opacity modifiers (e.g., `bg-primary/20`) to work properly.
4. **CSS Modules:** Legacy CSS variables (like `--bg-tertiary`) are deprecated. Replace them with `hsl(var(--muted))` inside standard `.module.css` files.
5. **Interactive States:** Ensure all buttons and links have distinct `:hover` and `:disabled` states. Utilize `disabled:opacity-50 disabled:pointer-events-none`.
