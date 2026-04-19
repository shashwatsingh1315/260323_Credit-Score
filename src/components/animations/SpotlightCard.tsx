"use client";
import { useRef } from "react";
import { motion } from "framer-motion";

export function SpotlightCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const divRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current || !spotlightRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    spotlightRef.current.style.background = `radial-gradient(400px circle at ${x}px ${y}px, rgba(255, 255, 255, 0.07), transparent 40%)`;
  };

  return (
    <motion.div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => { if (spotlightRef.current) spotlightRef.current.style.opacity = "1"; }}
      onMouseLeave={() => { if (spotlightRef.current) spotlightRef.current.style.opacity = "0"; }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className}`}
    >
      <div
        ref={spotlightRef}
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-0"
      />
      {children}
    </motion.div>
  );
}