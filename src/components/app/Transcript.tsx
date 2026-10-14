import { MonoLabel } from "@/components/ui";
import { SpeakButton } from "@/components/voice/SpeakButton";
import type { Outcome } from "@/lib/app/types";
import { transcriptFor } from "@/lib/conversation";
import { voicesFor } from "@/lib/voices";

type Props = { lang: string; name: string; reminder: string; outcome: Outcome };

/** Call transcript in the drawer style; agent lines get a play button when a voice exists. */
export function Transcript({ lang, name, reminder, outcome }: Props) {
  const voice = voicesFor(lang)[0];
  const lines = transcriptFor(lang, name, reminder, outcome);
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Call transcript">
      {lines.map((l) => (
        <li key={l.at} className={`tline ${l.role}`}>
          <span className="sq" aria-hidden="true" />
          <div>
            <span className="sr-only">{l.role === "agent" ? "Agent:" : `${name}:`}</span>
            <div className="te" lang={lang.split("-")[0]}>
              {l.native}
            </div>
            <div className="en">{l.english}</div>
          </div>
          <span className="end">
            {voice && l.role === "agent" ? (
              <SpeakButton text={l.native} languageCode={lang} speaker={voice.id} label={`agent line at ${l.at}`} />
            ) : null}
            <MonoLabel as="span" style={{ paddingTop: 3 }}>
              {l.at}
            </MonoLabel>
          </span>
        </li>
      ))}
    </ol>
  );
}
