import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/shell/Brand";
import { NamePrompt } from "@/components/app/NamePrompt";
import { SetupWizard } from "@/components/setup/SetupWizard";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Set up" };

export default function SetupPage() {
  return (
    <div className="l-wrap">
      <header className="l-nav">
        <Brand href="/" />
        <nav className="right" aria-label="Site">
          <Link className={buttonClass("ghost")} href="/">
            Back to site
          </Link>
        </nav>
      </header>
      <main>
        <SetupWizard />
      </main>
      <NamePrompt />
    </div>
  );
}
