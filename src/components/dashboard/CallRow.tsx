import { MonoLabel, Pill } from "@/components/ui";
import { formatTime } from "@/lib/format";
import type { Call } from "@/lib/sample-data";

type CallRowProps = { call: Call; selected: boolean; onSelect: (id: number) => void };

export function CallRow({ call, selected, onSelect }: CallRowProps) {
  const meta = `${call.what} · ${formatTime(call.h, call.m)}`;
  return (
    <button className="row" type="button" data-s={call.status} aria-pressed={selected} onClick={() => onSelect(call.id)}>
      <span className="rd" aria-hidden="true" />
      <span style={{ minWidth: 0 }}>
        <span className="who" style={{ display: "block" }}>
          {call.who}
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
