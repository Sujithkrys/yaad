import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./cx";
import { InfoIcon } from "./icons";

export function Panel({ className, ...rest }: ComponentPropsWithoutRef<"section">) {
  return <section className={cx("panel", className)} {...rest} />;
}

export function PanelHead({ className, ...rest }: ComponentPropsWithoutRef<"div">) {
  return <div className={cx("panel-head", className)} {...rest} />;
}

export function PanelFoot({ className, ...rest }: ComponentPropsWithoutRef<"div">) {
  return <div className={cx("panel-foot", className)} {...rest} />;
}

type PanelTitleProps = {
  id: string;
  children: ReactNode;
  /** Optional explanation shown as a native tooltip next to the title. */
  info?: string;
};

export function PanelTitle({ id, children, info }: PanelTitleProps) {
  return (
    <h2 className="title">
      <span id={id}>{children}</span>
      {info ? (
        <span className="info" title={info} role="img" aria-label={info}>
          <InfoIcon />
        </span>
      ) : null}
    </h2>
  );
}
