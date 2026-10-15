import type { ReactNode } from "react";
import { DialogsProvider } from "@/components/app/DialogsProvider";
import { AccountPrompt } from "@/components/app/AccountPrompt";
import { PasswordNudge } from "@/components/app/PasswordNudge";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <DialogsProvider>
      <div className="app">
        <Sidebar />
        <div className="content">
          <TopBar />
          <PasswordNudge />
          <main className="canvas">{children}</main>
        </div>
      </div>
      <AccountPrompt />
    </DialogsProvider>
  );
}
