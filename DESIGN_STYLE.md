# 💅 DESIGN_STYLE.md - Aura UX Guidelines

## Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user.

## Tokens & Standards

### 1. Colors (Tailwind Variables)
We rely on standard CSS custom properties defined in `src/app/globals.css` and mapped in `tailwind.config.js`.

**Backgrounds**
- `bg-background`: Main app background (slate-50 / dark: slate-900).
- `bg-card`: Surface background for cards, modals, and isolated content (white / dark: slate-800).
- `bg-muted`: Secondary or disabled backgrounds.

**Foregrounds (Text)**
- `text-foreground`: Primary text color.
- `text-muted-foreground`: Secondary or helper text.

**Interactive & Semantic**
- `primary`: Main brand color. Use `bg-primary text-primary-foreground`.
- `secondary`: Secondary actions.
- `destructive`: Errors, dangerous actions.
- `success`, `warning`, `info`, `attention`: Contextual states.

### 2. Spacing & Layout
Strictly use Tailwind base-4/base-8 rhythm.
- `p-2`, `p-4`, `p-6`, `p-8`.
- `gap-2`, `gap-4`, `gap-6`.
- **NEVER** use magic numbers like `p-[13px]`.

### 3. Typography
- Rely on Tailwind standard scales: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`.
- Use `font-medium` or `font-semibold` for emphasis, not custom weights.

### 4. Borders & Radius
- Use standard radii: `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full`.
- Use `border border-border` for standard outlines.

## Anti-Patterns
- 🚫 `className="bg-[#1a1a1a]"` -> Use `className="bg-card"`
- 🚫 `className="text-[#64748b]"` -> Use `className="text-muted-foreground"`
- 🚫 `className="p-[15px]"` -> Use `className="p-4"`
