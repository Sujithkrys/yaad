"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useDialogs } from "@/components/app/DialogsProvider";
import { Button, MonoLabel, PlusIcon } from "@/components/ui";
import { callHistory, todayCalls } from "@/lib/app/calls";
import { useAppState, useNow } from "@/lib/app/store";
import { fmtLongDate, greetingWord } from "@/lib/app/time";
import type { AppState } from "@/lib/app/types";

type Head = { title: string; sub: string; actions?: ReactNode };

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function TopBar() {
  const pathname = usePathname();
  const state = useAppState();
  const now = useNow(30_000);
  const dialogs = useDialogs();

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

  const head = state ? headFor(pathname, state, now, { newReminder, addPerson }) : { title: "", sub: "" };

  return (
    <header className="topbar">
      <div>
        <h1>{head.title || " "}</h1>
        <MonoLabel>{head.sub || " "}</MonoLabel>
      </div>
      {head.actions ? <div className="top-actions">{head.actions}</div> : null}
    </header>
  );
}

function headFor(path: string, s: AppState, now: number, a: { newReminder: ReactNode; addPerson: ReactNode }): Head {
  if (path.startsWith("/reminders")) {
    const active = s.reminders.filter((r) => r.active).length;
    return { title: "Reminders", sub: `${active} active · ${s.reminders.length - active} paused`, actions: a.newReminder };
  }
  if (path.startsWith("/family")) {
    const pending = s.family.filter((p) => p.consent === "pending").length;
    return {
      title: "Family",
      sub: `${s.family.length} ${s.family.length === 1 ? "person" : "people"}${pending ? ` · ${pending} waiting for consent` : ""}`,
      actions: a.addPerson,
    };
  }
  if (path.startsWith("/history")) {
    const calls = callHistory(s, now, 14);
    const missed = calls.filter((c) => c.status === "missed").length;
    return { title: "Call history", sub: `Last 14 days · ${plural(calls.length, "call")} · ${missed} missed` };
  }
  if (path.startsWith("/settings")) return { title: "Settings", sub: "Calls, quiet hours and alerts" };
  if (path.startsWith("/studio")) return { title: "Voice studio", sub: "Hear the agent before it calls" };

  const today = todayCalls(s, now);
  const retries = today.filter((c) => c.status === "retry").length;
  return {
    title: `Good ${greetingWord(now)}, ${s.user.name}`,
    sub: `${fmtLongDate(now)} · ${plural(today.length, "call")} today · ${retries} retry pending`,
    actions: a.newReminder,
  };
}
