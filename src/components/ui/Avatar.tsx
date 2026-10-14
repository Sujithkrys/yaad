import { cx } from "./cx";

export function Avatar({ name, size }: { name: string; size?: "sm" | "lg" }) {
  return (
    <span className={cx("avatar", size)} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
