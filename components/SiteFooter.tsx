"use client";

import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname() ?? "";
  if (pathname === "/") return null;

  return (
    <footer className="mt-auto py-6 text-center text-xs text-muted">
      made with <span aria-label="love">❤️</span> in SW6
    </footer>
  );
}
