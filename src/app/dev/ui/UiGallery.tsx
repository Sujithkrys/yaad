"use client";

import { useState, type ReactNode } from "react";
import {
  Button,
  CallNowIcon,
  Card,
  ChipSelect,
  MonoLabel,
  Panel,
  PanelFoot,
  PanelHead,
  PanelTitle,
  PersonIcon,
  Pill,
  PlusIcon,
  SegmentedControl,
  StatBar,
  TickBar,
  type Tick,
} from "@/components/ui";

type Theme = "system" | "light" | "dark";

const SAMPLE_TICKS: Tick[] = Array.from({ length: 32 }, (_, i) => {
  if (i === 4) return { status: "confirmed", filled: true };
  if (i === 5) return { status: "confirmed", filled: true };
  if (i === 15) return { status: "confirmed", filled: true, dim: true };
  if (i === 24) return { status: "retry", filled: true };
  if (i === 26) return { status: "calling", filled: true, selected: true };
  if (i === 30) return { status: "scheduled", filled: true };
  return {};
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel aria-label={title}>
      <PanelHead>
        <h2 className="title">{title}</h2>
      </PanelHead>
      <Card className="gallery-row">{children}</Card>
    </Panel>
  );
}

export function UiGallery() {
  const [theme, setTheme] = useState<Theme>("system");
  const [seg, setSeg] = useState<"tablet" | "walk" | "visit">("tablet");
  const [who, setWho] = useState("all");

  function applyTheme(t: Theme) {
    setTheme(t);
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  return (
    <div className="app" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
      <div className="content">
        <header className="topbar">
          <div>
            <h1>UI components</h1>
            <MonoLabel>Every component in every variant</MonoLabel>
          </div>
          <SegmentedControl
            label="Theme"
            value={theme}
            onChange={applyTheme}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </header>

        <main className="canvas">
          <div className="gallery">
            <Section title="Button">
              <Button>
                <PlusIcon />
                New reminder
              </Button>
              <Button>
                <CallNowIcon />
                Call Amma now
              </Button>
              <Button>Send weekly summary</Button>
              <Button disabled>Confirmed</Button>
            </Section>

            <Section title="Pill">
              <Pill variant="confirmed" />
              <Pill variant="retry" />
              <Pill variant="calling" />
              <Pill variant="scheduled" />
            </Section>

            <Section title="Mono label">
              <MonoLabel>Confirmed today</MonoLabel>
              <MonoLabel>
                Retry after <b>10 min</b>
              </MonoLabel>
            </Section>

            <Section title="Segmented control">
              <SegmentedControl
                label="Reminder type"
                value={seg}
                onChange={setSeg}
                options={[
                  { value: "tablet", label: "Tablet" },
                  { value: "walk", label: "Walk" },
                  { value: "visit", label: "Visit" },
                ]}
              />
            </Section>

            <Section title="Chip select">
              <ChipSelect
                label="Show calls for"
                value={who}
                onChange={setWho}
                icon={<PersonIcon />}
                options={[
                  { value: "all", label: "All family" },
                  { value: "Amma", label: "Amma" },
                  { value: "Nanna", label: "Nanna" },
                ]}
              />
              <ChipSelect
                label="Language"
                value="te"
                onChange={() => {}}
                options={[
                  { value: "te", label: "Telugu" },
                  { value: "hi", label: "Hindi" },
                ]}
              />
            </Section>

            <Section title="Tick bar">
              <div style={{ width: "100%" }}>
                <TickBar ticks={SAMPLE_TICKS} />
                <MonoLabel style={{ marginTop: 8 }}>Confirmed, retry, calling (selected), scheduled, dimmed, empty</MonoLabel>
              </div>
              <div style={{ width: "100%" }}>
                <StatBar on={11} />
              </div>
            </Section>

            <Panel aria-labelledby="demo-title">
              <PanelHead>
                <PanelTitle id="demo-title" info="Panel with a head, two cards and a foot.">
                  Panel and card
                </PanelTitle>
                <MonoLabel as="span">Panel head</MonoLabel>
              </PanelHead>
              <Card className="hero">
                <MonoLabel>Card</MonoLabel>
                <div className="big num">
                  3<small>/ 6</small>
                </div>
              </Card>
              <Card className="hero">
                <MonoLabel>Second card, 6px gap</MonoLabel>
              </Card>
              <PanelFoot>
                <MonoLabel as="span" className="live">
                  <i className="dot" aria-hidden="true" />
                  Panel foot
                </MonoLabel>
                <Button>Action</Button>
              </PanelFoot>
            </Panel>
          </div>
        </main>
      </div>
    </div>
  );
}
