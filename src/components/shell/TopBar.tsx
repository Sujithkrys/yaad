import { MonoLabel } from "@/components/ui";
import { calls, today } from "@/lib/sample-data";
import { NewReminderButton } from "./NewReminderButton";

export function TopBar() {
  const retries = calls.filter((c) => c.status === "retry").length;
  return (
    <header className="topbar">
      <div>
        <h1>{today.greeting}</h1>
        <MonoLabel>
          {today.dateLine} · {calls.length} calls today · {retries} retry pending
        </MonoLabel>
      </div>
      <NewReminderButton />
    </header>
  );
}
