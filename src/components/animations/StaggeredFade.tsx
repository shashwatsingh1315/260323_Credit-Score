"use client";
import { motion } from "framer-motion";
import { ReactNode } from "react";

export function StaggeredFade({ children, delay = 0.1 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}