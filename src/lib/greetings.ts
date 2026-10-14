// Reminder greeting templates in each language's native script.
// English words such as "BP tablet" stay in Latin script inside {reminder}.

const TEMPLATES: Record<string, string> = {
  hi: "{name}, नमस्ते। {reminder} का समय हो गया है। क्या आपने ले लिया?",
  te: "{name}, నమస్కారం. {reminder} సమయం అయింది. మీరు వేసుకున్నారా?",
  ta: "{name}, வணக்கம். {reminder} நேரம் ஆகிவிட்டது. நீங்கள் எடுத்துக்கொண்டீர்களா?",
  kn: "{name}, ನಮಸ್ಕಾರ. {reminder} ಸಮಯ ಆಯಿತು. ನೀವು ತೆಗೆದುಕೊಂಡಿರಾ?",
  en: "Hello {name}. It's time for your {reminder}. Have you taken it?",
};

/** Accepts "te-IN" or "te". Falls back to English for unknown languages. */
export function renderGreeting(languageCode: string, name: string, reminder: string) {
  const lang = languageCode.split("-")[0].toLowerCase();
  const template = TEMPLATES[lang] ?? TEMPLATES.en;
  return template.replaceAll("{name}", name).replaceAll("{reminder}", reminder);
}
