import type { ReactNode } from "react";
import { DialogsProvider } from "@/components/app/DialogsProvider";
import { NamePrompt } from "@/components/app/NamePrompt";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <DialogsProvider>
      <div className="app">
        <Sidebar />
        <div className="content">
          <TopBar />
          <main className="canvas">{children}</main>
        </div>
      </div>
      <NamePrompt />
    </DialogsProvider>
  );
}
