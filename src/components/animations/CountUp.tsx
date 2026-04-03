"use client";
import { useEffect, useState } from "react";
import { animate } from "framer-motion";

interface CountUpProps {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export function CountUp({ to, duration = 1.5, prefix = "", suffix = "", decimals = 0 }: CountUpProps) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, to, {
      duration,
      ease: "easeOut",
      onUpdate(v) {
        setValue(v);
      },
    });
    return () => controls.stop();
  }, [to, duration]);

  const formattedValue = value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return <span>{prefix}{formattedValue}{suffix}</span>;
}