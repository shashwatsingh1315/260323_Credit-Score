# High-End Design Style Document

## Core Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user. Premium design relies on purposeful whitespace, crisp typography, and high-contrast intentional colors.

## Token Standards

### 1. Typography
- **Font Stack:** Inter (Sans Serif)
- **Scale:**
  - `text-tiny`: 10px (line-height 14px) - Used for metadata, badges, strict upper-case tracking.
  - `text-xs`: 12px - Small details, secondary table text.
  - `text-sm`: 14px - Primary body text, UI elements, input text.
  - `text-base`: 16px - Standard readable paragraph text.
  - `text-lg` to `text-4xl`: Hierarchical headings.

### 2. Spacing & Layout
Strictly use Tailwind's Base-4 (and Base-8) spacing increments.
- Do not use arbitrary numbers (e.g., `w-[200px]`, `p-[17px]`).
- Example Mappings:
  - `w-[200px]` -> `w-48` (192px) or `w-52` (208px)
  - `h-[50vh]` -> Use standard Flexbox/Grid or min-height tokens if absolutely needed, but avoid fixed pixel heights where standard layout paradigms work better.
  - `text-[10px]` -> `text-tiny`
  - `text-[11px]` -> `text-xs`
  - `max-w-[200px]` -> `max-w-xs` or relative limits.
  - `max-h-[400px]` -> `max-h-96` (384px)

### 3. Colors
- Stick *strictly* to the semantic tokens defined in `src/app/globals.css` and `tailwind.config.js`.
- Never use hex codes directly in the components (e.g., `#ffffff`, `#141414`).
- Use HSL-based Tailwind tokens:
  - `bg-background`, `bg-card`, `bg-muted`
  - `text-foreground`, `text-muted-foreground`
  - `border-border`
  - `text-destructive`, `text-warning`, `text-success`

### 4. Borders & Radii
- Use `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`.
- Never use arbitrary `rounded-[5px]`.

### 5. Best Practices
- Consistently use `uppercase tracking-wider` or `tracking-widest` alongside `font-bold` and `text-tiny` for microscopic metadata tags.
