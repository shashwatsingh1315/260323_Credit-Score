"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShinyTextProps {
  text: string;
  className?: string;
  speed?: number;
}

export function ShinyText({ text, className, speed = 3 }: ShinyTextProps) {
  return (
    <motion.span
      className={cn(
        "inline-block text-transparent bg-clip-text",
        className
      )}
      style={{
        backgroundImage: "linear-gradient(120deg, hsla(var(--foreground) / 0) 40%, hsla(var(--foreground) / 0.8) 50%, hsla(var(--foreground) / 0) 60%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        backgroundColor: "currentColor"
      }}
      animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
      transition={{ repeat: Infinity, duration: speed, ease: "linear" }}
    >
      {text}
    </motion.span>
  );
}
