import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { ToastProvider } from "@/components/shell/Toast";
import { TopBar } from "@/components/shell/TopBar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="app">
        <Sidebar />
        <div className="content">
          <TopBar />
          <main className="canvas">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
