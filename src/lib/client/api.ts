"use client";

import { mutate } from "swr";
import type { Person, Reminder, Settings } from "@/lib/types";

// Browser side of the API. The browser never talks to Supabase directly.

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? "Could not load data. Try again.");
  return body as T;
}

async function send<T>(method: "POST" | "PATCH" | "PUT" | "DELETE", url: string, data?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    credentials: "same-origin",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? "Something went wrong. Try again.");
  return body as T;
}

/** Revalidate every cached API response after a change. */
export function refreshAll() {
  return mutate((key) => typeof key === "string" && key.startsWith("/api/"));
}

async function then<T>(p: Promise<T>) {
  const out = await p;
  await refreshAll();
  return out;
}

export type PersonInput = Pick<Person, "name" | "relation" | "phone" | "lang">;
export type ReminderInput = Pick<Reminder, "personId" | "text" | "kind" | "time" | "repeat" | "onceDay" | "lang">;

export const api = {
  addPerson: (input: PersonInput) => then(send<Person>("POST", "/api/family", input)),
  updatePerson: (id: string, patch: Partial<PersonInput>) => then(send<Person>("PATCH", `/api/family/${id}`, patch)),
  deletePerson: (id: string) => then(send("DELETE", `/api/family/${id}`)),
  grantConsent: (id: string) => then(send<Person>("POST", `/api/family/${id}/consent`, { status: "granted" })),
  addReminder: (input: ReminderInput) => then(send<Reminder>("POST", "/api/reminders", input)),
  updateReminder: (id: string, patch: Partial<ReminderInput> & { active?: boolean }) =>
    then(send<Reminder>("PATCH", `/api/reminders/${id}`, patch)),
  deleteReminder: (id: string) => then(send("DELETE", `/api/reminders/${id}`)),
  saveSettings: async (patch: Partial<Settings>) => {
    // Optimistic: show the change at once, then confirm with the server.
    await mutate("/api/settings", (cur?: Settings) => (cur ? { ...cur, ...patch } : cur), { revalidate: false });
    return then(send<Settings>("PUT", "/api/settings", patch));
  },
  seed: () => then(send<{ people: number; reminders: number; calls: number }>("POST", "/api/seed")),
  reset: () => then(send("POST", "/api/reset")),
  callNow: (reminderId: string) => send("POST", "/api/calls", { reminderId }),
};
