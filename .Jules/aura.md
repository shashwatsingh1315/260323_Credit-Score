## 2024-05-15 - CSS Module Legacy Tokens
**Learning:** Found multiple `.module.css` files still using legacy hex-based CSS variables (e.g. `var(--text-primary)`, `var(--bg-tertiary)`, `var(--border-primary)`).
**Action:** Replace all legacy variables with the new HSL variables (e.g. `var(--foreground)`, `var(--muted)`, `var(--border)`) across all `src/**/*.module.css` files.

## 2024-05-15 - Arbitrary Tailwind Magic Numbers
**Learning:** Found multiple usages of arbitrary bracket values (e.g., `w-[200px]`, `max-w-[150px]`, `h-[50vh]`) breaking the baseline 4px/8px scalable grid.
**Action:** Replace arbitrary Tailwind classes with standard scale equivalents across React components.
