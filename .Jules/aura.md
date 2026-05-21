## 2025-05-21 - [Aesthetic Initialization]
**Learning:** Investigated root globals.css and tailwind configs. Saw legacy hex variables mixed with HSL tokens. Need to establish unified design pattern across system.
**Action:** Enforce HSL usage moving forward and write DESIGN_STYLE.md.

## 2025-05-21 - [Typography Anti-Patterns]
**Learning:** Found multiple instances of `text-[10px]` magic numbers in CollectionsClient, NewCaseForm, StagesTab, TaskCompleteForm. We need to strictly enforce the `text-tiny` scale defined in tailwind.config.js `['10px', '14px']`.
**Action:** Refactor all `text-[10px]` to `text-tiny`.
