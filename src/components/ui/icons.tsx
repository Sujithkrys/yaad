import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function stroke({ size = 16, ...rest }: IconProps, strokeWidth = 1.3): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...rest,
  };
}

const PHONE_PATH =
  "M3.2 2.6c.4-.5 1.1-.6 1.6-.2l1.3 1c.4.3.5.9.2 1.3l-.7 1a8 8 0 003.3 3.3l1-.7c.4-.3 1-.2 1.3.2l1 1.3c.4.5.3 1.2-.2 1.6l-.8.7c-.7.6-1.6.7-2.4.4A12 12 0 012.1 5.8c-.3-.8-.2-1.7.4-2.4z";

export function GridIcon(p: IconProps) {
  return (
    <svg {...stroke(p)}>
      <rect x="2" y="2" width="5" height="5" rx="1.2" />
      <rect x="9" y="2" width="5" height="5" rx="1.2" />
      <rect x="2" y="9" width="5" height="5" rx="1.2" />
      <rect x="9" y="9" width="5" height="5" rx="1.2" />
    </svg>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <svg {...stroke(p)}>
      <circle cx="8" cy="8.5" r="5.5" />
      <path d="M8 5.5V8.5l2 1.3" />
    </svg>
  );
}

export function FamilyIcon(p: IconProps) {
  return (
    <svg {...stroke(p)}>
      <circle cx="6" cy="5.5" r="2.2" />
      <path d="M2 13c.5-2.2 2-3.2 4-3.2s3.5 1 4 3.2" />
      <circle cx="11.5" cy="6.2" r="1.7" />
      <path d="M11.5 9.6c1.4 0 2.3.8 2.7 2.4" />
    </svg>
  );
}

export function PhoneIcon(p: IconProps) {
  return (
    <svg {...stroke(p)}>
      <path d={PHONE_PATH} />
    </svg>
  );
}

export function SettingsIcon(p: IconProps) {
  return (
    <svg {...stroke(p)}>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" />
    </svg>
  );
}

export function PlusIcon({ size = 13, ...p }: IconProps) {
  return (
    <svg {...stroke({ size, ...p }, 1.7)}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function CallNowIcon({ size = 13, ...p }: IconProps) {
  return (
    <svg {...stroke({ size, ...p }, 1.5)}>
      <path d={PHONE_PATH} />
    </svg>
  );
}

export function InfoIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...stroke({ size, ...p }, 1.2)}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 7.2v3.6M8 5.2v.1" />
    </svg>
  );
}

export function PersonIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...stroke({ size, ...p }, 1.2)}>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13c.6-2.4 2.6-3.6 5-3.6s4.4 1.2 5 3.6" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 12, ...p }: IconProps) {
  return (
    <svg {...stroke({ size, ...p }, 1.5)}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...stroke({ size, ...p }, 1.5)}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

export function KebabIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden {...p}>
      <circle cx="8" cy="3" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="8" cy="13" r="1.2" />
    </svg>
  );
}

export function SparkleIcon({ size = 13, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden {...p}>
      <path d="M8 1l1.4 4.6L14 7l-4.6 1.4L8 13l-1.4-4.6L2 7l4.6-1.4z" />
    </svg>
  );
}

export function SpeakerIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...stroke({ size, ...p }, 1.4)}>
      <path d="M2.5 6v4h2.6L8.5 13V3L5.1 6z" />
      <path d="M10.8 5.6a3.4 3.4 0 010 4.8M12.6 3.8a6 6 0 010 8.4" />
    </svg>
  );
}

export function StopIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden {...p}>
      <rect x="4" y="4" width="8" height="8" rx="1.5" />
    </svg>
  );
}

export function SpinnerIcon({ size = 14, className, ...p }: IconProps) {
  return (
    <svg {...stroke({ size, ...p }, 1.6)} className={["spin", className].filter(Boolean).join(" ")}>
      <path d="M8 2.2a5.8 5.8 0 105.8 5.8" />
    </svg>
  );
}

export function WaveIcon(p: IconProps) {
  return (
    <svg {...stroke(p)}>
      <path d="M2 7v2M4.6 5v6M7.2 2.5v11M9.8 5v6M12.4 6.5v3M14.5 7.5v1" />
    </svg>
  );
}

export function CloseIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...stroke({ size, ...p }, 1.6)}>
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}

export function EditIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...stroke({ size, ...p }, 1.3)}>
      <path d="M10.5 2.8l2.7 2.7L6 12.7l-3.2.5.5-3.2z" />
    </svg>
  );
}

export function TrashIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...stroke({ size, ...p }, 1.3)}>
      <path d="M2.8 4.3h10.4M6.3 4.3V2.8h3.4v1.5M4.2 4.3l.6 8.9h6.4l.6-8.9" />
    </svg>
  );
}

export function ExitIcon({ size = 15, ...p }: IconProps) {
  return (
    <svg {...stroke({ size, ...p }, 1.4)}>
      <path d="M6 3H3.5v10H6M10 5l3 3-3 3M13 8H6" />
    </svg>
  );
}

export function SearchIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...stroke({ size, ...p }, 1.3)}>
      <circle cx="7" cy="7" r="4.3" />
      <path d="M10.2 10.2l3.3 3.3" />
    </svg>
  );
}

export function BellIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...stroke({ size, ...p }, 1.3)}>
      <path d="M4 11.5V7a4 4 0 018 0v4.5l1.2 1.3H2.8zM6.5 13.8a1.6 1.6 0 003 0" />
    </svg>
  );
}
