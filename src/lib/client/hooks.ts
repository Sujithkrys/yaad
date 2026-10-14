"use client";

import { useCallback, useSyncExternalStore } from "react";
import useSWR from "swr";
import type { Call, Dashboard, Person, Reminder, Settings } from "@/lib/types";
import { fetcher } from "./api";

export const useFamily = () => useSWR<Person[]>("/api/family", fetcher);
export const useReminders = () => useSWR<Reminder[]>("/api/reminders", fetcher);
export const useSettings = () => useSWR<Settings>("/api/settings", fetcher);
/** Refreshes every 30 seconds so countdowns and statuses stay current. */
export const useDashboard = () => useSWR<Dashboard>("/api/dashboard", fetcher, { refreshInterval: 30_000 });

export function useCalls(filters: { person?: string; status?: string; q?: string }) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
  const key = `/api/calls${qs.size ? `?${qs}` : ""}`;
  return useSWR<Call[]>(key, fetcher, { keepPreviousData: true });
}

/* ---------- the owner's display name: a per-browser preference ---------- */

const NAME_KEY = "yaad-name";
const nameListeners = new Set<() => void>();

function readName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setOwnerName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Storage blocked; the name just will not persist.
  }
  nameListeners.forEach((l) => l());
}

export function useOwnerName() {
  return useSyncExternalStore(
    useCallback((fn: () => void) => {
      nameListeners.add(fn);
      return () => nameListeners.delete(fn);
    }, []),
    readName,
    () => "",
  );
}
