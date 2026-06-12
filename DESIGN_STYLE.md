# High-End Design Style Document

## Core Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user.

## Tokens & Standards
- **Typography:** Use semantic tokens (`text-tiny`, `text-sm`, `text-base`). No arbitrary font sizes (`text-[10px]`, `text-[11px]`).
- **Dimensions:** Strictly use standard Tailwind base-4/base-8 spacing and sizing tokens (`w-48` = 192px, `w-52` = 208px -> replace `w-[200px]` with closest standard token, typically `w-48` or `w-64` depending on context). No bracket notation (`w-[200px]`, `min-h-[80px]`).
- **Positioning:** Use fractional tokens (`left-1/2`, `-translate-x-1/2`, `-translate-y-1/2`) instead of percentages in brackets (`left-[50%]`).
- **Colors:** Use standard HSL tokens from `globals.css` (e.g., `bg-primary`, `text-muted-foreground`).

## Guidelines
1. Eradicate all `text-[10px]` and `text-[11px]`. Replace with `text-tiny`.
2. Eradicate all `w-[...]`, `h-[...]`, `min-h-[...]`, `max-w-[...]`, `max-h-[...]`. Replace with closest standard sizes.
3. Eradicate `left-[50%]`, `top-[50%]`, `translate-x-[-50%]`, `translate-y-[-50%]`. Replace with `-1/2` and `1/2` respectively.
4. Eradicate `w-[1px]` or `h-[1px]`. Replace with `w-px` or `h-px`.
