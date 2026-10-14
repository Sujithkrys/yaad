import type { Metadata } from "next";
import { UiGallery } from "./UiGallery";

export const metadata: Metadata = { title: "UI components · Yaad" };

export default function DevUiPage() {
  return <UiGallery />;
}
