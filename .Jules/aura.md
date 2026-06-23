## 2025-02-23 - CSS Module Token Audit
**Learning:** The legacy CSS modules in the app relied on non-scalable, hardcoded hex-based custom CSS properties (`var(--bg-primary)`, `var(--text-primary)`, etc.).
**Action:** Replaced all legacy CSS variable usages in `.module.css` files with proper Tailwind HSL tokens (e.g., `hsl(var(--background))`) mapped to standard values.
