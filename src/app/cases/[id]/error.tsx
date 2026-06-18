"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

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
    <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 text-center border-dashed border-2 border-border rounded-xl bg-card">
      <AlertCircle size={32} className="text-destructive mb-4" />
      <h2 className="text-lg font-bold mb-2">Failed to load case details</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        We encountered an error while retrieving this case. It might have been deleted, or there is a temporary system issue.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()} variant="outline">
          Try again
        </Button>
        <Button asChild>
          <Link href="/cases">Back to Cases</Link>
        </Button>
      </div>
    </div>
  );
}
