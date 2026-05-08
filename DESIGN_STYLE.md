# CreditFlow Design System

## Core Principles
1. **Consistency First:** All styling must strictly adhere to predefined tokens.
2. **Scalability:** Rely on CSS variables combined with standard Tailwind CSS conventions (HSL tokens).
3. **Accessibility:** Ensure high contrast, functional focus states, and readability in both light and dark themes.
4. **Snappy Interactions:** Favor CSS transitions and transforms over computationally expensive complex animations.

## Token Mapping (Variables to Tailwind HSL)
Our application relies on a modern HSL-based styling approach for colors to scale perfectly across theming dimensions.

| Legacy Variable | Tailwind / HSL Token | Description |
|-----------------|---------------------|-------------|
| `--bg-primary` | `hsl(var(--background))` | Primary background color |
| `--bg-secondary`| `hsl(var(--card))` | Card/surface background color |
| `--bg-tertiary` | `hsl(var(--muted))` | Muted backgrounds, input backgrounds |
| `--text-primary`| `hsl(var(--foreground))` | Primary text color |
| `--text-secondary`| `hsl(var(--muted-foreground))` | Secondary/helper text color |
| `--text-muted` | `hsl(var(--muted-foreground))` | Disabled or tertiary text |
| `--border-primary`| `hsl(var(--border))` | Primary border color |
| `--border-color`| `hsl(var(--border))` | Universal border color |
| `--danger` | `hsl(var(--destructive))` | Destructive actions, errors |
| `--accent-primary`| `hsl(var(--accent))` | Primary accent/highlight color |
| `--accent-hover` | `hsl(var(--accent))` | Accent color used in hover states |

## Typography Scale
All typography uses strict scales. Avoid arbitrary `text-[13px]`.
- **Tiny:** `text-tiny` (10px, 14px line-height) - defined in `tailwind.config.js`
- **Small:** `text-sm` (14px) - body copy, secondary elements
- **Base:** `text-base` (16px) - main text blocks
- **Heading:** `text-lg` / `text-xl` / `text-2xl` - semantic headers

## Spacing & Sizing Scale
Use base-4 (`1rem` = `16px`) scaling. DO NOT use arbitrary bracket notation (e.g., `w-[150px]`, `mt-[12px]`).
- `.25rem` -> `1`
- `.5rem` -> `2`
- `1rem` -> `4`
- `1.5rem` -> `6`
- `2rem` -> `8`

## Global Interactive States
- **Hover:** Standardize with CSS pseudo-classes (`hover:opacity-90`, `hover:bg-muted`).
- **Focus:** Use robust visible rings: `focus:ring-2 focus:ring-ring focus:outline-none`.
- **Disabled:** Rely on standard Tailwind class: `disabled:opacity-50 disabled:pointer-events-none`. Do not use inline `style={{ opacity: 0.5 }}` logic.

## Common Form Inputs
When working with global inputs, dropdowns, and textareas:
- Use explicit HSL tokens in `src/app/globals.css` to prevent unreadable styling (e.g., white-on-white text in dark mode):
  ```css
  select, input, textarea {
    color: hsl(var(--foreground));
    background-color: hsl(var(--muted));
  }
  ```
