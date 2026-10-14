"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon } from "./icons";

type ChipSelectProps = {
  label: string;
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
  id?: string;
  onChange: (value: string) => void;
  icon?: ReactNode;
};

export function ChipSelect({ label, value, options, onChange, icon, disabled, id }: ChipSelectProps) {
  return (
    <label className="chip-select">
      {icon}
      <select id={id} aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="chev" />
    </label>
  );
}
