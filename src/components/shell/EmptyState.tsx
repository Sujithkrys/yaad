import type { ReactNode } from "react";
import { Card } from "@/components/ui";

type EmptyStateProps = {
  title: string;
  description: string;
  icon: ReactNode;
  action: ReactNode;
};

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <section className="empty" aria-labelledby="empty-title">
      <Card>
        <span className="empty-icon" aria-hidden="true">
          {icon}
        </span>
        <h2 id="empty-title">{title}</h2>
        <p>{description}</p>
        {action}
      </Card>
    </section>
  );
}
