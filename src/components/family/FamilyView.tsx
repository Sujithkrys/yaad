"use client";

import { Loading } from "@/components/app/Loading";
import { useDialogs } from "@/components/app/DialogsProvider";
import { LoadError } from "@/components/dashboard/DashboardView";
import { Button, Card, EmptyState, FamilyIcon, PlusIcon } from "@/components/ui";
import { useDashboard, useFamily, useReminders } from "@/lib/client/hooks";
import { PersonCard } from "./PersonCard";

export function FamilyView() {
  const family = useFamily();
  const reminders = useReminders();
  const dash = useDashboard();
  const dialogs = useDialogs();

  const error = family.error ?? reminders.error;
  if (error) return <LoadError message={error.message} />;
  if (!family.data || !reminders.data) return <Loading variant="cards" />;

  if (!family.data.length) {
    return (
      <div className="view-stack">
        <Card>
          <EmptyState
            icon={<FamilyIcon />}
            title="Add the people Yaad will call"
            description="Save a parent's number and language so the agent can speak to them in Telugu, Hindi, Tamil or more."
            action={
              <Button onClick={dialogs.addPerson}>
                <PlusIcon />
                Add family member
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const pctById = new Map(dash.data?.adherence.tablet.rows.map((r) => [r.personId, r.pct]) ?? []);

  return (
    <div className="fam-grid">
      {family.data.map((p) => (
        <PersonCard
          key={p.id}
          person={p}
          reminders={reminders.data!.filter((r) => r.personId === p.id)}
          adherencePct={pctById.get(p.id) ?? null}
        />
      ))}
    </div>
  );
}
