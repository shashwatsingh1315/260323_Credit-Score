# Aura Design System & Style Guide

## Goal
Aura establishes a high-end, rigorous, token-based design foundation for the application.

## Core Tokens
The application primarily uses a dark theme. All styling should rely on defined CSS variables mapped to standard Tailwind utilities, ensuring uniform scaling, proper layout alignment, and no hardcoded values.

### Colors
Background and layout colors rely on the following tokens configured in `globals.css` and `tailwind.config.js`:
- **Background**: `bg-background`
- **Foreground**: `text-foreground`
- **Surface**: `bg-card`
- **Muted**: `bg-muted`, `text-muted-foreground`
- **Borders**: `border-border`

Legacy hex colors (e.g., `--bg-primary`, `--bg-secondary`) have been mostly phased out. Do not introduce new arbitrary hex colors (`text-[#333]`).

### Spacing & Layout
Strictly use standard Tailwind base-4 spacing scale (`p-4`, `m-2`, `gap-6`, `w-8`, `h-8`).
Avoid all arbitrary values (e.g., `w-[260px]`, `h-[70px]`, `gap-[0.75rem]`, `p-[1.5rem]`).

### Typography
Consistent typography is key.
- Use standard sizing utilities (`text-sm`, `text-xs`, `text-lg`).
- Avoid arbitrary sizes (`text-[10px]`, `text-[11px]`). Use `text-tiny` for `10px` elements.

### Legacy Cleanup Focus
We are specifically targeting CSS modules and component styles that use arbitrary values, magic numbers, or hardcoded hex colors, translating them to semantic Tailwind tokens and utility classes.
