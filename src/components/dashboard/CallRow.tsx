import { MonoLabel, Pill } from "@/components/ui";
import { fmtTs } from "@/lib/app/time";
import type { CallRecord } from "@/lib/app/types";

type CallRowProps = { call: CallRecord; selected: boolean; onSelect: (id: string) => void };

export function CallRow({ call, selected, onSelect }: CallRowProps) {
  const meta = `${call.reminder.text} · ${fmtTs(call.scheduledTs)}`;
  return (
    <button className="row" type="button" data-s={call.status} aria-pressed={selected} onClick={() => onSelect(call.id)}>
      <span className="rd" aria-hidden="true" />
      <span style={{ minWidth: 0 }}>
        <span className="who" style={{ display: "block" }}>
          {call.person.name}
        </span>
        <MonoLabel as="span" className="meta" style={{ display: "block" }} title={meta}>
          {meta}
        </MonoLabel>
      </span>
      <span className="end">
        <Pill variant={call.status} />
        <MonoLabel as="span" className="when">
          {call.note}
        </MonoLabel>
      </span>
    </button>
  );
}
