## 2024-04-11 - Tokenizing Legacy Variables
**Learning:** The legacy CSS variables in `globals.css` used hex codes directly, preventing them from supporting opacity modifiers correctly in Tailwind classes (e.g. `bg-primary/50`).
**Action:** The global variable scale must be refactored to use standard HSL syntax values (e.g. `210 40% 98%`), and mapped into `tailwind.config.js` via the `<alpha-value>` interpolator (e.g. `hsl(var(--primary) / <alpha-value>)`).
