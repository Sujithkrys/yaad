"use client";

import { useState } from "react";
import { useDialogs } from "@/components/app/DialogsProvider";
import { useToast } from "@/components/shell/Toast";
import { Avatar, Button, Card, EditIcon, MonoLabel, Pill, PlusIcon, cx } from "@/components/ui";
import { removePerson, updatePerson } from "@/lib/app/store";
import type { Person, Reminder } from "@/lib/app/types";
import { LANGUAGES } from "@/lib/voices";

function formatPhone(p: string) {
  return `+91 ${p.slice(0, 5)} ${p.slice(5)}`;
}

type Props = { person: Person; reminders: Reminder[]; adherencePct: number | null };

export function PersonCard({ person: p, reminders, adherencePct }: Props) {
  const dialogs = useDialogs();
  const say = useToast();
  const [confirming, setConfirming] = useState(false);
  const lang = LANGUAGES.find((l) => l.code === p.lang)?.label ?? p.lang;
  const active = reminders.filter((r) => r.active).length;

  const status =
    p.consent === "pending" ? (
      <Pill variant="retry">Waiting</Pill>
    ) : p.paused ? (
      <Pill variant="scheduled">Paused</Pill>
    ) : (
      <Pill variant="confirmed">Agreed</Pill>
    );

  return (
    <Card className={cx("pcard")}>
      <div className={cx("top", p.paused && "paused")}>
        <Avatar name={p.name} size="lg" />
        <div>
          <h3>{p.name}</h3>
          <MonoLabel>{p.relation}</MonoLabel>
        </div>
        {status}
      </div>

      <div className="kv">
        <div>
          <MonoLabel>Mobile</MonoLabel>
          <div className="v num">{formatPhone(p.phone)}</div>
        </div>
        <div>
          <MonoLabel>Language</MonoLabel>
          <div className="v">{lang}</div>
        </div>
        <div>
          <MonoLabel>Reminders</MonoLabel>
          <div className="v num">
            {active} active{reminders.length > active ? ` · ${reminders.length - active} paused` : ""}
          </div>
        </div>
        <div>
          <MonoLabel>Tablets taken</MonoLabel>
          <div className="v num">{adherencePct === null ? "–" : `${adherencePct}%`}</div>
        </div>
      </div>

      {p.consent === "pending" ? (
        <p className="warn">We sent {p.name} a message asking if it&apos;s okay to call. Calls start after they agree.</p>
      ) : null}

      {confirming ? (
        <div className="confirm-bar" role="alert">
          <span>
            Remove {p.name} and {reminders.length} reminder{reminders.length === 1 ? "" : "s"}?
          </span>
          <div>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="bad"
              size="sm"
              onClick={() => {
                removePerson(p.id);
                say(`${p.name} removed.`);
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="row-acts">
          {p.consent === "pending" ? (
            <>
              <Button size="sm" onClick={() => {
                  updatePerson(p.id, { consent: "granted" });
                  say(`${p.name} agreed to calls.`);
                }}>
                Mark as agreed
              </Button>
              <Button variant="ghost" size="sm" onClick={() => say(`Consent message sent again to ${p.name}.`)}>
                Resend message
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => dialogs.newReminder(p.id)}>
                <PlusIcon size={12} />
                Reminder
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  updatePerson(p.id, { paused: !p.paused });
                  say(p.paused ? `Calls to ${p.name} resumed.` : `Calls to ${p.name} paused.`);
                }}
              >
                {p.paused ? "Resume calls" : "Pause calls"}
              </Button>
            </>
          )}
          <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
            <button type="button" className="icon-btn" aria-label={`Edit ${p.name}`} title="Edit" onClick={() => dialogs.editPerson(p.id)}>
              <EditIcon />
            </button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
              Remove
            </Button>
          </span>
        </div>
      )}
    </Card>
  );
}
