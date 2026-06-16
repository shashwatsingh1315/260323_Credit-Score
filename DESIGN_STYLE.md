# Aura Design System (Draft)
The goal is to replace all legacy hex CSS vars with new standard HSL-based Tailwind tokens.

* `--bg-primary` -> `var(--background)` / `bg-background`
* `--bg-secondary` -> `var(--card)` / `bg-card`
* `--bg-tertiary` -> `var(--muted)` / `bg-muted`
* `--text-primary` -> `var(--foreground)` / `text-foreground`
* `--text-secondary` -> `var(--muted-foreground)` / `text-muted-foreground`
* `--text-muted` -> `var(--muted-foreground)` / `text-muted-foreground`
* `--border-color` -> `var(--border)` / `border-border`
* `--border-primary` -> `var(--border)` / `border-border`

* Remove all bracket arbitrary values for spacing `w-[200px]` -> `w-48` or `w-64`, etc.
