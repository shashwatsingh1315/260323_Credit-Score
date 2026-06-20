# DESIGN STYLE GUIDE

## AURA - The High-End Aesthetic

This document outlines the strict design rules and scalable tokens we use to build our premium application interface.

### The Problem with Hardcoded Values

Hardcoded hex values and arbitrary spacing create a chaotic and inconsistent user interface.
- They break dark mode when mixed with colors that should be semantic.
- They prevent universal theming updates.
- They create technical debt and maintenance nightmares.

### Spacing Tokens (Base-4 scale)

Never use arbitrary padding or margins (like `mt-[13px]`). Only use our base-4/base-8 spacing scale.

*   `1` = 0.25rem (4px)
*   `2` = 0.5rem (8px)
*   `3` = 0.75rem (12px)
*   `4` = 1rem (16px)
*   `5` = 1.25rem (20px)
*   `6` = 1.5rem (24px)
*   `8` = 2rem (32px)
*   `10` = 2.5rem (40px)
*   `12` = 3rem (48px)
*   `16` = 4rem (64px)

### Sizing (Width/Height)

Use the predefined sizing classes instead of arbitrary values like `w-[200px]`, `w-[100px]`, or `w-[50px]`:

*   `20` = 5rem (80px)
*   `24` = 6rem (96px)
*   `32` = 8rem (128px)
*   `40` = 10rem (160px)
*   `48` = 12rem (192px)
*   `64` = 16rem (256px)

### Typography Tokens

Never use arbitrary sizes like `text-[10px]` or `text-[11px]`. We've defined specialized tokens for small text in our tailwind config:

*   `text-tiny` - Use for 10px fonts
*   `text-micro` - Use for 11px fonts
*   `text-xs` - Use for 12px fonts
*   `text-sm` - Use for 14px fonts

### Border Sizing

*   Use standard border width `border` (1px) or `border-2` instead of `h-[1px]` or `w-[1px]` for horizontal/vertical dividers or separators when possible.
*   For separators/dividers specifically, `w-px` or `h-px` is the correct standard tailwind class over `w-[1px]`.
