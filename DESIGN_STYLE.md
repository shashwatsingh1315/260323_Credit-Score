# Aura Design System & Style Guidelines

## Core Philosophy
- **Consistency is Elegance:** Standardized spacing, colors, and typography create a premium feel.
- **Tokens over Magic:** Never use hardcoded values (like `text-[10px]`, `w-[200px]`). Always use the defined tailwind tokens.
- **Accessible & High Contrast:** Ensure colors are easy to read.

## Tokens
### Typography
- **Tiny:** `text-tiny` (10px, line-height 14px) - Used for extremely small meta-text, pill badges, uppercase kickers.
- **Small:** `text-sm` (14px)
- **Base:** `text-base` (16px)

### Colors
Always use semantic HSL variables:
- `bg-background`, `text-foreground`
- `bg-muted`, `text-muted-foreground`
- `border-border`
- `text-primary`, `text-destructive`, `text-warning`, `text-success`

### Spacing & Sizing
Always stick to the base-4 Tailwind scale:
- 1 = 4px
- 2 = 8px
- 3 = 12px
- 4 = 16px
...
- For custom widths (e.g., max-w-[200px]), round to the nearest token or use standard tokens like `w-48` (192px), `w-56` (224px).
- For 1px separators, use `h-px`, `w-px`.

## Rules
1. No `text-[10px]` or `text-[11px]` - replace with `text-tiny`.
2. No `w-[200px]` - replace with `w-48` or `w-56`.
3. No `min-h-[80px]` - replace with `min-h-20`.
4. No `p-[2px]` - replace with `p-0.5`.
5. No `rounded-[10px]` - replace with `rounded-xl` or similar.
