# Aura Design System (High-End Baseline)

## Principles
1. **Premium Aesthetic:** Clean, uniform, high-contrast intentional colors.
2. **Strict Scaling:** Rely purely on design tokens instead of hardcoded hex values or arbitrary paddings/margins.
3. **Consistency:** Replace arbitrary spacing, sizing, and colors with established Tailwind / CSS module tokens.

## Token Scales

### Spacing & Sizing
- Strict usage of Tailwind Base-4 scales: `p-4`, `p-6`, `m-2`, `gap-4`. Avoid magic numbers like `mt-[13px]`.

### Typography
- Body: `text-sm`, `text-base`
- Headings: `text-xl font-bold tracking-tight`
- Muted: `text-muted-foreground`
- Custom Token: `text-tiny` (10px - 14px) instead of arbitrary tiny sizes.

### Colors
Always use `hsl(var(--token))` variables mapped into Tailwind:
- `--background`: Page background
- `--foreground`: Primary text
- `--card` / `--card-foreground`: Card surface and text
- `--primary` / `--primary-foreground`: Primary action elements
- `--secondary` / `--secondary-foreground`: Secondary action elements
- `--muted` / `--muted-foreground`: Disabled/dimmed UI
- `--destructive`: Destructive actions (errors)
- `--border`: Borders and inputs

### Legacy Hex Conversions
The following legacy hex tokens have been remapped in `globals.css` to standard HSL:
- `--bg-primary` ➔ `--background`
- `--bg-secondary` ➔ `--card`
- `--bg-tertiary` ➔ `--muted`
- `--text-primary` ➔ `--foreground`
- `--text-secondary` / `--text-muted` ➔ `--muted-foreground`
- `--border-primary` / `--border-color` ➔ `--border`
- `--danger` ➔ `--destructive`
