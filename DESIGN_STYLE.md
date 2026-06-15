# Aura Design System Guidelines

## Core Philosophy
- **Tokenize Everything**: Do not use arbitrary sizing, spacing, or hex code (`w-[200px]`, `#FFFFFF`).
- **Use Semantic Naming**: Follow the system (`text-muted-foreground`, `bg-background`).
- **Base-4/Base-8 Grid**: Adhere strictly to the Tailwind spacing scale (`p-4`, `gap-2`).

## Tokens

### Typography
- **Tiny text**: Instead of `text-[10px]` or `text-[11px]`, use the configured `text-tiny` or `text-xs`.

### Sizing & Spacing
- Replace bracket notation magic numbers with standard spacing tokens:
  - `w-[200px]` -> `w-48` or `w-64` depending on context.
  - `min-w-[260px]` -> `min-w-64`
  - `min-h-[80px]` -> `min-h-20`
  - `max-w-[200px]` -> `max-w-48`
  - `max-w-[150px]` -> `max-w-40`

### Colors
- Use CSS variables (`hsl(var(--...))`) for colors.
- Follow existing Tailwind config semantics: `primary`, `destructive`, `muted`, `accent`, etc.

## Refactor Plan
- Systematically remove `-[XXpx]` classes from UI components.
- Swap hex colors with CSS variable tokens where found.
