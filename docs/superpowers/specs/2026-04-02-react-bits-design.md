# React Bits Integration & UI Refactoring Design

## Overview
This document outlines the architectural and aesthetic changes required to refactor the Credit Score dashboard using the React Bits library. The goal is to elevate the application's visual impact, making it feel "next-generation," modern, and highly polished, while retaining a professional, light-themed, data-focused B2B aesthetic (Option A: "Subtle Polish").

## 1. Aesthetic Direction (Option A: Subtle Polish)
*   **Theme:** Professional, light-mode financial dashboard.
*   **Animation Strategy:** Animations are used for micro-interactions and initial page load to create a premium feel without distracting from the data. 
*   **Key Interactions:** Fluid text reveals on headers, subtle hover effects on interactive elements, and staggered loading for lists/tables.
*   **Color Palette:** Clean white/light-gray backgrounds with semantic, purpose-driven accent colors (info, success, warning, destructive) replacing scattered hardcoded utility classes.

## 2. Design Token System
We will implement a compact, centralized design token system to replace hardcoded utility classes (e.g., `bg-blue-400/10`) and ensure consistency.

### 2.1 CSS Variables & Tailwind Config (`globals.css` & `tailwind.config.js`)
We will define semantic CSS variables that Tailwind will consume:
*   **Surfaces:** 
    *   `--surface-background` (Page background, e.g., `#f8fafc`)
    *   `--surface-card` (Component background, e.g., `#ffffff`)
    *   `--surface-hover` (Interactive state background)
*   **Borders:** 
    *   `--border-subtle` (Light dividers, e.g., `#e2e8f0`)
*   **Text:**
    *   `--text-primary` (Headings, primary data, e.g., `#0f172a`)
    *   `--text-secondary` (Labels, metadata, e.g., `#64748b`)
*   **Semantic Colors (used for Badges/Icons):**
    *   `--color-info`, `--color-success`, `--color-warning`, `--color-destructive` (defined with light background variants for soft contrast).
*   **Animation Tokens:**
    *   Standardized easing curves (e.g., `cubic-bezier(0.4, 0, 0.2, 1)`)
    *   Standardized durations (e.g., `150ms` for hover, `500ms` for entrance).

### 2.2 Component Consolidation
Existing generic UI components in `src/components/ui/` (e.g., `card.tsx`, `badge.tsx`, `table.tsx`) will be updated to strictly consume these semantic tokens.

## 3. React Bits Integration Strategy
We will introduce a `src/components/animations/` directory to house React Bits components, ensuring they are configured to use our Tailwind tokens.

### 3.1 Initial Load & Headers
*   **Component:** `BlurText` or `SplitText` (from React Bits).
*   **Usage:** Applied to the main page headers (e.g., "Dashboard", "Credit Issuance System Overview") so they fluidly fade and slide into place on load.

### 3.2 Stat Cards Upgrade
*   **Component:** `SpotlightCard` or a subtle `HoverEffect` wrapper (from React Bits), plus an animated number counter (e.g., `CountUp`).
*   **Usage:** The 6 top-level stat cards will lose their hardcoded background colors and instead use semantic tokens. The cards will feature a subtle spotlight/glow effect that tracks the user's cursor, and the numbers will animate from 0 to their value on load.

### 3.3 Data Tables & Lists
*   **Component:** `StaggeredFade` (Custom or React Bits wrapper).
*   **Usage:** When "Recent Cases" or "Upcoming Tranches" lists load, the rows will fade in sequentially (staggered) rather than appearing instantly in a block.

## 4. Execution Plan Summary
1.  **Token Setup:** Define CSS variables in `globals.css` and map them in `tailwind.config.ts`.
2.  **UI Component Refactor:** Update base components (`card`, `badge`, etc.) to use the new semantic tokens.
3.  **React Bits Setup:** Add necessary dependencies (e.g., `framer-motion` if required by React Bits) and create the `src/components/animations/` folder.
4.  **Implement Animations:** Add `BlurText` to headers, `SpotlightCard` and `CountUp` to stat cards, and staggered animations to lists.
5.  **Clean Up:** Remove hardcoded layout/color utilities from `page.tsx` and replace them with the new tokenized components.