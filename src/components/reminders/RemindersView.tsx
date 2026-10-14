"use client";

import { useState } from "react";
import { Loading } from "@/components/app/Loading";
import { useDialogs } from "@/components/app/DialogsProvider";
import { Button, Card, ClockIcon, EmptyState, MonoLabel, PlusIcon } from "@/components/ui";
import { useAppState } from "@/lib/app/store";
import { ReminderRow } from "./ReminderRow";

export function RemindersView() {
  const state = useAppState();
  const dialogs = useDialogs();
  const [confirming, setConfirming] = useState<number | null>(null);
  if (!state) return <Loading />;

  const people = new Map(state.family.map((p) => [p.id, p]));
  const reminders = [...state.reminders].sort(
    (a, b) => (people.get(a.personId)?.name ?? "").localeCompare(people.get(b.personId)?.name ?? "") || a.time.localeCompare(b.time),
  );

  return (
    <div className="view-stack">
      <Card className="list">
        {reminders.length ? (
          <>
            <div className="lhead mono" aria-hidden="true">
              <span>Person</span>
              <span>Reminder</span>
              <span>When</span>
              <span>Language</span>
              <span>On</span>
              <span style={{ textAlign: "right" }}>Actions</span>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Reminders">
              {reminders.map((r) => {
                const person = people.get(r.personId);
                return person ? (
                  <ReminderRow
                    key={r.id}
                    reminder={r}
                    person={person}
                    settings={state.settings}
                    confirming={confirming === r.id}
                    onConfirm={(on) => setConfirming(on ? r.id : null)}
                  />
                ) : null;
              })}
            </ul>
          </>
        ) : (
          <EmptyState
            icon={<ClockIcon />}
            title="No reminders yet"
            description="Schedule a call, like a 7 PM BP tablet for Amma, and Yaad will ring at that time."
            action={
              <Button onClick={() => dialogs.newReminder()}>
                <PlusIcon />
                Create a reminder
              </Button>
            }
          />
        )}
      </Card>
      <MonoLabel style={{ textAlign: "center" }}>Paused reminders keep their settings but place no calls</MonoLabel>
    </div>
  );
}
