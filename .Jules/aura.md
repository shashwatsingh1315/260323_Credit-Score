## 2025-05-18 - Establish Premium Design Tokens Baseline
**Learning:** The current styling heavily relies on mixed tokens and legacy variable names mapping directly to hex values without proper HSL channels, violating the premium continuous aesthetic for dark mode.
**Action:** Update `src/app/globals.css` with a strict `dark` mode HSL palette that features continuous elevations, structural whitespace rules, and properly semantic coloring. Update `tailwind.config.js` to map these exactly. Also, generate the baseline `DESIGN_STYLE.md`.
