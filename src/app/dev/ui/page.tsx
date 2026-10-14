import type { Metadata } from "next";
import { UiGallery } from "./UiGallery";

export const metadata: Metadata = { title: "UI components" };

export default function DevUiPage() {
  return <UiGallery />;
}
