"use client";

import { useDialogs } from "@/components/app/DialogsProvider";
import { useToast } from "@/components/shell/Toast";
import { Avatar, Button, EditIcon, MonoLabel, SpeakerIcon, SpinnerIcon, StopIcon, Toggle, TrashIcon, cx } from "@/components/ui";
import { useSpeech } from "@/components/voice/useSpeech";
import { removeReminder, updateReminder } from "@/lib/app/store";
import { fmtHHMM, inQuietHours } from "@/lib/app/time";
import type { Person, Reminder, Settings } from "@/lib/app/types";
import { renderGreeting } from "@/lib/greetings";
import { LANGUAGES, voicesFor } from "@/lib/voices";

const REPEAT_LABEL = { daily: "Every day", weekdays: "Weekdays", once: "Once" } as const;
const KIND_LABEL = { tablet: "Tablet", walk: "Walk", visit: "Visit" } as const;

type Props = {
  reminder: Reminder;
  person: Person;
  settings: Settings;
  confirming: boolean;
  onConfirm: (on: boolean) => void;
};

export function ReminderRow({ reminder: r, person, settings, confirming, onConfirm }: Props) {
  const dialogs = useDialogs();
  const say = useToast();
  const speech = useSpeech();
  const voice = voicesFor(person.lang)[0];
  const lang = LANGUAGES.find((l) => l.code === person.lang)?.label ?? person.lang;
  const quiet = inQuietHours(r.time, settings);
  const blocked = person.consent === "pending" ? "Waiting for consent" : person.paused ? "Person paused" : quiet ? "In quiet hours" : null;

  function play() {
    if (speech.state === "playing" || speech.state === "loading") return speech.stop();
    if (voice) speech.play({ text: renderGreeting(person.lang, person.name, r.text), languageCode: person.lang, speaker: voice.id });
  }

  return (
    <li className={cx("lrow", !r.active && "paused")}>
      <div className="wp">
        <Avatar name={person.name} size="sm" />
        <div>
          <div className="main">{person.name}</div>
          <MonoLabel className="sub">{person.relation}</MonoLabel>
        </div>
      </div>
      <div className="c-text">
        <div className="main">{r.text}</div>
        <MonoLabel className="sub">
          {KIND_LABEL[r.kind]}
          {blocked ? ` · ${blocked}` : ""}
        </MonoLabel>
      </div>
      <div className="c-when">
        <div className="main num">{fmtHHMM(r.time)}</div>
        <MonoLabel className="sub">{REPEAT_LABEL[r.repeat]}</MonoLabel>
      </div>
      <MonoLabel className="c-lang">{lang}</MonoLabel>
      <Toggle
        checked={r.active}
        label={`${r.active ? "Pause" : "Resume"} ${r.text} for ${person.name}`}
        onChange={(on) => {
          updateReminder(r.id, { active: on });
          say(on ? `${r.text} for ${person.name} resumed.` : `${r.text} for ${person.name} paused.`);
        }}
      />
      <div className="acts">
        <button
          type="button"
          className="icon-btn"
          data-state={speech.state}
          disabled={!voice}
          aria-label={voice ? `Play what ${person.name} will hear` : `No ${lang} voice added yet`}
          title={voice ? "Play" : "No voice added yet"}
          onClick={play}
        >
          {speech.state === "loading" ? <SpinnerIcon /> : speech.state === "playing" ? <StopIcon /> : <SpeakerIcon />}
        </button>
        <button type="button" className="icon-btn" aria-label={`Edit ${r.text} for ${person.name}`} title="Edit" onClick={() => dialogs.editReminder(r.id)}>
          <EditIcon />
        </button>
        <button type="button" className="icon-btn" aria-label={`Delete ${r.text} for ${person.name}`} title="Delete" onClick={() => onConfirm(true)}>
          <TrashIcon />
        </button>
      </div>
      {confirming ? (
        <div className="confirm-bar" role="alert">
          <span>
            Delete <b>{r.text}</b> for {person.name}? Calls stop right away.
          </span>
          <div>
            <Button variant="ghost" size="sm" onClick={() => onConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="bad"
              size="sm"
              onClick={() => {
                removeReminder(r.id);
                onConfirm(false);
                say("Reminder deleted.");
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      ) : null}
      {speech.state === "error" ? <p className="warn confirm-bar">{speech.message}</p> : null}
    </li>
  );
}
