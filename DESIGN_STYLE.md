# Aura Design System Guidelines

## Core Principles
1. **Consistency is invisible but felt:** The system relies on semantic meaning rather than hardcoded visual properties.
2. **Standardization:** All colors, spacing, and typography must map to defined tokens. No magic numbers.
3. **High-Contrast & Accessibility:** Dark mode is standard; text contrast must be maintained by relying on foreground/background token pairings.

## Typography
- Use standard base-4/base-8 scales.
- **Micro/Tiny:** Use `text-tiny` (`10px`/`14px`) and `text-micro` (`11px`/`16px`) instead of arbitrary bracket notation (`text-[10px]`).
- **Headings & Body:** Use Tailwind's default sans stack, mapped to `var(--font-family)`.

## Color System (Semantic HSL Tokens)
Never hardcode hex values. Always use semantic CSS variables via Tailwind classes or `hsl(var(--token))` in custom CSS:
- **Backgrounds:** `--background`, `--card`, `--muted`, `--popover`
- **Text:** `--foreground`, `--muted-foreground`
- **Actions:** `--primary`, `--secondary`, `--accent`
- **Feedback:** `--destructive`, `--color-success`, `--color-warning`, `--color-info`
- **Borders:** `--border`, `--input`, `--ring`

## Spacing & Sizing
- Strictly adhere to Tailwind's base-4 scale.
- Avoid arbitrary bracket values (e.g., `w-[100px]`, `mt-[13px]`, `min-h-[120px]`).
- Use standard fractional or sizing tokens (e.g., `w-1/2`, `w-48`, `max-h-96`).

## Refactoring Guidelines
When refactoring legacy components:
1. Strip hardcoded hex colors and inline magic sizes.
2. Replace with appropriate Tailwind utility classes matching the token scale.
3. Ensure no component uses inline styles for layout or theming unless animating highly dynamic properties (e.g., `transform` with mouse tracking).
