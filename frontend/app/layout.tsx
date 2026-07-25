import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import NavBar from "@/components/NavBar";
import NetworkBackground from "@/components/NetworkBackground";

export const metadata: Metadata = {
  title: "Synthetic Data Suite",
  description: "Production-grade AI image generation and annotation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "var(--bg-void)" }}>
        <NetworkBackground />

        <div style={{ position: "relative", zIndex: 1 }}>
          <NavBar />
          <main style={{ paddingTop: "56px", minHeight: "100vh" }}>
            <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px" }}>
              {children}
            </div>
          </main>
        </div>

        <Toaster theme="dark" position="bottom-right"
          toastOptions={{ style: {
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-hover)",
            color: "var(--text-primary)", fontSize: "13px",
            fontFamily: "Inter, sans-serif",
          }}} />
      </body>
    </html>
  );
}