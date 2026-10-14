import type { Metadata } from "next";
import { EmptyState } from "@/components/shell/EmptyState";
import { ToastButton } from "@/components/shell/ToastButton";
import { FamilyIcon, PlusIcon } from "@/components/ui";

export const metadata: Metadata = { title: "Family · Yaad" };

export default function FamilyPage() {
  return (
    <EmptyState
      icon={<FamilyIcon />}
      title="Add the people Yaad will call"
      description="Save a parent's phone number and language so the agent can speak to them in Telugu, Hindi, Tamil or more."
      action={
        <ToastButton message="The add family member form opens here">
          <PlusIcon />
          Add family member
        </ToastButton>
      }
    />
  );
}
