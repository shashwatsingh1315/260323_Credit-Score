# DESIGN_STYLE.md

## Overview
The High-End Design Style Document establishes the rigorous, design-token-based foundation for our applications aesthetic.

## Semantic Token Scales
Our application uses HSL-based Tailwind tokens for maximum flexibility, scalability, and adherence to standard high-end UI patterns.

### Colors
- **Background:** `hsl(var(--background))`
- **Foreground (Text):** `hsl(var(--foreground))`
- **Card (Surface Primary):** `hsl(var(--card))`
- **Muted (Surface Secondary/Tertiary):** `hsl(var(--muted))`
- **Muted Foreground (Text Secondary):** `hsl(var(--muted-foreground))`
- **Border:** `hsl(var(--border))`
- **Accent (Hover States):** `hsl(var(--accent))`
- **Primary (Action/Brand):** `hsl(var(--primary))`

*Note: The legacy hex tokens (`--bg-primary`, `--text-primary`, etc.) are being systematically removed and mapped to these scalable semantic variables.*

### Spacing & Layout
Strictly use standard base-4/base-8 spacing (e.g., `p-4`, `m-2`, `gap-6`). Do not use arbitrary 'magic numbers' via bracket notation (e.g., `px-[17px]`).

### Typography
- Utilize defined `text-` utility classes.
- Use `text-tiny` or `text-micro` instead of arbitrary sizes like `text-[10px]` or `text-[11px]`.

### Elevation & Radii
- Use standard shadows: `shadow-sm`, `shadow`, `shadow-md`
- Use standard border-radius: `rounded-md`, `rounded-lg`, `rounded-xl`
