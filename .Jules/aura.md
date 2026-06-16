## 2025-05-10 - Migrate Legacy Hex Variables to Tailwind HSL Tokens
**Learning:** The application uses standard Tailwind HSL tokens in CSS modules (e.g., `hsl(var(--background))`), but legacy hex CSS variables are still present in multiple CSS module files. This directly conflicts with the new design tokens and breaks dark mode scalability.
**Action:** Replace all legacy variables throughout the codebase as follows: `--bg-primary` -> `--background`, `--bg-secondary` -> `--card`, `--bg-tertiary` -> `--muted`, `--text-primary` -> `--foreground`, `--text-secondary`/`--text-muted` -> `--muted-foreground`, `--border-primary`/`--border-color` -> `--border`, and `--danger` -> `--destructive`.

## 2025-05-10 - Form Input Styling Bug in Dark Mode
**Learning:** Global form inputs (select, option, input, textarea) use legacy variable `var(--bg-tertiary)` in `globals.css` instead of semantic HSL tokens, causing potential white-on-white rendering bugs.
**Action:** Apply explicit background and text colors using semantic HSL tokens (`hsl(var(--background))`, `hsl(var(--foreground))`) in `src/app/globals.css`.
