import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "ghost" | "bad";
  size?: "md" | "sm";
};

export function buttonClass(variant: ButtonProps["variant"] = "primary", size: ButtonProps["size"] = "md") {
  return cx(variant === "ghost" ? "btn-ghost" : "btn", variant === "bad" && "btn-bad", size === "sm" && "btn-sm");
}

export function Button({ className, type = "button", variant, size, ...rest }: ButtonProps) {
  return <button type={type} className={cx(buttonClass(variant, size), className)} {...rest} />;
}
