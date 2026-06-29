# High-End Design Style Document

## Typography Scale
We use standard Tailwind scales along with custom micro-typography for detailed operational interfaces.

| Token | Class | Size | Line Height | Usage |
|---|---|---|---|---|
| Tiny | `text-tiny` | 10px | 14px | Microcopy, alerts, badges |
| Micro | `text-micro` | 11px | 16px | Data table metadata, collections sub-labels |
| XS | `text-xs` | 12px | 16px | Standard metadata |

## Spacing & Sizing
Always use standard base-4 and base-8 spacing tokens. **Never use arbitrary bracket values.**

| Avoid | Use |
|---|---|
| `w-[200px]` | `w-48` (192px) or `w-56` (224px) |
| `min-h-[80px]` | `min-h-20` (80px) |
| `min-w-[260px]` | `min-w-64` (256px) |
| `h-[50vh]` | `h-[50vh]` (acceptable for layout bounds) |

## Layout Properties
Avoid bracket percentage translations when standard utility classes exist.

| Avoid | Use |
|---|---|
| `left-[50%]` | `left-1/2` |
| `translate-x-[-50%]` | `-translate-x-1/2` |
| `translate-y-[-50%]` | `-translate-y-1/2` |
