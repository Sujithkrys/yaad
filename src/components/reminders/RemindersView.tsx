"use client";

import { useState } from "react";
import { Loading } from "@/components/app/Loading";
import { useDialogs } from "@/components/app/DialogsProvider";
import { LoadError } from "@/components/dashboard/DashboardView";
import { Button, Card, ClockIcon, EmptyState, MonoLabel, PlusIcon } from "@/components/ui";
import { useFamily, useReminders, useSettings } from "@/lib/client/hooks";
import { ReminderRow } from "./ReminderRow";

export function RemindersView() {
  const family = useFamily();
  const reminders = useReminders();
  const settings = useSettings();
  const dialogs = useDialogs();
  const [confirming, setConfirming] = useState<string | null>(null);

  const error = family.error ?? reminders.error ?? settings.error;
  if (error) return <LoadError message={error.message} />;
  if (!family.data || !reminders.data || !settings.data) return <Loading />;

  const people = new Map(family.data.map((p) => [p.id, p]));
  const list = [...reminders.data].sort(
    (a, b) => (people.get(a.personId)?.name ?? "").localeCompare(people.get(b.personId)?.name ?? "") || a.time.localeCompare(b.time),
  );

  return (
    <div className="view-stack">
      <Card className="list">
        {list.length ? (
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
              {list.map((r) => {
                const person = people.get(r.personId);
                return person ? (
                  <ReminderRow
                    key={r.id}
                    reminder={r}
                    person={person}
                    settings={settings.data!}
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
      {list.length ? <MonoLabel style={{ textAlign: "center" }}>Paused reminders keep their settings but place no calls</MonoLabel> : null}
    </div>
  );
}
