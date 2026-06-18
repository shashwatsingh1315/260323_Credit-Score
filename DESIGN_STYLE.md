# Aura Design System Guidelines

## Core Philosophy
- True elegance comes from rigorous consistency.
- A unified design system is invisible but deeply felt by the user.
- Premium design relies on purposeful whitespace, crisp typography, and high-contrast intentional colors.
- Hardcoded styles are technical debt; design tokens are scalable assets.

## Tokenization Rules
- **Spacing:** STRICTLY use standard Tailwind spacing scales (`gap-2`, `p-4`, `m-6`, etc.). NO arbitrary magic numbers (e.g., `gap-[13px]`, `px-[17px]`).
- **Typography:** STRICTLY use standard Tailwind font scales and specific tokens (`text-tiny`, `text-micro`). NO arbitrary sizes (`text-[11px]`, `text-[10px]`).
- **Sizing:** Use standard width and height classes. NO arbitrary bracket sizes if they map to a spacing token (e.g. `w-[200px]` should be avoided or replaced if possible, unless it's a fixed structural boundary).
- **Colors:** Use CSS variables/theme extensions defined in `tailwind.config.js`. Avoid any direct Hex codes (`#123456`) in React components.

## Recent Learnings
* See `.Jules/aura.md`
