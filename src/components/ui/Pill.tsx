import type { CallStatus } from "@/lib/app/types";

export const STATUS_LABEL: Record<CallStatus, string> = {
  confirmed: "Confirmed",
  retry: "Retry",
  calling: "Calling",
  scheduled: "Scheduled",
  missed: "Missed",
};

type PillProps = { variant: CallStatus; children?: React.ReactNode };

export function Pill({ variant, children }: PillProps) {
  return (
    <span className={`pill ${variant}`}>
      <i aria-hidden="true" />
      {children ?? STATUS_LABEL[variant]}
    </span>
  );
}
