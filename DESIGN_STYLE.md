# High-End Design Style Document

## Core Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user.
This application adheres to a premium, clean, high-contrast, and highly scalable design language.

## 1. Color Tokens (Tailwind HSL Variables)
Instead of legacy hex or generic custom properties (`var(--bg-primary)`), we use standard Tailwind variables mapped to HSL.
- **Background**: `hsl(var(--background))`
- **Surface/Card**: `hsl(var(--card))`
- **Text Primary**: `hsl(var(--foreground))`
- **Text Secondary/Muted**: `hsl(var(--muted-foreground))`
- **Border**: `hsl(var(--border))`
- **Input**: `hsl(var(--input))`
- **Primary Action**: `hsl(var(--primary))`
- **Secondary Action**: `hsl(var(--secondary))`
- **Accents**: `hsl(var(--accent))`
- **Destructive/Error**: `hsl(var(--destructive))`

**Rule**: Never hardcode colors like `#ffffff` or use legacy variables (`var(--bg-primary)`). Always use standard Tailwind utility classes (`bg-background`, `text-foreground`, `border-border`) or their CSS equivalent (`hsl(var(--background))`).

## 2. Spacing & Layout Rhythm
- Strict Base-4/Base-8 rhythm via standard Tailwind spacing tokens.
- **Micro**: `gap-1` (4px), `gap-2` (8px)
- **Base**: `gap-4` (16px), `p-4` (16px), `p-6` (24px)
- **Macro**: `gap-8` (32px), `p-8` (32px)

**Rule**: No arbitrary brackets (`p-[13px]`) or hardcoded pixel values in standard elements.

## 3. Typography
- Rely on standard Tailwind text sizes: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, etc.
- Two semantic custom micro-typography tokens exist:
  - `text-tiny`: `['10px', '14px']`
  - `text-micro`: `['11px', '16px']`

**Rule**: Use semantic font weight utilities (`font-medium`, `font-semibold`) and avoid inline styles or non-standard text size brackets (`text-[10px]`).

## 4. Radii & Shadows
- Use semantic radius tokens: `rounded-md`, `rounded-lg`, `rounded-xl`.
- Shadows for elevation should use standard Tailwind shadow tokens: `shadow-sm`, `shadow-md`, `shadow-lg`.

## 5. Interactions & States
- **Hover**: Semantic state variants (`hover:bg-accent`, `hover:text-accent-foreground`).
- **Focus Rings**: Implement high-visibility focus rings universally (e.g., `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`).
- Avoid custom opacity backgrounds (e.g., `rgba(255, 255, 255, 0.04)`) for generic hover states; prefer token-based states like `hover:bg-accent`.

## 6. CSS Modules
When using `.module.css`, strictly use standard token variables wrapped in HSL:
```css
/* Good */
.myComponent {
  background-color: hsl(var(--card));
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border));
}

/* Bad */
.myComponent {
  background-color: rgba(255, 255, 255, 0.04); /* Magic opacity */
  color: var(--text-primary); /* Legacy hex variable */
}
```
