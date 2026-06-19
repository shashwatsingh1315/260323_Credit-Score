## 2025-03-05 - Legacy Color Variables Blocking Dark Mode
**Learning:** The application heavily utilizes legacy hardcoded hex variables (e.g., --bg-primary, --text-primary) directly in CSS modules, breaking the application's global dark mode compatibility and HSL-based Tailwind design system. Also relies on tailwind magic number variables.
**Action:** Establish a strict mapping to the new Tailwind HSL tokens (e.g., hsl(var(--background))) in DESIGN_STYLE.md and systemically replace all instances across CSS modules.
