# 📐 Design Style Guidelines

## 1. The Aura Design Philosophy
This project adopts a premium, refined, and uniform design system.
Our UI is built on standard Tailwind HSL tokens for consistent styling and dark mode compatibility.

## 2. Token Definitions

**Colors**
*   Background: `hsl(var(--background))`
*   Foreground (Text): `hsl(var(--foreground))`
*   Card (Surface): `hsl(var(--card))`
*   Card Foreground: `hsl(var(--card-foreground))`
*   Muted (Tertiary Surface): `hsl(var(--muted))`
*   Muted Foreground (Secondary Text): `hsl(var(--muted-foreground))`
*   Primary: `hsl(var(--primary))`
*   Destructive: `hsl(var(--destructive))`
*   Border: `hsl(var(--border))`

**Spacing & Radii**
*   Base-4 spacing model via Tailwind classes.
*   Radius values defined by `--radius`.

## 3. Legacy Variable Cleanup Mapping
*   `--bg-primary` ➔ `hsl(var(--background))`
*   `--bg-secondary` ➔ `hsl(var(--card))`
*   `--bg-tertiary` ➔ `hsl(var(--muted))`
*   `--text-primary` ➔ `hsl(var(--foreground))`
*   `--text-secondary` ➔ `hsl(var(--muted-foreground))`
*   `--text-muted` ➔ `hsl(var(--muted-foreground))`
*   `--border-primary` ➔ `hsl(var(--border))`
*   `--border-color` ➔ `hsl(var(--border))`
*   `--danger` ➔ `hsl(var(--destructive))`
*   `--accent-primary` ➔ `hsl(var(--primary))`
*   `--accent-hover` ➔ `hsl(var(--secondary))`

## 4. Typography
Use standard text scale tokens such as `text-tiny` and `text-micro` when necessary. Avoid arbitrary magic numbers like `text-[10px]`.
