## 2024-05-19 - [Legacy CSS Custom Properties Cleanup]
**Learning:** Legacy CSS files use custom properties mapped to hex codes instead of standard Tailwind design tokens (e.g., `var(--bg-primary)` instead of `hsl(var(--background))`). This blocks consistent theming and dark mode capabilities.
**Action:** Remove all instances of hardcoded CSS variables (`--bg-primary`, `--text-primary`, etc.) from `.module.css` and `globals.css` files, replacing them with the Tailwind HSL token equivalents (e.g., `hsl(var(--background))`).
