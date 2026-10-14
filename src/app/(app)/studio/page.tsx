import type { Metadata } from "next";
import { VoiceStudio } from "@/components/voice/VoiceStudio";

export const metadata: Metadata = { title: "Voice preview" };

export default function StudioPage() {
  return <VoiceStudio />;
}
