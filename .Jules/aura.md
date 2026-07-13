## 2024-05-15 - CSS Module Token Standardization
**Learning:** Legacy CSS modules were heavily relying on custom hex-based variables (e.g., `--bg-primary`, `--text-primary`) which breaks the HSL-based Tailwind design system and restricts dark mode scalability.
**Action:** Replaced all instances of legacy variables in `.module.css` and `.css` files with `hsl(var(--token))` structure to map consistently back to `tailwind.config.js` scales.
