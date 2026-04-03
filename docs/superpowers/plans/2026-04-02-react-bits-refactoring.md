# React Bits Dashboard Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Credit Score dashboard to use a light-themed, professional aesthetic with React Bits animated components.

**Architecture:** We are migrating from a dark, utility-class-heavy theme to a semantic light theme using CSS variables in `globals.css` and `tailwind.config.js`. We introduce standard animation components (`BlurText`, `SpotlightCard`, `CountUp`, `StaggeredFade`) using `framer-motion` to elevate the UI without distracting from data.

**Tech Stack:** Next.js 15, Tailwind CSS, Framer Motion, React 19

---

### Task 1: Setup Dependencies and Global Tokens

**Files:**
- Modify: `package.json`
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.js`

- [ ] **Step 1: Install Framer Motion**

Run: `npm install framer-motion`
Expected: Installation succeeds.

- [ ] **Step 2: Update CSS Variables to Light Theme**

Replace the `:root` variables in `src/app/globals.css` (around lines 5-34) to use a light theme palette:

```css
@layer base {
  :root {
    --background: 210 40% 98%;      /* #f8fafc */
    --foreground: 222 47% 11%;      /* #0f172a */
    --card: 0 0% 100%;              /* #ffffff */
    --card-foreground: 222 47% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;
    --primary: 222 47% 11%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222 47% 11%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222 47% 11%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.75rem;

    --bg-primary: #f8fafc;
    --bg-secondary: #ffffff;
    --bg-tertiary: #f1f5f9;
    --text-primary: #0f172a;
    --text-secondary: #64748b;
    --text-muted: #94a3b8;
    --accent-primary: #cbd5e1;
    --accent-hover: #e2e8f0;
    --border-primary: #e2e8f0;
    --border-color: #e2e8f0;
    
    --color-success: 142.1 70.6% 45.3%;
    --color-warning: 38 92% 50%;
    --color-destructive: 0 84.2% 60.2%;
    --color-info: 221.2 83.2% 53.3%;
    
    --font-family: 'Inter', -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
  }
}
```

- [ ] **Step 3: Update Badge Component Base CSS**

In `src/app/globals.css`, replace the `.badge.success`, `.badge.warning`, `.badge.danger`, and `.badge.info` rules (around lines 58-61):

```css
.badge.success { @apply bg-emerald-100 text-emerald-700 border-emerald-200; }
.badge.warning { @apply bg-amber-100 text-amber-700 border-amber-200; }
.badge.danger  { @apply bg-red-100 text-red-700 border-red-200; }
.badge.info    { @apply bg-blue-100 text-blue-700 border-blue-200; }
```

- [ ] **Step 4: Update Tailwind Config**

Add semantic colors to the `theme.extend.colors` object in `tailwind.config.js`:

```javascript
        success: {
          DEFAULT: 'hsl(var(--color-success))',
        },
        warning: {
          DEFAULT: 'hsl(var(--color-warning))',
        },
        info: {
          DEFAULT: 'hsl(var(--color-info))',
        },
```

- [ ] **Step 5: Commit changes**

```bash
git add package.json package-lock.json src/app/globals.css tailwind.config.js
git commit -m "chore: setup light theme design tokens and install framer-motion"
```

### Task 2: Implement React Bits Animated Components

**Files:**
- Create: `src/components/animations/BlurText.tsx`
- Create: `src/components/animations/SpotlightCard.tsx`
- Create: `src/components/animations/CountUp.tsx`
- Create: `src/components/animations/StaggeredFade.tsx`

- [ ] **Step 1: Create `BlurText.tsx`**

Create `src/components/animations/BlurText.tsx` with the following content:

```tsx
"use client";
import { motion } from "framer-motion";

export function BlurText({ text, className = "" }: { text: string; className?: string }) {
  const letters = text.split("");

  return (
    <span className={`inline-block ${className}`}>
      {letters.map((letter, i) => (
        <motion.span
          key={i}
          initial={{ filter: "blur(10px)", opacity: 0, y: 10 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: i * 0.03,
            ease: [0.4, 0, 0.2, 1],
          }}
          className="inline-block"
        >
          {letter === " " ? "\u00A0" : letter}
        </motion.span>
      ))}
    </span>
  );
}
```

- [ ] **Step 2: Create `SpotlightCard.tsx`**

Create `src/components/animations/SpotlightCard.tsx` with the following content:

```tsx
"use client";
import { useRef, useState } from "react";
import { motion } from "framer-motion";

export function SpotlightCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <motion.div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, rgba(15, 23, 42, 0.04), transparent 40%)`,
        }}
      />
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 3: Create `CountUp.tsx`**

Create `src/components/animations/CountUp.tsx` with the following content:

```tsx
"use client";
import { useEffect, useState } from "react";
import { animate } from "framer-motion";

export function CountUp({ to, duration = 1.5 }: { to: number; duration?: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, to, {
      duration,
      ease: "easeOut",
      onUpdate(value) {
        setValue(Math.round(value));
      },
    });
    return () => controls.stop();
  }, [to, duration]);

  return <span>{value.toLocaleString('en-IN')}</span>;
}
```

- [ ] **Step 4: Create `StaggeredFade.tsx`**

Create `src/components/animations/StaggeredFade.tsx` with the following content:

```tsx
"use client";
import { motion } from "framer-motion";
import { ReactNode } from "react";

export function StaggeredFade({ children, delay = 0.1 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 5: Commit changes**

```bash
git add src/components/animations/
git commit -m "feat: add React Bits animated components"
```

### Task 3: Refactor UI Base Components

**Files:**
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: Update Badge Variants**

Replace the `badgeVariants` definition in `src/components/ui/badge.tsx` to align with the new semantic light-theme tokens:

```tsx
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-red-100 text-red-800 border-red-200",
        outline: "text-foreground",
        success: "border-transparent bg-emerald-100 text-emerald-800 border-emerald-200",
        warning: "border-transparent bg-amber-100 text-amber-800 border-amber-200",
        info: "border-transparent bg-blue-100 text-blue-800 border-blue-200",
      },
    },
    defaultVariants: { variant: "default" },
  }
);
```

- [ ] **Step 2: Commit changes**

```bash
git add src/components/ui/badge.tsx
git commit -m "refactor: update Badge component to use semantic light theme variants"
```

### Task 4: Integrate Animations and Tokens into Dashboard

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Import Animation Components**

Add the following imports at the top of `src/app/page.tsx` (after the existing imports):

```tsx
import { BlurText } from '@/components/animations/BlurText';
import { SpotlightCard } from '@/components/animations/SpotlightCard';
import { CountUp } from '@/components/animations/CountUp';
import { StaggeredFade } from '@/components/animations/StaggeredFade';
```

- [ ] **Step 2: Update Header with `BlurText`**

Around line 253, replace the static `<h1>` with the `BlurText` component:

```tsx
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          <BlurText text="Dashboard" />
        </h1>
        <p className="text-muted-foreground mt-0.5 text-sm">Credit Issuance System Overview</p>
      </div>
```

- [ ] **Step 3: Update `stats` Array Colors**

Around line 235, update the `stats` array's `color` and `bg` properties to use Tailwind's semantic colors rather than hardcoded blue/amber shades. Change:

```tsx
  const stats = [
    { label: 'Total Cases', value: totalCases || 0, icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'In Review', value: inReview || 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Awaiting Approval', value: awaitingApproval || 0, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Approved', value: approved || 0, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Billing Active', value: billingActive || 0, icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Parties', value: totalParties || 0, icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  ];
```

- [ ] **Step 4: Refactor Stat Cards Grid to use `SpotlightCard` and `CountUp`**

Around line 260, replace the `Card` rendering loop:

```tsx
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <SpotlightCard key={i}>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <Icon size={18} className={s.color} />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{s.label}</span>
                </div>
                <div className="text-3xl font-bold text-foreground">
                  <CountUp to={s.value} />
                </div>
              </div>
            </SpotlightCard>
          );
        })}
      </div>
```

- [ ] **Step 5: Ensure Build Succeeds**

Run: `npm run build`
Expected: Next.js builds successfully without errors.

- [ ] **Step 6: Commit changes**

```bash
git add src/app/page.tsx
git commit -m "feat: refactor Dashboard with React Bits animations and light theme"
```