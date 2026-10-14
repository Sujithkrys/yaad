import type { CallStatus } from "@/lib/app/types";
import { cx } from "./cx";

export type Tick = {
  status?: CallStatus;
  /** Tall tick marks a slot that has a call. */
  filled?: boolean;
  selected?: boolean;
  dim?: boolean;
};

export function TickBar({ ticks, className }: { ticks: Tick[]; className?: string }) {
  return (
    <div className={cx("ticks", className)} aria-hidden="true">
      {ticks.map((t, i) => (
        <span key={i} className={cx("tick", t.filled && "c", t.status, t.selected && "sel", t.dim && "dim")} />
      ))}
    </div>
  );
}
