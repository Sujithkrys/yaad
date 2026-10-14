import { MonoLabel } from "@/components/ui";
import { SpeakButton } from "@/components/voice/SpeakButton";
import type { TranscriptLine } from "@/lib/types";
import { voicesFor } from "@/lib/voices";

type Props = { lines: TranscriptLine[]; lang: string; name: string };

/** Call transcript in the drawer style; agent lines get a play button when a voice exists. */
export function Transcript({ lines, lang, name }: Props) {
  const voice = voicesFor(lang)[0];
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Call transcript">
      {lines.map((l, i) => (
        <li key={`${l.at}-${i}`} className={`tline ${l.role}`}>
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
