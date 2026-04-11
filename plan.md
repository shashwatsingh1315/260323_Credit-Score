1. Create `DESIGN_STYLE.md` to define the Aura design system tokens, typography, spacing, radii, and shadows, as well as aesthetic principles (e.g., premium continuous curves, semantic colors, multi-stop elevations).
2. Update `tailwind.config.js` to use `<alpha-value>` for all CSS variable colors, allowing Tailwind opacity modifiers to work correctly (e.g. `hsl(var(--primary) / <alpha-value>)`).
3. Refactor `src/app/globals.css`:
   - Remove legacy hex variables (`--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-primary`, `--accent-hover`, `--border-primary`, `--border-color`).
   - Fix global form input styles (`select`, `option`, `input`, `textarea`) to use semantic HSL tokens (`hsl(var(--background))`, `hsl(var(--foreground))`) instead of the legacy variables.
   - Update `badge` utility classes to use proper alpha division syntax for CSS variables if applicable.
4. Refactor `src/components/Shell.module.css` (and any other `.module.css` files) to replace legacy variables with semantic HSL tokens (e.g., `hsl(var(--background))`, `hsl(var(--foreground))`, `hsl(var(--border))`, `hsl(var(--muted))`, `hsl(var(--destructive))`).
5. Fix inline styles in components like `src/app/cases/new/page.tsx` where disabled states use `style={{ opacity: ... }}`. Replace them with Tailwind modifiers like `disabled:opacity-50 disabled:pointer-events-none`.
6. Add an entry to `.Jules/aura.md` logging the critical design system learnings (legacy hex codes and alpha-value support).
7. Complete pre-commit steps to make sure proper testing, verifications, reviews, and reflections are done.
