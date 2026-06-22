"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import FeedbackButton from "./FeedbackButton";
import LanguageSwitcher from "./LanguageSwitcher";

const IconHome = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 001 1h3m10-11 2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const IconUpload = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);
const IconHistory = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconAnalytics = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);
const IconForecast = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
  </svg>
);
const IconClients = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);
const IconSettings = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const NAV_LINKS = [
  { href: "/dashboard", key: "dashboard", Icon: IconHome      },
  { href: "/upload",    key: "upload",    Icon: IconUpload    },
  { href: "/history",   key: "history",   Icon: IconHistory   },
  { href: "/analytics", key: "analytics", Icon: IconAnalytics },
  { href: "/forecast",  key: "forecast",  Icon: IconForecast  },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const t = useTranslations("common");
  const [pending, setPending] = useState<string | null>(null);

  // Clear pending once the real pathname catches up
  useEffect(() => { setPending(null); }, [pathname]);

  function isActive(href: string) {
    if (pending === href) return true;
    return pathname === href;
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Top bar */}
      <nav className="sticky top-0 z-50 border-b border-[#1E3550] bg-[#132537]">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-[#E8F0F8] text-sm tracking-tight">
              {t("appName")}
            </span>
            <div className="hidden md:flex items-center gap-0.5">
              {NAV_LINKS.map(({ href, key }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setPending(href)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(href)
                      ? "bg-[#3AB5A012] text-[#3AB5A0]"
                      : "text-[#7BA8C4] hover:text-[#E8F0F8] hover:bg-[#1A3048]"
                  }`}
                >
                  {t(`nav.${key}`)}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="hidden sm:flex" />
            <FeedbackButton />
            <Link
              href="/settings"
              onClick={() => setPending("/settings")}
              title={t("nav.settings")}
              className={`p-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                isActive("/settings")
                  ? "bg-[#3AB5A012] text-[#3AB5A0]"
                  : "text-[#6A97B4] hover:text-[#7BA8C4] hover:bg-[#1A3048]"
              }`}
            >
              <IconSettings />
            </Link>
            <button
              onClick={handleSignOut}
              className="text-xs text-[#6A97B4] hover:text-[#7BA8C4] transition-colors px-3 py-2 min-h-[44px]"
            >
              {t("buttons.signOut")}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile bottom navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#132537] border-t border-[#243F5E]">
        <div className="flex items-stretch">
          {NAV_LINKS.map(({ href, key, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setPending(href)}
                className={`relative flex flex-col items-center justify-center gap-1 flex-1 py-3 min-h-[56px] transition-colors ${
                  active ? "text-[#3AB5A0]" : "text-[#6A97B4] hover:text-[#7BA8C4]"
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#3AB5A0] rounded-full" />
                )}
                <Icon />
                <span className="text-[11px] font-medium leading-none">{t(`nav.${key}Mobile`)}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
