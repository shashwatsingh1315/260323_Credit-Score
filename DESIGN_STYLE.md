# Aura Design System & Style Guidelines

This document serves as the absolute source of truth for the credit issuance application's visual language. All refactors, UI updates, and new component builds must strictly adhere to the tokens and rules established here.

## Philosophy

- **Unified:** A design system is invisible but deeply felt by the user.
- **Premium:** Purposeful whitespace, crisp typography, and high-contrast intentional colors.
- **Scalable:** Hardcoded styles are technical debt; design tokens are scalable assets.

## The Standard (Design Tokens)

### 1. Typography

Always use standard Tailwind typography tokens. Avoid arbitrary `text-[10px]` or `text-[11px]`.
- `text-tiny`: `['10px', '14px']` - For tertiary meta-labels, rails, very small badges.
- `text-micro`: `['11px', '16px']` - For secondary table meta text, small dense lists.
- `text-xs`: Standard small text.
- `text-sm`: Standard body text in cards/tables.
- `text-base`: Primary inputs, dialog text.
- `text-lg`/`xl`/`2xl`/etc.: Headings.

### 2. Spacing & Sizing

Strict adherence to the base-4 Tailwind scale is required. Do not use magic numbers like `w-[200px]` or `min-h-[80px]`.
- Replace `w-[200px]` with `w-48` (192px) or `w-52` (208px).
- Replace `h-[80px]` or `min-h-[80px]` with `h-20` or `min-h-20` (80px).
- Replace `h-[1px]` or `w-[1px]` with `h-px` or `w-px`.
- Replace percentages `left-[50%]` with standard fractions `left-1/2`.
- Replace Viewport constraints `h-[50vh]` with `h-[50vh]` (acceptable only if no equivalent utility class exists, but consider `h-1/2` if relative to a fixed container).

### 3. Colors

All colors must use semantic `hsl(var(--name))` tokens via Tailwind classes. No hex values allowed.
- Backgrounds: `bg-background`, `bg-card`, `bg-muted`
- Text: `text-foreground`, `text-muted-foreground`
- Borders: `border-border`, `border-input`
- Actions: `bg-primary`, `text-primary-foreground`
- Statuses: `text-success`, `text-warning`, `text-destructive`, `text-info`

## Refactor Checklists

Before raising a UI PR, verify:
- [ ] No hardcoded hex colors (`#FF0000`).
- [ ] No arbitrary pixel values in brackets (`w-[17px]`, `mt-[13px]`, `text-[11px]`).
- [ ] All borders use `border-border` unless semantically different.
- [ ] All shadows use standard tokens (`shadow-sm`, `shadow-md`).
- [ ] Keyboard focus is clearly visible via `focus-visible:ring-ring`.
