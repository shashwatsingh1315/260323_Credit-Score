"use client";
import { motion } from "framer-motion";

export function BlurText({ text, className = "" }: { text: string; className?: string }) {
  const letters = text.split("");

  return (
    <span className={`inline-block ${className}`} aria-label={text}>
      {letters.map((letter, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          initial={{ filter: "blur(10px)", opacity: 0, y: 10 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: i * 0.03,
            ease: [0.4, 0, 0.2, 1],
          }}
          className="inline-block"
        >
          {letter === " " ? "\u00A0" : letter}
        </motion.span>
      ))}
    </span>
  );
}