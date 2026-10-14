import type { Metadata } from "next";
import Link from "next/link";
import { DemoCall } from "@/components/landing/DemoCall";
import { HearSample } from "@/components/landing/HearSample";
import { Brand } from "@/components/shell/Brand";
import { buttonClass, Card, MonoLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Yaad · Phone-call reminders for your parents",
};

const LANGS = [
  { text: "हिन्दी", lang: "hi" },
  { text: "తెలుగు", lang: "te" },
  { text: "தமிழ்", lang: "ta" },
  { text: "ಕನ್ನಡ", lang: "kn" },
  { text: "English", lang: "en" },
];
const SOON = ["Bengali", "Marathi", "Gujarati", "Punjabi"];

const STEPS = [
  { title: "Add a parent", body: "Enter their name, number and language. They get a short message asking if it's okay to call." },
  { title: "Pick what and when", body: "BP tablet at 7 PM, a morning walk, a doctor visit. Repeat every day or just once." },
  { title: "Get the answer", body: "If they don't pick up, Yaad tries again after 10 minutes, then tells you." },
];

export default function LandingPage() {
  return (
    <div className="l-wrap">
      <header className="l-nav">
        <Brand href="/" />
        <nav className="right" aria-label="Site">
          <Link className={buttonClass("ghost")} href="/dashboard">
            Open dashboard
          </Link>
          <Link className={buttonClass()} href="/setup">
            Set up a reminder
          </Link>
        </nav>
      </header>

      <main>
        <div className="l-stage">
          <div className="l-hero">
            <div>
              <h1>A phone call that reminds your parents, in their own language.</h1>
              <p className="lead">
                Set the reminder once. Yaad phones them at the right time in Telugu, Hindi, Tamil or Kannada, asks if they did
                it, and tells you the answer.
              </p>
              <div className="l-cta">
                <Link className={buttonClass()} href="/setup">
                  Set up a reminder
                </Link>
                <HearSample />
              </div>
              <MonoLabel className="note2">Works on any phone. Nothing for them to install.</MonoLabel>
            </div>
            <DemoCall />
          </div>
        </div>

        <section className="l-sec" aria-labelledby="how">
          <h2 id="how">How it works</h2>
          <div className="steps3">
            {STEPS.map((s, i) => (
              <Card className="step3" key={s.title}>
                <span className="n">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="l-sec" aria-labelledby="langs">
          <h2 id="langs">Speaks the way they do</h2>
          <div className="lang-row">
            {LANGS.map((l) => (
              <span key={l.text} className="lc te" lang={l.lang}>
                {l.text}
              </span>
            ))}
            {SOON.map((l) => (
              <span key={l} className="lc soon">
                {l} <span className="sr-only">coming soon</span>
              </span>
            ))}
          </div>
        </section>

        <section className="l-sec l-two" aria-label="Safety">
          <Card className="step3">
            <h3>Only calls people who say yes</h3>
            <p>Every parent gets a consent message before the first call. You can pause or remove a person at any time.</p>
          </Card>
          <Card className="step3">
            <h3>Never gives medical advice</h3>
            <p>Yaad only reminds. If someone says they feel unwell, it tells them to call you or their doctor.</p>
          </Card>
        </section>
      </main>

      <footer className="l-foot mono">
        <span>Voices by Sarvam Bulbul</span>
        <span>Prototype with sample data</span>
      </footer>
    </div>
  );
}
