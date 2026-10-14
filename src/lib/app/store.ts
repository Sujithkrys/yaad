"use client";

import { useCallback, useSyncExternalStore } from "react";
import { seedState, STORAGE_KEY } from "./seed";
import { dayKey } from "./time";
import type { AppState, Person, Reminder, Settings } from "./types";

// Per-browser prototype store. Swap for a server API (Upstash) later; the
// action functions below are the only things that write.

let state: AppState | null = null;
const listeners = new Set<() => void>();

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed?.version === 1) return parsed;
    }
  } catch {
    // Storage blocked or corrupt: fall back to sample data in memory.
  }
  return seedState(Date.now());
}

function getSnapshot() {
  if (!state) state = load();
  return state;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      state = load();
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

function update(fn: (s: AppState) => AppState) {
  state = fn(getSnapshot());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep working in memory.
  }
  listeners.forEach((l) => l());
}

/** App state, or null during server render and hydration. */
export function useAppState() {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/**
 * Current time rounded down to `ms`, refreshed every `ms`. Returns 0 while
 * prerendering, so time-based output only renders in the browser.
 */
export function useNow(ms = 1000) {
  return useSyncExternalStore(
    useCallback(
      (onTick: () => void) => {
        const id = setInterval(onTick, ms);
        return () => clearInterval(id);
      },
      [ms],
    ),
    () => Math.floor(Date.now() / ms) * ms,
    () => 0,
  );
}

/* ---------- actions ---------- */

export type PersonInput = Omit<Person, "id" | "consent" | "paused">;
export type ReminderInput = Omit<Reminder, "id" | "createdDay" | "active">;

export function addPerson(input: PersonInput, consent: Person["consent"] = "pending") {
  let id = 0;
  update((s) => {
    id = s.nextId;
    return { ...s, nextId: s.nextId + 1, family: [...s.family, { ...input, id, consent }] };
  });
  return id;
}

export function updatePerson(id: number, patch: Partial<Person>) {
  update((s) => ({ ...s, family: s.family.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
}

export function removePerson(id: number) {
  update((s) => ({
    ...s,
    family: s.family.filter((p) => p.id !== id),
    reminders: s.reminders.filter((r) => r.personId !== id),
  }));
}

export function addReminder(input: ReminderInput) {
  update((s) => ({
    ...s,
    nextId: s.nextId + 1,
    reminders: [...s.reminders, { ...input, id: s.nextId, active: true, createdDay: dayKey(Date.now()) }],
  }));
}

export function updateReminder(id: number, patch: Partial<Reminder>) {
  update((s) => ({ ...s, reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
}

export function removeReminder(id: number) {
  update((s) => ({ ...s, reminders: s.reminders.filter((r) => r.id !== id) }));
}

export function updateSettings(patch: Partial<Settings>) {
  update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function setUserName(name: string) {
  update((s) => ({ ...s, user: { name } }));
}

export function callNow(callId: string) {
  update((s) => ({ ...s, manual: { ...s.manual, [callId]: { at: Date.now() } } }));
}

export function resetDemo() {
  update(() => seedState(Date.now()));
}
