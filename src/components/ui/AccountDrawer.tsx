"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

const IconUser = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconSettings = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconClients = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);
const IconClose = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function AccountDrawer({ fullName, email }: { fullName: string; email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on navigation — a link inside the drawer was followed.
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

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = (fullName || email || "?").trim().charAt(0).toUpperCase();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t("nav.account")}
        aria-label={t("nav.account")}
        className="w-9 h-9 rounded-full bg-[#3AB5A0] text-[#112232] font-semibold text-sm flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity"
      >
        {initial}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" />
          <div
            ref={panelRef}
            className="absolute top-0 right-0 h-full w-[85vw] max-w-xs bg-[#17293C] border-l border-[#2D4C68] shadow-[-8px_0_24px_rgba(0,0,0,0.25)] flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#25405A]">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#E8F0F8] truncate">{fullName || email}</p>
                <p className="text-xs text-[#6A97B4] truncate mt-0.5">{email}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label={t("buttons.close")}
                className="p-2 rounded-lg text-[#6A97B4] hover:text-[#E8F0F8] hover:bg-[#1E3446] transition-colors flex-shrink-0"
              >
                <IconClose />
              </button>
            </div>

            <nav className="flex flex-col p-2">
              <Link
                href="/profile"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive("/profile") ? "bg-[#3AB5A012] text-[#3AB5A0]" : "text-[#A8C6E0] hover:text-[#E8F0F8] hover:bg-[#1E3446]"
                }`}
              >
                <IconUser />
                {t("nav.profile")}
              </Link>
              <Link
                href="/clients"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive("/clients") ? "bg-[#3AB5A012] text-[#3AB5A0]" : "text-[#A8C6E0] hover:text-[#E8F0F8] hover:bg-[#1E3446]"
                }`}
              >
                <IconClients />
                {t("nav.clients")}
              </Link>
              <Link
                href="/settings"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive("/settings") ? "bg-[#3AB5A012] text-[#3AB5A0]" : "text-[#A8C6E0] hover:text-[#E8F0F8] hover:bg-[#1E3446]"
                }`}
              >
                <IconSettings />
                {t("nav.settings")}
              </Link>
            </nav>

            <div className="mt-auto p-4 border-t border-[#25405A]">
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#E5484D] hover:bg-[#E5484D1A] transition-colors disabled:opacity-50"
              >
                {signingOut ? t("buttons.signingOut") : t("buttons.signOut")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
