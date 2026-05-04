# CreditFlow Design System Baseline

## Philosophy
Elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user.

## Tokens & Variables

### Colors (Tailwind Variables)
* `background` (var(--background)): The primary background color. Replaces `--bg-primary`
* `foreground` (var(--foreground)): The primary text color. Replaces `--text-primary`
* `card` (var(--card)): Secondary background (surfaces like cards, dialogs). Replaces `--bg-secondary`
* `muted` (var(--muted)): Tertiary background (inputs, disabled states). Replaces `--bg-tertiary`
* `muted-foreground` (var(--muted-foreground)): Secondary/muted text. Replaces `--text-secondary`, `--text-muted`
* `accent` (var(--accent)): Accent backgrounds/borders. Replaces `--accent-primary`, `--accent-hover`
* `border` (var(--border)): Standard border colors. Replaces `--border-primary`, `--border-color`

### Typography
* Uses `Inter` and system fonts.
* Hierarchy uses semantic classes and consistent sizes from Tailwind config.

### Radii
* Uses CSS variables `--radius`, `calc(--radius - 2px)`, `calc(--radius - 4px)` mapped to Tailwind classes like `rounded-xl`, `rounded-lg`, `rounded-md`, `rounded-sm`.

## Legacy Tokens Deprecated
* Hardcoded hex values for colors.
* Legacy CSS variables like `--bg-primary`, `--text-secondary`, etc. Use `--background` and `--foreground` equivalents.
