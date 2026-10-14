import { Card } from "@/components/ui";

// Layout-stable placeholders while data loads. No spinners.

function Skel({ h, w = "100%" }: { h: number; w?: number | string }) {
  return <div className="skel" style={{ height: h, width: w }} />;
}

function PanelSkeleton() {
  return (
    <section className="panel" aria-hidden="true">
      <div className="panel-head">
        <Skel h={16} w={120} />
        <Skel h={26} w={90} />
      </div>
      <Card className="hero">
        <Skel h={12} w={110} />
        <div style={{ height: 10 }} />
        <Skel h={34} w={90} />
        <div style={{ height: 16 }} />
        <Skel h={26} />
      </Card>
      <Card className="rows fill" style={{ display: "grid", gap: 10, padding: 14 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skel key={i} h={30} />
        ))}
      </Card>
      <div className="panel-foot">
        <Skel h={12} w={100} />
        <Skel h={32} w={120} />
      </div>
    </section>
  );
}

export function Loading({ variant = "list" }: { variant?: "panels" | "list" | "cards" }) {
  const body =
    variant === "panels" ? (
      <div className="panels">
        <PanelSkeleton />
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
    ) : variant === "cards" ? (
      <div className="fam-grid">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="pcard">
            <Skel h={40} w="60%" />
            <Skel h={60} />
            <Skel h={28} w="70%" />
          </Card>
        ))}
      </div>
    ) : (
      <div className="view-stack">
        <Card className="list" style={{ display: "grid", gap: 10, padding: 14 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skel key={i} h={36} />
          ))}
        </Card>
      </div>
    );
  return (
    <div role="status" aria-label="Loading">
      {body}
    </div>
  );
}
