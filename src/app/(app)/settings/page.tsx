import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shell/EmptyState";
import { SettingsIcon } from "@/components/ui";

export const metadata: Metadata = { title: "Settings · Yaad" };

export default function SettingsPage() {
  return (
    <EmptyState
      icon={<SettingsIcon />}
      title="Settings are on the way"
      description="Retry timing, alert contacts and your call minute plan will be managed from this page."
      action={
        <Link className="btn" href="/family">
          Manage family
        </Link>
      }
    />
  );
}
