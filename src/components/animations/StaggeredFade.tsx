"use client";
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface StaggeredFadeProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggeredFade({ children, className = "", staggerDelay = 0.1 }: StaggeredFadeProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={className}
    >
      {/* If children are an array, wrap each in a motion.div item variant */}
      {Array.isArray(children) ? (
        children.map((child, i) => (
          <motion.div key={i} variants={item}>
            {child}
          </motion.div>
        ))
      ) : (
        <motion.div variants={item}>{children}</motion.div>
      )}
    </motion.div>
  );
}
