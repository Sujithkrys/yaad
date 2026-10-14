import type { ReactNode } from "react";
import { cx } from "./cx";

type EmptyStateProps = { title: string; description: string; icon?: ReactNode; action?: ReactNode; small?: boolean };

export function EmptyState({ title, description, icon, action, small }: EmptyStateProps) {
  return (
    <div className={cx("empty", small && "small")}>
      {icon ? (
        <span className="empty-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
