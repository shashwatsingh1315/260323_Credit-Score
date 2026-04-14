"use client";

import { motion } from "framer-motion";
import React from "react";
import { cn } from "@/lib/utils";

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  speed?: number;
}

export function GradientText({ children, className, speed = 4 }: GradientTextProps) {
  return (
    <motion.span
      className={cn("inline-block text-transparent bg-clip-text", className)}
      style={{
        backgroundImage: "linear-gradient(90deg, hsl(var(--color-brand)), hsl(var(--color-info)), hsl(var(--color-success)), hsl(var(--color-brand)))",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
      animate={{ backgroundPosition: ["0% 0%", "200% 0%"] }}
      transition={{ repeat: Infinity, duration: speed, ease: "linear" }}
    >
      {children}
    </motion.span>
  );
}
