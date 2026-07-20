import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MACRO_RAIL, getMacroPhase } from '@/lib/vocabulary';

/**
 * Macro progress rail (doctrine §10, §13.5).
 * One authoritative orientation model: Draft → Review → Decision → Approved →
 * Terms accepted → Billing & collections → Closed.
 * Detailed state (stage, round, waiting reason) appears underneath — never as
 * a competing status system.
 */
export function MacroProgressRail({
  status,
  detail,
  className,
}: {
  status: string;
  /** e.g. "Stage 2 · 4 of 6 tasks complete" — rendered under the current node. */
  detail?: string | null;
  className?: string;
}) {
  const current = getMacroPhase(status);
  const currentIdx = MACRO_RAIL.findIndex((n) => n.key === current);
  // Terminal-but-not-"Closed" outcomes (rejected/withdrawn/expired) still map to 'closed'.

  return (
    <nav aria-label="Case lifecycle progress" className={cn('w-full', className)}>
      <ol className="flex items-start w-full">
        {MACRO_RAIL.map((node, i) => {
          const state = i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming';
          return (
            <li key={node.key} className="flex-1 flex flex-col items-center relative min-w-0">
              {/* connector line */}
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-[9px] right-1/2 w-full h-px',
                    i <= currentIdx ? 'bg-primary/60' : 'bg-border'
                  )}
                />
              )}
              <span
                aria-current={state === 'current' ? 'step' : undefined}
                className={cn(
                  'relative z-10 flex items-center justify-center rounded-full border shrink-0',
                  'w-[18px] h-[18px] text-[10px]',
                  state === 'done' && 'bg-primary/80 border-primary text-primary-foreground',
                  state === 'current' && 'bg-background border-primary ring-2 ring-primary/25',
                  state === 'upcoming' && 'bg-background border-border'
                )}
              >
                {state === 'done' ? (
                  <Check size={11} strokeWidth={3} aria-hidden="true" />
                ) : (
                  <span className={cn('w-1.5 h-1.5 rounded-full', state === 'current' ? 'bg-primary' : 'bg-border')} />
                )}
              </span>
              <span
                className={cn(
                  'mt-1.5 text-[10px] leading-tight text-center px-0.5 hidden sm:block',
                  state === 'current' ? 'font-semibold text-foreground' : 'text-muted-foreground'
                )}
              >
                {node.label}
              </span>
              {state === 'current' && (
                <span className="sm:hidden mt-1 text-[10px] font-semibold text-foreground">{node.label}</span>
              )}
            </li>
          );
        })}
      </ol>
      {detail && (
        <p className="mt-2 text-xs text-muted-foreground text-center">{detail}</p>
      )}
    </nav>
  );
}
