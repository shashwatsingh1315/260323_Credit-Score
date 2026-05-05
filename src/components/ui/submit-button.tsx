"use client";
import { useFormStatus } from "react-dom";
import { Button, ButtonProps } from "./button";
import { Loader2 } from "lucide-react";

interface SubmitButtonProps extends ButtonProps {
  loadingText?: string;
}

export function SubmitButton({ children, loadingText = "Saving...", ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button {...props} disabled={pending || props.disabled}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {pending ? loadingText : children}
    </Button>
  );
}
