# CreditFlow Design System & Style Guide

## 📐 The Vision
CreditFlow aims to present a highly refined, premium aesthetic. Our UI must be uniform, accessible, and intuitive.

## 🎨 Color Tokens (Semantic Scales)
We use a semantic HSL variable scale implemented via Tailwind CSS variables. **Never use hardcoded hex values in component files.**

- **Background:** `hsl(var(--background))`
- **Surface/Card:** `hsl(var(--card))`
- **Text Primary:** `hsl(var(--foreground))`
- **Text Muted:** `hsl(var(--muted-foreground))`
- **Border:** `hsl(var(--border))`
- **Brand/Primary:** `hsl(var(--primary))`
- **Destructive/Error:** `hsl(var(--destructive))`

## 📏 Spacing & Sizing
Always use standard base-4 Tailwind spacing tokens. Avoid arbitrary `[]` bracket notation for margin, padding, height, and width.
- `p-4`, `m-2`, `gap-3`, `h-96`, `w-48`
- For 1px elements, use `h-px` or `w-px`.

## ✍️ Typography
Maintain standard Tailwind sizing. Avoid arbitrary sizing like `text-[10px]`.
- Tiny text (10px): Use `text-tiny` (Configured in Tailwind)
- Small text: Use `text-xs` (12px) or `text-sm` (14px)

## 🔲 Borders & Radii
- Standard radius: `rounded-lg` or `rounded-xl`. Avoid `rounded-[10px]`.
- Elevation: Use standard shadow tokens (`shadow-sm`, `shadow-md`, `shadow-lg`).

## 🛑 Anti-Patterns (Do Not Use)
- `bg-[#f0f0f0]` or `text-[#333]`
- `px-[15px]` or `w-[200px]`
- Legacy CSS variables like `--bg-primary` or `--text-primary`
