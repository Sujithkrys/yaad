import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shell/EmptyState";
import { PhoneIcon } from "@/components/ui";

export const metadata: Metadata = { title: "Call history · Yaad" };

export default function HistoryPage() {
  return (
    <EmptyState
      icon={<PhoneIcon />}
      title="No calls placed yet"
      description="Every call, with its transcript and result, will be listed here once your first reminder rings."
      action={
        <Link className="btn" href="/reminders">
          Go to reminders
        </Link>
      }
    />
  );
}
