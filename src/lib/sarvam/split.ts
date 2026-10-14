export const MAX_CHARS = 2500;

// Sentence enders: Latin punctuation, Devanagari danda and double danda.
const SENTENCE = /[^.!?।॥\n]+(?:[.!?।॥]+|\n+|$)/g;

/** Split text into chunks of at most `max` characters, breaking at sentence boundaries. */
export function splitText(text: string, max = MAX_CHARS): string[] {
  const sentences = (text.match(SENTENCE) ?? [text]).map((s) => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  const push = () => {
    if (current) chunks.push(current);
    current = "";
  };

  for (const sentence of sentences) {
    if (sentence.length > max) {
      // A single sentence that is too long: fall back to word boundaries.
      push();
      let rest = sentence;
      while (rest.length > max) {
        const cut = rest.lastIndexOf(" ", max);
        const at = cut > 0 ? cut : max;
        chunks.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      current = rest;
      continue;
    }
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > max) {
      push();
      current = sentence;
    } else {
      current = next;
    }
  }
  push();
  return chunks;
}
