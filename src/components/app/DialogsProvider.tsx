"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CallRecord } from "@/lib/app/types";
import { CallDrawer } from "./CallDrawer";
import { PersonDialog } from "./PersonDialog";
import { ReminderDialog } from "./ReminderDialog";

type Open =
  | { kind: "reminder"; reminderId?: number; personId?: number }
  | { kind: "person"; personId?: number }
  | { kind: "call"; call: CallRecord }
  | null;

type Dialogs = {
  newReminder: (personId?: number) => void;
  editReminder: (reminderId: number) => void;
  addPerson: () => void;
  editPerson: (personId: number) => void;
  showCall: (call: CallRecord) => void;
};

const DialogsContext = createContext<Dialogs | null>(null);

export function useDialogs() {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error("useDialogs must be used inside DialogsProvider");
  return ctx;
}

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open>(null);
  const close = useCallback(() => setOpen(null), []);

  const api = useMemo<Dialogs>(
    () => ({
      newReminder: (personId) => setOpen({ kind: "reminder", personId }),
      editReminder: (reminderId) => setOpen({ kind: "reminder", reminderId }),
      addPerson: () => setOpen({ kind: "person" }),
      editPerson: (personId) => setOpen({ kind: "person", personId }),
      showCall: (call) => setOpen({ kind: "call", call }),
    }),
    [],
  );

  return (
    <DialogsContext.Provider value={api}>
      {children}
      <ReminderDialog
        open={open?.kind === "reminder"}
        reminderId={open?.kind === "reminder" ? open.reminderId : undefined}
        personId={open?.kind === "reminder" ? open.personId : undefined}
        onClose={close}
        onAddPerson={() => setOpen({ kind: "person" })}
      />
      <PersonDialog open={open?.kind === "person"} personId={open?.kind === "person" ? open.personId : undefined} onClose={close} />
      <CallDrawer call={open?.kind === "call" ? open.call : null} onClose={close} />
    </DialogsContext.Provider>
  );
}
