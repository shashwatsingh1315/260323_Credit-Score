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