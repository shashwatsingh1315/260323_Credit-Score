"use client";

import { motion } from "framer-motion";
import React from "react";
import { cn } from "@/lib/utils";

interface StarBorderProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

export function StarBorder({ children, className, as: Component = "div" }: StarBorderProps) {
  return (
    <Component className={cn("relative inline-block overflow-hidden rounded-xl p-0.5", className)}>
      <motion.div
        className="absolute inset-[-100%] opacity-50"
        style={{
          background: "conic-gradient(from 0deg, transparent 0 340deg, hsl(var(--primary)) 360deg)",
          willChange: "transform"
        }}
        animate={{ rotate: [0, 360] }}
        transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
      />
      <div className="relative h-full w-full rounded-lg bg-background p-4">
        {children}
      </div>
    </Component>
  );
}
