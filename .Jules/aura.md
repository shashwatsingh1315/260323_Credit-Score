## 2025-04-02 - Baseline High-End Configuration
Learning: The current `globals.css` mixes standard CSS hex variables (`--bg-primary`, `--text-secondary`) with semantic HSL tokens (`--background`, `--foreground`), which breaks Tailwind's alpha compositing (e.g., `bg-primary/50`). It also lacks a cohesive dark mode configuration, making the app fall back to default browser or inverted styles.
Action: Normalize all structural colors to semantic HSL tokens with exact high-contrast dark mode pairs. Remove hardcoded hex codes. Update `tailwind.config.js` to rely entirely on this rigorous new token scale.

## 2025-04-02 - Token Refactor Scope
Learning: The codebase heavily utilizes CSS modules (`*.module.css`) with hardcoded legacy variables like `--bg-tertiary`, `--text-primary`, `--border-primary`. This creates a fragmented design system since Tailwind isn't fully integrated into these module files.
Action: In addition to replacing hex colors in `globals.css` with semantic tokens, we must perform a targeted refactor across all `.module.css` files to replace `var(--bg-primary)` with `var(--background)`, `var(--text-primary)` with `var(--foreground)`, etc., ensuring global consistency with the Aura design system.
