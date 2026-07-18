# High-End Design Style Document

## Core Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user.

## Tokens

### Colors (Tailwind semantic configuration)
- `background`: `hsl(var(--background))`
- `foreground`: `hsl(var(--foreground))`
- `primary`: `hsl(var(--primary))`
- `muted`: `hsl(var(--muted))`
- `muted-foreground`: `hsl(var(--muted-foreground))`
- `border`: `hsl(var(--border))`

### Spacing & Layout
- Strictly base-4/base-8 rhythmic spacing.
- Use exact tokens `p-4`, `m-2`, `gap-3`, etc.
- Avoid arbitrary bracket spacing `p-[13px]`.

### Typography
- Primary font: Inter (`var(--font-inter)`).
- Strict scale: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`.
- Do not use arbitrary sizing `text-[17px]`.

### Components
- **Buttons**: Use semantic classes `.btn-primary`, `.btn-secondary`, or strict semantic tokens. Avoid arbitrary colors.
- **Cards**: Use semantic `.card` class or `bg-card border-border shadow-sm rounded-xl`.
