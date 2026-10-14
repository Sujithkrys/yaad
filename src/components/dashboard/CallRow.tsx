import { MonoLabel, Pill } from "@/components/ui";
import { fmtTs } from "@/lib/time";
import type { TodayItem } from "@/lib/types";

type CallRowProps = { item: TodayItem; selected: boolean; onSelect: (key: string) => void };

export function CallRow({ item, selected, onSelect }: CallRowProps) {
  const meta = `${item.text} · ${fmtTs(item.scheduledAt)}`;
  return (
    <button className="row" type="button" data-s={item.status} aria-pressed={selected} onClick={() => onSelect(item.key)}>
      <span className="rd" aria-hidden="true" />
      <span style={{ minWidth: 0 }}>
        <span className="who" style={{ display: "block" }}>
          {item.personName}
        </span>
        <MonoLabel as="span" className="meta" style={{ display: "block" }} title={meta}>
          {meta}
        </MonoLabel>
      </span>
      <span className="end">
        <Pill variant={item.status} />
        <MonoLabel as="span" className="when">
          {item.note}
        </MonoLabel>
      </span>
    </button>
  );
}
