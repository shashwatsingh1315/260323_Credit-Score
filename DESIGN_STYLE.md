# Aura Design System Guidelines

## Core Principles
- **Rigorous Consistency:** All colors, spacing, and typography must use standard design tokens.
- **Premium Aesthetics:** High-contrast colors, intentional whitespace, and crisp typography.
- **Scalable Infrastructure:** Strict reliance on Tailwind HSL tokens; no hardcoded hex values or magic numbers.

## Token Scales

### Colors
We rely on a semantic, scalable HSL token system configured in `globals.css` and `tailwind.config.js`.

| Token Name | Tailwind Class | CSS Variable | Legacy Equivalent | Usage |
|---|---|---|---|---|
| Background | `bg-background` | `hsl(var(--background))` | `var(--bg-primary)` | Main page backgrounds |
| Card/Surface | `bg-card` | `hsl(var(--card))` | `var(--bg-secondary)` | Panels, cards, dropdowns |
| Muted/Subtle | `bg-muted` | `hsl(var(--muted))` | `var(--bg-tertiary)` | Hover states, subtle backgrounds, inputs |
| Primary Text | `text-foreground` | `hsl(var(--foreground))` | `var(--text-primary)` | Standard text |
| Secondary Text | `text-muted-foreground` | `hsl(var(--muted-foreground))` | `var(--text-secondary)`, `var(--text-muted)` | Supporting text, descriptions |
| Borders | `border-border` | `hsl(var(--border))` | `var(--border-primary)`, `var(--border-color)` | Standard borders, dividers |
| Destructive | `text-destructive`, `bg-destructive` | `hsl(var(--destructive))` | `var(--danger)` | Error states, delete actions |

### Spacing & Sizing
- Strict reliance on standard Tailwind scales (Base-4/Base-8).
- E.g., `p-4` (16px), `gap-2` (8px), `mt-8` (32px).
- **Prohibited:** Magic numbers like `px-[17px]`, `mt-[13px]`.

### Typography
- Inter (`font-sans`) as the primary font family.
- Unified scale from Tailwind (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, etc.).
- Custom tiny scale added: `text-tiny` (10px).

### Forms & Interactive Elements
- Global inputs must explicitly use tokenized backgrounds to avoid light/dark mode bugs.
- Disabled states must use `disabled:opacity-50 disabled:pointer-events-none`.

## Migration Checklist
- Replace all legacy variables in `*.module.css` files.
- Update global CSS rules to use HSL formats.
- Eliminate raw hex codes.
