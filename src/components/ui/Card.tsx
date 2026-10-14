import type { ComponentProps } from "react";
import { cx } from "./cx";

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("card", className)} {...rest} />;
}
