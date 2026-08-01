"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const IconMore = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);
const IconClose = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export interface MoreNavLink {
  href: string;
  key: string;
  Icon: () => React.ReactElement;
}

// Secondary nav links that don't fit in the primary bar (shared by Navbar and
// DemoNavbar) — a single trigger in the persistent top bar, visible at every
// breakpoint, so it never competes for one of the 5 primary mobile tab slots.
export default function MoreNavDrawer({ links }: { links: MoreNavLink[] }) {
  const pathname = usePathname();
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  const anyActive = links.some(l => isActive(l.href));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t("nav.more")}
        aria-label={t("nav.more")}
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
          anyActive ? "bg-[#3AB5A012] text-[#3AB5A0]" : "text-[#7BA8C4] hover:text-[#E8F0F8] hover:bg-[#1E3446]"
        }`}
      >
        <IconMore />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" />
          <div
            ref={panelRef}
            className="absolute top-0 right-0 h-full w-[85vw] max-w-xs bg-[#17293C] border-l border-[#2D4C68] shadow-[-8px_0_24px_rgba(0,0,0,0.25)] flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#25405A]">
              <p className="text-sm font-semibold text-[#E8F0F8]">{t("nav.more")}</p>
              <button
                onClick={() => setOpen(false)}
                aria-label={t("buttons.close")}
                className="p-2 rounded-lg text-[#6A97B4] hover:text-[#E8F0F8] hover:bg-[#1E3446] transition-colors flex-shrink-0"
              >
                <IconClose />
              </button>
            </div>

            <nav className="flex flex-col p-2">
              {links.map(({ href, key, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive(href) ? "bg-[#3AB5A012] text-[#3AB5A0]" : "text-[#A8C6E0] hover:text-[#E8F0F8] hover:bg-[#1E3446]"
                  }`}
                >
                  <Icon />
                  {t(`nav.${key}`)}
                </Link>
              ))}
            </nav>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
