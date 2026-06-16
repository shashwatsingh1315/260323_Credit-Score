# 📐 High-End Design Style Document

## Core Philosophy
- **Consistent Tokens**: Strictly enforce predefined base-4/base-8 spacing, standard typography, and HSL semantic colors.
- **Premium Aesthetics**: Aim for a modern, clean UI inspired by top-tier platforms (Uber, Apple, Linear).
- **Scalable Architecture**: Avoid magic numbers (e.g., `w-[200px]`, `min-h-[80px]`) and replace them with closest Tailwind layout classes (`w-48`, `min-h-20`).
- **Dynamic Interactions**: Maintain fluid transitions but ensure focus states and disabled opacities use utility classes instead of inline styles.

## Token Reference

### 🎨 Colors (HSL Semantic Variables)
Use variables over hex values, e.g., `hsl(var(--background))`.
- **Background**: `--background`, `--card`, `--popover`
- **Surface & Borders**: `--border`, `--input`
- **Text**: `--foreground`, `--muted-foreground`
- **Actions**: `--primary`, `--secondary`, `--accent`, `--destructive`
- **Status Badges**: Semi-transparent backgrounds must use `bg-[hsl(var(--color-success)/0.15)]` style definitions or `bg-success/15` tailwind utility with CSS variable scaling.

### 📏 Spacing & Sizing
- Strict adherence to 4px/8px rhythm.
- **NEVER** use `w-[200px]`, `h-[50vh]`, `min-h-[80px]`.
- Allowed examples: `w-48`, `w-52`, `w-64`, `min-h-20`, `min-h-screen`, `h-96`.

### 🔠 Typography
- Use `text-tiny` (from Tailwind config) instead of `text-[10px]`.
- Leverage standard scales (`text-xs`, `text-sm`, `text-base`, `text-lg`).

### ✨ Opacities & Interactions
- Avoid `style={{ opacity: 0.5 }}`.
- **DO USE**: `disabled:opacity-50`, `disabled:pointer-events-none`, `data-[state=disabled]:opacity-50`.

## Aura Action Plan
- Remove arbitrary bracket notation sizing classes from components and pages.
- Standardize inline-styled opacities and widths where static, converting inline math calculations for widths (e.g., progress bars) to stable Tailwind structures if feasible, OR document that dynamic progress bars (`style={{ width: \`\${pct}%\` }}`) are acceptable exceptions.
- Verify global elements match dark theme expectations.
