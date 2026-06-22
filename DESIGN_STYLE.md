# 💅 High-End Design Style Document (Aura)

## 🎨 Theme & Tokens

The application follows a premium, clean, high-contrast, scalable aesthetic inspired by Uber/Apple/Linear.
We strictly use standard Tailwind HSL tokens rather than legacy hex-based CSS custom properties.

### 🚫 The Legacy vs. ✅ The Standard

| Legacy Hex Token        | New Standard Token                |
| ----------------------- | --------------------------------- |
| `var(--bg-primary)`     | `hsl(var(--background))`          |
| `var(--bg-secondary)`   | `hsl(var(--card))`              |
| `var(--bg-tertiary)`    | `hsl(var(--muted))`               |
| `var(--text-primary)`   | `hsl(var(--foreground))`          |
| `var(--text-secondary)` | `hsl(var(--muted-foreground))`    |
| `var(--text-muted)`     | `hsl(var(--muted-foreground))`    |
| `var(--accent-primary)` | `hsl(var(--accent))`              |
| `var(--accent-hover)`   | `hsl(var(--accent))` (adjust opacity if needed, e.g. /80) |
| `var(--border-primary)` | `hsl(var(--border))`              |
| `var(--border-color)`   | `hsl(var(--border))`              |
| `var(--danger)`         | `hsl(var(--destructive))`         |

## 📏 Typography, Spacing, and Utilities
- Use base-4 and base-8 token systems for margin/padding (e.g. `p-4`, `gap-2`). Avoid arbitrary sizes (`p-[13px]`).
- Adhere strictly to the Tailwind defined scales.

## ✍️ Refactoring Principles
- Strip out any occurrences of legacy tokens mapped in `src/app/globals.css`.
- Rely entirely on semantic tokens from `tailwind.config.js` config and standard classes, or `hsl(var(--token))` when absolutely writing custom CSS.
- Remove inline magic numbers.
