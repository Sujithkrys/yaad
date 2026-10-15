"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useDialogs } from "@/components/app/DialogsProvider";
import { Button, MonoLabel, PlusIcon } from "@/components/ui";
import { AlertsBell } from "./AlertsBell";
import { useCalls, useDashboard, useFamily, useOwnerName, useReminders } from "@/lib/client/hooks";
import { fmtLongDate, greetingWord } from "@/lib/time";

type Head = { title: string; sub: string; actions?: ReactNode };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function TopBar() {
  const path = usePathname();
  const dialogs = useDialogs();
  const family = useFamily().data;
  const reminders = useReminders().data;
  // now === 0 is the placeholder shown before login; it is not a real date.
  const dashData = useDashboard().data;
  const dash = dashData?.now ? dashData : undefined;
  const calls = useCalls({}).data;
  const name = useOwnerName();

  const newReminder = (
    <Button onClick={() => dialogs.newReminder()}>
      <PlusIcon />
      New reminder
    </Button>
  );
  const addPerson = (
    <Button onClick={dialogs.addPerson}>
      <PlusIcon />
      Add family member
    </Button>
  );

  let head: Head;
  if (path.startsWith("/reminders")) {
    const active = reminders?.filter((r) => r.active).length ?? 0;
    head = { title: "Reminders", sub: reminders ? `${active} active · ${reminders.length - active} paused` : "", actions: newReminder };
  } else if (path.startsWith("/family")) {
    const pending = family?.filter((p) => p.consent === "pending").length ?? 0;
    head = {
      title: "Family",
      sub: family ? `${plural(family.length, "person", "people")}${pending ? ` · ${pending} waiting for consent` : ""}` : "",
      actions: addPerson,
    };
  } else if (path.startsWith("/history")) {
    const missed = calls?.filter((c) => c.status === "missed").length ?? 0;
    head = { title: "Call history", sub: calls ? `${plural(calls.length, "call")} · ${missed} missed` : "" };
  } else if (path.startsWith("/settings")) {
    head = { title: "Settings", sub: "Calls, quiet hours and alerts" };
  } else if (path.startsWith("/studio")) {
    head = { title: "Voice preview", sub: "Hear the reminder before it calls" };
  } else {
    const items = dash?.todayItems ?? [];
    const retries = items.filter((c) => c.status === "retry").length;
    head = {
      title: dash ? `Good ${greetingWord(dash.now)}${name ? `, ${name}` : ""}` : "",
      sub: dash ? `${fmtLongDate(dash.now)} · ${plural(items.length, "call")} today · ${retries} retry pending` : "",
      actions: newReminder,
    };
  }

  return (
    <header className="topbar">
      <div>
        <h1>{head.title || " "}</h1>
        <MonoLabel>{head.sub || " "}</MonoLabel>
      </div>
      <div className="top-actions">
        <AlertsBell />
        {head.actions}
      </div>
    </header>
  );
}
