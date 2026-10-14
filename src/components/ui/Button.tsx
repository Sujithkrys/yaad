import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

export function Button({ className, type = "button", ...rest }: ComponentPropsWithoutRef<"button">) {
  return <button type={type} className={cx("btn", className)} {...rest} />;
}
