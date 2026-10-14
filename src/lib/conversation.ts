import { renderGreeting } from "./greetings";
import type { Outcome, TranscriptLine } from "./app/types";

type Replies = { taken: string; thanks: string; later: string; laterAgent: string; no: string; noAgent: string };

const EN: Replies = {
  taken: "Yes, I took it.",
  thanks: "Very good, thank you. Take care.",
  later: "Not yet, I'll take it in a while.",
  laterAgent: "Okay, I'll call again shortly.",
  no: "No.",
  noAgent: "Please take it now, it matters.",
};

const NATIVE: Record<string, Replies> = {
  "hi-IN": { taken: "हाँ, ले ली।", thanks: "बहुत अच्छा, धन्यवाद। अपना ध्यान रखिए।", later: "अभी नहीं, थोड़ी देर में ले लूँगी।", laterAgent: "ठीक है, मैं कुछ देर में फिर फ़ोन करूँगी।", no: "अभी नहीं।", noAgent: "कृपया अभी ले लीजिए, यह ज़रूरी है।" },
  "te-IN": { taken: "అవును, వేసుకున్నాను.", thanks: "చాలా మంచిది, ధన్యవాదాలు. జాగ్రత్తగా ఉండండి.", later: "ఇంకా లేదు, కాసేపటిలో వేసుకుంటాను.", laterAgent: "సరే, కొంతసేపట్లో మళ్ళీ ఫోన్ చేస్తాను.", no: "లేదు.", noAgent: "దయచేసి ఇప్పుడే వేసుకోండి, ఇది ముఖ్యం." },
  "ta-IN": { taken: "ஆமாம், எடுத்துக்கொண்டேன்.", thanks: "மிகவும் நல்லது, நன்றி. கவனமாக இருங்கள்.", later: "இன்னும் இல்லை, கொஞ்ச நேரத்தில் எடுத்துக்கொள்கிறேன்.", laterAgent: "சரி, சிறிது நேரத்தில் மீண்டும் அழைக்கிறேன்.", no: "இல்லை.", noAgent: "தயவுசெய்து இப்போதே எடுத்துக்கொள்ளுங்கள், இது முக்கியம்." },
  "kn-IN": { taken: "ಹೌದು, ತೆಗೆದುಕೊಂಡೆ.", thanks: "ತುಂಬಾ ಒಳ್ಳೆಯದು, ಧನ್ಯವಾದಗಳು. ಜಾಗ್ರತೆಯಾಗಿರಿ.", later: "ಇನ್ನೂ ಇಲ್ಲ, ಸ್ವಲ್ಪ ಹೊತ್ತಿನಲ್ಲಿ ತೆಗೆದುಕೊಳ್ಳುತ್ತೇನೆ.", laterAgent: "ಸರಿ, ಸ್ವಲ್ಪ ಹೊತ್ತಿನಲ್ಲಿ ಮತ್ತೆ ಕರೆ ಮಾಡುತ್ತೇನೆ.", no: "ಇಲ್ಲ.", noAgent: "ದಯವಿಟ್ಟು ಈಗಲೇ ತೆಗೆದುಕೊಳ್ಳಿ, ಇದು ಮುಖ್ಯ." },
  "en-IN": EN,
};

export function englishGreeting(name: string, reminder: string) {
  return `${name}, hello. It's time for your ${reminder}. Have you taken it?`;
}

function stamp(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** The scripted conversation for one call, in the person's language with an English gloss. */
export function transcriptFor(lang: string, name: string, reminder: string, outcome: Outcome): TranscriptLine[] {
  if (outcome === "no_answer") return [];
  const N = NATIVE[lang] ?? EN;
  const lines: Omit<TranscriptLine, "at">[] = [
    { role: "agent", native: renderGreeting(lang, name, reminder), english: englishGreeting(name, reminder) },
  ];
  if (outcome === "taken") {
    lines.push({ role: "user", native: N.taken, english: EN.taken }, { role: "agent", native: N.thanks, english: EN.thanks });
  } else if (outcome === "later") {
    lines.push({ role: "user", native: N.later, english: EN.later }, { role: "agent", native: N.laterAgent, english: EN.laterAgent });
  } else {
    lines.push({ role: "user", native: N.no, english: EN.no }, { role: "agent", native: N.noAgent, english: EN.noAgent });
  }
  const offsets = [2, 11, 19];
  return lines.map((l, i) => ({ ...l, at: stamp(offsets[i]) }));
}
