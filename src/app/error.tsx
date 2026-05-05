"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground space-y-4 p-4 text-center">
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertCircle size={32} className="text-destructive" />
      </div>
      <h2 className="text-xl font-bold">Something went wrong!</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        An unexpected error occurred. Please try again or contact support if the issue persists.
      </p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
