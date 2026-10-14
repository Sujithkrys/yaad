"use client";

import { Button, PlusIcon } from "@/components/ui";
import { useToast } from "./Toast";

export function NewReminderButton({ label = "New reminder" }: { label?: string }) {
  const say = useToast();
  return (
    <Button onClick={() => say("The new reminder form opens here")}>
      <PlusIcon />
      {label}
    </Button>
  );
}
