import type { AudioCodec } from "./tts";

/** Byte offset and size of the "data" chunk in a RIFF/WAVE buffer. */
function wavData(buf: Buffer) {
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "data") return { start: offset + 8, size: Math.min(size, buf.length - offset - 8) };
    offset += 8 + size + (size % 2);
  }
  return null;
}

/** Join audio segments. MP3 frames can be concatenated; WAV needs one header. */
export function concatAudio(parts: Buffer[], codec: AudioCodec): Buffer {
  if (parts.length === 1) return parts[0];
  if (codec !== "wav") return Buffer.concat(parts);

  const first = wavData(parts[0]);
  if (!first) return Buffer.concat(parts);
  const header = Buffer.from(parts[0].subarray(0, first.start));
  const bodies = parts.map((p) => {
    const d = wavData(p);
    return d ? p.subarray(d.start, d.start + d.size) : p;
  });
  const dataSize = bodies.reduce((n, b) => n + b.length, 0);
  header.writeUInt32LE(header.length - 8 + dataSize, 4); // RIFF size
  header.writeUInt32LE(dataSize, first.start - 4); // data size
  return Buffer.concat([header, ...bodies]);
}
