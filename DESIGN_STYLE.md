# Aura Design System & Aesthetic Guidelines

## The Mission
To establish a rigorous, design-token-based foundation that elevates the application's aesthetic to a premium, highly refined standard. We aim for uniformity, crisp typography, purposeful whitespace, and high-contrast intentional colors.

## The Standard (Tokens)

All CSS modules and Tailwind classes must use standard Tailwind HSL tokens. Legacy hex-based custom properties are deprecated.

### Colors
| Legacy Hex Custom Property | New Tailwind HSL Token (Use via `hsl(var(--token))`) |
| :--- | :--- |
| `--bg-primary` | `--background` |
| `--bg-secondary` | `--card` |
| `--bg-tertiary` | `--muted` |
| `--text-primary` | `--foreground` |
| `--text-secondary` | `--muted-foreground` |
| `--text-muted` | `--muted-foreground` |
| `--accent-primary` | `--accent` |
| `--accent-hover` | `--accent` |
| `--border-primary` | `--border` |
| `--border-color` | `--border` |
| `--danger` | `--destructive` |

### Typography
- Standardize on `var(--font-family)` via Tailwind sans.
- Use `text-tiny` `['10px', '14px']` for 10px text instead of arbitrary `text-[10px]`.

### Spacing & Sizing
- Use standard base-4/base-8 Tailwind spacing tokens (`w-48`, `h-96`, `p-4`, `m-2`).
- **NO MAGIC NUMBERS**: Avoid arbitrary bracket notation (`w-[200px]`, `mt-[13px]`).

### Interactive Elements
- Provide consistent focus rings, hover states, and disabled states.

## The Cleanup
- Remove all instances of `var(--bg-primary)`, `var(--text-primary)`, etc. from CSS modules.
- Ensure all styling relies on standard Tailwind tokens or HSL CSS variables for dark mode compatibility and semantic consistency.
