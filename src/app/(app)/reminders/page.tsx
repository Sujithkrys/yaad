import type { Metadata } from "next";
import { EmptyState } from "@/components/shell/EmptyState";
import { NewReminderButton } from "@/components/shell/NewReminderButton";
import { ClockIcon } from "@/components/ui";

export const metadata: Metadata = { title: "Reminders · Yaad" };

export default function RemindersPage() {
  return (
    <EmptyState
      icon={<ClockIcon />}
      title="No reminders yet"
      description="Schedule a call, like a 7 PM BP tablet for Amma, and Yaad will ring at that time every day."
      action={<NewReminderButton label="Create a reminder" />}
    />
  );
}
