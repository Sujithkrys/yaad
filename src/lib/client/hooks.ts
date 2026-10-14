"use client";

import useSWR, { type SWRResponse } from "swr";
import type { Adherence, Call, Dashboard, Person, Reminder, Settings } from "@/lib/types";
import { fetcher } from "./api";

export type WorkspaceInfo = { id: string; name: string };

/** This browser's named workspace; `null` until the visitor picks a name. */
export function useWorkspace() {
  const res = useSWR<{ workspace: WorkspaceInfo | null }>("/api/workspace", fetcher);
  return { workspace: res.data?.workspace, loading: !res.data && !res.error, error: res.error };
}

export const DEFAULT_SETTINGS: Settings = {
  alert: true,
  alertChannel: "WhatsApp",
  alertNumber: "",
  retryMin: 10,
  maxAttempts: 2,
  quietOn: true,
  quietFrom: "22:00",
  quietTo: "06:00",
  defaultLang: "hi-IN",
  demoOutcome: "random",
};

const EMPTY_ADHERENCE: Adherence = { rows: [], days: [], first: 0, retried: 0, missed: 0, total: 0, pct: 0, delta: 0, perDay: [] };

const EMPTY_DASHBOARD: Dashboard = {
  now: 0,
  todayItems: [],
  adherence: { tablet: EMPTY_ADHERENCE, walk: EMPTY_ADHERENCE, visit: EMPTY_ADHERENCE },
  lastCall: null,
  minutesUsed: 0,
};

/**
 * Fetch only once a named workspace exists. Before that, return `empty` so
 * every screen renders its empty state behind the name prompt.
 */
function useWorkspaceSWR<T>(key: string, empty: T, opts?: Parameters<typeof useSWR<T>>[2]): SWRResponse<T> {
  const { workspace } = useWorkspace();
  const res = useSWR<T>(workspace ? key : null, fetcher, opts);
  if (workspace === null) return { ...res, data: empty, error: undefined, isLoading: false } as SWRResponse<T>;
  return res;
}

export const useFamily = () => useWorkspaceSWR<Person[]>("/api/family", []);
export const useReminders = () => useWorkspaceSWR<Reminder[]>("/api/reminders", []);
export const useSettings = () => useWorkspaceSWR<Settings>("/api/settings", DEFAULT_SETTINGS);

/** Polls fast while a call is ringing so the row flips as soon as the result lands. */
export const useDashboard = () =>
  useWorkspaceSWR<Dashboard>("/api/dashboard", EMPTY_DASHBOARD, {
    refreshInterval: (d?: Dashboard) => (d?.todayItems.some((i) => i.status === "calling") ? 3000 : 30_000),
  });

export function useCalls(filters: { person?: string; status?: string; q?: string }) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
  const key = `/api/calls${qs.size ? `?${qs}` : ""}`;
  return useWorkspaceSWR<Call[]>(key, [], {
    keepPreviousData: true,
    refreshInterval: (d?: Call[]) => (d?.some((c) => c.status === "calling") ? 3000 : 0),
  });
}

/** The owner's name: the workspace name. */
export function useOwnerName() {
  return useWorkspace().workspace?.name ?? "";
}
