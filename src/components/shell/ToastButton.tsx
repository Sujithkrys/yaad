"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import { useToast } from "./Toast";

/** Placeholder action for screens that are not built yet. */
export function ToastButton({ message, children }: { message: string; children: ReactNode }) {
  const say = useToast();
  return <Button onClick={() => say(message)}>{children}</Button>;
}
