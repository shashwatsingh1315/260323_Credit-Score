"use client";

import { motion } from "framer-motion";
import React from "react";
import { cn } from "@/lib/utils";

interface GlowPulseProps {
  children: React.ReactNode;
  variant?: "brand" | "destructive" | "warning" | "success" | "info";
  className?: string;
}

export function GlowPulse({ children, variant = "brand", className }: GlowPulseProps) {
  const variantColors = {
    brand: "hsl(var(--color-brand))",
    destructive: "hsl(var(--destructive))",
    warning: "hsl(var(--color-warning))",
    success: "hsl(var(--color-success))",
    info: "hsl(var(--color-info))",
  };

  const color = variantColors[variant];

  return (
    <motion.div
      className={cn("inline-block rounded-full", className)}
      animate={{
        boxShadow: [
          `0 0 0 0 ${color.replace(")", ", 0.4)")}`,
          `0 0 0 6px ${color.replace(")", ", 0)")}`,
        ],
      }}
      transition={{
        repeat: Infinity,
        duration: 2,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  );
}
