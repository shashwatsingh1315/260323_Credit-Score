import re

with open('src/app/cases/[id]/CaseWorkspace.tsx', 'r') as f:
    content = f.read()

# Replace hardcoded light theme colors with generic/dark theme classes
replacements = {
    'bg-indigo-600': 'bg-primary',
    'hover:bg-indigo-700': 'hover:bg-primary/90',
    'bg-indigo-50/50': 'border-b border-border/50',
    'bg-indigo-50': 'bg-card',
    'border-indigo-200': 'border-border',
    'text-indigo-900': 'text-foreground',
    'bg-slate-50': 'bg-card',
    'border-slate-200': 'border-border',
    'text-white': 'text-primary-foreground',
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open('src/app/cases/[id]/CaseWorkspace.tsx', 'w') as f:
    f.write(content)
