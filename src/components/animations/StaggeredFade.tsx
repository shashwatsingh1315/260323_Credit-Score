"use client";
import { motion, useReducedMotion, Variants } from "framer-motion";
import React, { ReactNode } from "react";

interface StaggeredFadeProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: (staggerDelay: number) => ({
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
    },
  }),
};

const itemVariants: Variants = {
  hidden: (shouldReduceMotion: boolean) => ({
    opacity: 0,
    y: shouldReduceMotion ? 0 : 20,
  }),
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

export function StaggeredFade({ children, className = "", staggerDelay = 0.1 }: StaggeredFadeProps) {
  const shouldReduceMotion = useReducedMotion();

  // Robust child handling by converting to array and filtering out non-valid elements
  const childArray = React.Children.toArray(children);

  return (
    <motion.div
      variants={containerVariants}
      custom={staggerDelay}
      initial="hidden"
      animate="show"
      className={className}
    >
      {childArray.map((child, i) => (
        <motion.div 
          key={i} 
          variants={itemVariants} 
          custom={shouldReduceMotion ?? false}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
