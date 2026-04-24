# High-End Design Style Document

## Core Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user.

## Design Tokens (Tailwind)

### Typography
- **Inter** as the primary font family.
- Replaced arbitrary magic sizes like `text-[10px]` with standard tokens or existing custom tokens like `text-tiny`.

### Spacing & Sizing
- Strict base-4 rhythm.
- No arbitrary values like `w-[200px]`, `w-[50px]`, `w-[100px]`, `min-h-[80px]`, etc. mapped to `w-48` (192px) or `w-56` (224px), `w-12`, `w-24`, `min-h-20`.
- No arbitrary percentage values unless necessary for inline progress bars where it represents a variable.

### Colors
- Use semantic HSL tokens with alpha syntax (e.g. `bg-primary/50`).
- No hardcoded hex values in component files or magic inline styles like `style={{ color: '#fff' }}`.

### Interactions
- Instead of using `style={{ opacity: canGoNext(1) ? 1 : 0.5 }}`, use standard Tailwind disabled states like `disabled:opacity-50`.
