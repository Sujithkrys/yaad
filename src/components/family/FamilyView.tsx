"use client";

import { Loading } from "@/components/app/Loading";
import { useDialogs } from "@/components/app/DialogsProvider";
import { Button, Card, EmptyState, FamilyIcon, PlusIcon } from "@/components/ui";
import { adherence } from "@/lib/app/calls";
import { useAppState, useNow } from "@/lib/app/store";
import { PersonCard } from "./PersonCard";

export function FamilyView() {
  const state = useAppState();
  const now = useNow(60_000);
  const dialogs = useDialogs();
  if (!state) return <Loading />;

  if (!state.family.length) {
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

  const tablets = adherence(state, "tablet", now);
  const pctById = new Map(tablets.rows.map((r) => [r.person.id, r.pct]));

  return (
    <div className="fam-grid">
      {state.family.map((p) => (
        <PersonCard
          key={p.id}
          person={p}
          reminders={state.reminders.filter((r) => r.personId === p.id)}
          adherencePct={pctById.get(p.id) ?? null}
        />
      ))}
    </div>
  );
}
