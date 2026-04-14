"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label?: string;
  animateColor?: boolean; // If true, colors text-success if > 0, text-destructive if < 0
}

export function AnimatedNumber({
  value,
  className,
  prefix = "",
  suffix = "",
  decimals = 0,
  label,
  animateColor = false,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 20, stiffness: 50 });
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [motionValue, isInView, value]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      if (ref.current) {
        let formatted = Intl.NumberFormat("en-IN", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(latest);
        ref.current.textContent = `${prefix}${formatted}${suffix}`;
      }
    });
  }, [springValue, decimals, prefix, suffix]);

  let colorClass = "";
  if (animateColor) {
    if (value > 0) colorClass = "text-success";
    else if (value < 0) colorClass = "text-destructive";
  }

  return (
    <div className="flex flex-col">
      <span className={cn("inline-block", colorClass, className)} ref={ref}>
        {prefix}0{suffix}
      </span>
      {label && (
        <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">
          {label}
        </span>
      )}
    </div>
  );
}
