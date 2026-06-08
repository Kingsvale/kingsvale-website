import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "TaskForge Workspace",
  description: "A self-hosted live task workspace for teams."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <div className="ambient-canvas" aria-hidden="true">
          <div className="ambient-blob animate-float bg-[#5E6AD2]" style={{ width: 920, height: 980, left: "28%", top: "-28%" }} />
          <div className="ambient-blob animate-float-slow bg-fuchsia-500" style={{ width: 620, height: 760, left: "-16%", top: "8%", opacity: 0.14 }} />
          <div className="ambient-blob animate-float bg-sky-500" style={{ width: 560, height: 720, right: "-14%", top: "14%", opacity: 0.12 }} />
          <div className="ambient-blob animate-float-slow bg-[#5E6AD2]" style={{ width: 740, height: 420, left: "26%", bottom: "-26%", opacity: 0.1 }} />
        </div>
        <div className="noise" aria-hidden="true" />
        <div className="relative z-10 min-h-screen">{children}</div>
      </body>
    </html>
  );
}
