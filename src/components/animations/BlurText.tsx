"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BlurTextProps {
  text: string;
  className?: string;
  delay?: number;
}

export function BlurText({ text, className, delay = 0 }: BlurTextProps) {
  const words = text.split(" ");

  const container = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: delay * i },
    }),
  };

  const child = {
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        type: "spring" as const,
        damping: 12,
        stiffness: 100,
      },
    },
    hidden: {
      opacity: 0,
      filter: "blur(10px)",
      y: 10,
    },
  };

  return (
    <motion.div
      style={{ display: "flex", flexWrap: "wrap", gap: "0.25em" }}
      className={cn("font-bold", className)}
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {words.map((word, index) => (
        <motion.span variants={child} key={index}>
          {word}
        </motion.span>
      ))}
    </motion.div>
  );
}
