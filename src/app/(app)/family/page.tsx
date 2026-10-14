import type { Metadata } from "next";
import { FamilyView } from "@/components/family/FamilyView";

export const metadata: Metadata = { title: "Family" };

export default function Page() {
  return <FamilyView />;
}
