import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cx } from "./cx";

type MonoLabelProps = ComponentPropsWithoutRef<"div"> & { as?: ElementType };

export function MonoLabel({ as: Tag = "div", className, ...rest }: MonoLabelProps) {
  return <Tag className={cx("mono", className)} {...rest} />;
}
