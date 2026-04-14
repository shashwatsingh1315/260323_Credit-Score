"use client";

import { motion } from "framer-motion";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface TimelineEvent {
  id: string;
  title: string;
  subtitle: string;
  diff?: any;
  color?: string; // Tailwind class like "bg-success"
}

interface AnimatedTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function AnimatedTimeline({ events, className }: AnimatedTimelineProps) {
  return (
    <div className={cn("relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent", className)}>
      {events.map((event, index) => (
        <TimelineItem key={event.id} event={event} index={index} />
      ))}
    </div>
  );
}

function TimelineItem({ event, index }: { event: TimelineEvent; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const dotColor = event.color || "bg-muted";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07, type: "spring", stiffness: 100, damping: 15 }}
      className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
    >
      {/* Icon */}
      <div className={cn("flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-card shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2", dotColor.replace('bg-', 'text-'))}>
        <div className={cn("w-3 h-3 rounded-full", dotColor, "shadow-[0_0_10px_currentColor]")} />
      </div>
      
      {/* Card */}
      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-card/70 backdrop-blur-md shadow-sm group-hover:shadow-md transition-shadow group-hover:-translate-y-0.5 duration-200">
        <div className="flex flex-col gap-1">
          <h4 className="font-bold text-foreground text-sm">{event.title}</h4>
          <span className="text-xs text-muted-foreground">{event.subtitle}</span>
        </div>
        
        {event.diff && Object.keys(event.diff).length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center text-xs font-semibold text-brand hover:text-brand/80 transition-colors"
            >
              {expanded ? <ChevronUp size={14} className="mr-1" /> : <ChevronDown size={14} className="mr-1" />}
              {expanded ? "Hide Details" : "View Details"}
            </button>
            {expanded && (
              <motion.pre
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-2 p-3 bg-muted/50 rounded-lg text-xs overflow-x-auto text-muted-foreground border border-border/50"
              >
                {JSON.stringify(event.diff, null, 2)}
              </motion.pre>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
