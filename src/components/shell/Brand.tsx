import Link from "next/link";

const LOGO_SRC = "/logo/Orange%20Calling%20Y%20Icon.png";

export function Brand({ href }: { href: string }) {
  return (
    <Link href={href} className="brand" aria-label="Yaad home">
      <span className="logo" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_SRC} alt="" width={28} height={28} />
      </span>
      <span className="brand-name">Yaad</span>
    </Link>
  );
}
