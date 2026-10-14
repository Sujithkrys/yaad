"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon } from "./icons";

type ChipSelectProps = {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  icon?: ReactNode;
};

export function ChipSelect({ label, value, options, onChange, icon }: ChipSelectProps) {
  return (
    <label className="chip-select">
      {icon}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="chev" />
    </label>
  );
}
