"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Images } from "lucide-react";

export default function NavBar() {
  const pathname = usePathname();
  const isAnnotate = pathname?.startsWith("/annotate");
  const isGallery = pathname?.startsWith("/gallery");
  const isDashboard = !isAnnotate && !isGallery;

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, height: "56px", zIndex: 100,
      background: "rgba(2,2,5,0.85)", borderBottom: "1px solid var(--border)",
      backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
    }}>
      <div style={{
        maxWidth: "1280px", margin: "0 auto", padding: "0 24px",
        height: "100%", display: "flex", alignItems: "center",
        justifyContent: "space-between",
      }}>

        {/* Left side */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>

          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center",
            gap: "10px", textDecoration: "none" }}>
            <div style={{
              width: "30px", height: "30px", borderRadius: "8px", flexShrink: 0,
              background: "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 20px rgba(139,92,246,0.5)",
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z"
                  stroke="white" strokeWidth="1.5" fill="none"
                  strokeLinejoin="round" />
                <circle cx="7" cy="7" r="2" fill="white" />
              </svg>
            </div>
            <span style={{ fontWeight: 600, fontSize: "14px",
              letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
              Synthetic Data Suite
            </span>
          </Link>

          <div style={{ width: "1px", height: "16px", background: "var(--border)" }} />

          {/* Nav links */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {[
              { href: "/",        label: "Dashboard", active: isDashboard },
              { href: "/gallery", label: "Gallery",   active: isGallery },
            ].map(link => (
              <Link key={link.href} href={link.href}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "5px 12px", borderRadius: "7px",
                  textDecoration: "none", fontSize: "13px", fontWeight: 500,
                  color: link.active ? "var(--text-primary)" : "var(--text-secondary)",
                  background: link.active ? "var(--bg-elevated)" : "transparent",
                  border: link.active
                    ? "1px solid var(--border)"
                    : "1px solid transparent",
                  transition: "all 150ms",
                }}
                onMouseEnter={e => {
                  if (!link.active)
                    (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                }}
                onMouseLeave={e => {
                  if (!link.active)
                    (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                }}>
                {link.label}
              </Link>
            ))}
          </div>

          {/* Studio label when in annotate */}
          {isAnnotate && (
            <>
              <div style={{ width: "1px", height: "16px", background: "var(--border)" }} />
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Annotation Studio
              </span>
            </>
          )}
        </div>

        {/* Right side — status badge */}
        <div style={{
          padding: "5px 12px", borderRadius: "6px",
          background: "var(--success-bg)",
          border: "1px solid var(--success-border)",
        }}>
          <span style={{
            fontSize: "11px", color: "var(--success)",
            fontWeight: 600, letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}>
            ML Pipeline Active
          </span>
        </div>
      </div>
    </nav>
  );
}