# Design Style Guide & Design System

## Core Aesthetics
- **Premium, Clean, High-Contrast**: Designed with high-end principles focusing on crisp typography, rigorous structural consistency, and deep, semantic color usage.
- **Unified Tokens**: Styles must strictly adhere to the HSL-based design token scale for full dark mode and semantic support.

## Color Tokens & Mappings
The legacy hex-based CSS variable approach has been deprecated to scale properly with light/dark modes. All new implementations and refactors must use standard Tailwind HSL tokens:

| Legacy Token | New Semantic HSL Token |
| --- | --- |
| `--bg-primary` | `hsl(var(--background))` |
| `--bg-secondary` | `hsl(var(--card))` |
| `--bg-tertiary` | `hsl(var(--muted))` |
| `--text-primary` | `hsl(var(--foreground))` |
| `--text-secondary` | `hsl(var(--muted-foreground))` |
| `--text-muted` | `hsl(var(--muted-foreground))` |
| `--border-primary` | `hsl(var(--border))` |
| `--border-color` | `hsl(var(--border))` |
| `--danger` | `hsl(var(--destructive))` |
| `--accent-primary` | `hsl(var(--accent))` |
| `--accent-hover` | `hsl(var(--accent))` *(with opacity/interaction mods)* |

## Spacing & Sizing Rhythm
- **Rhythm**: All paddings, margins, gaps, and structural heights must use the standard base-4/base-8 spacing scales.
- **Rule**: Avoid arbitrary magic numbers (e.g., `mt-[13px]`, `w-[200px]`). Use strict tailwind sizing values (e.g., `mt-4`, `w-48`).

## Typography
- Fonts are restricted to standard tokens.
- Use the predefined scales (e.g., `text-sm`, `text-tiny`, `text-micro`).
- *Never* use arbitrary bracket text sizing (e.g., `text-[11px]`).

## Enforcement
All component refactors should cleanly extract hardcoded and misaligned styles to rely strictly on this token schema. Avoid modifying underlying component logic when making these design adjustments.
