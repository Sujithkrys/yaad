"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonClass } from "@/components/ui";
import { useWorkspace } from "@/lib/client/hooks";

/** Accounts made before passwords existed: ask the owner to set one. */
export function PasswordNudge() {
  const { workspace } = useWorkspace();
  const path = usePathname();
  if (!workspace || workspace.hasPassword || path.startsWith("/settings")) return null;
  return (
    <div className="card nudge" role="status">
      <p className="warn">Set a password so you can log in to &ldquo;{workspace.name}&rdquo; from your other devices.</p>
      <Link className={buttonClass("primary", "sm")} href="/settings#password">
        Set password
      </Link>
    </div>
  );
}
