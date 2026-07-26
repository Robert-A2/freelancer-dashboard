"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

const IconHome = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 001 1h3m10-11 2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
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
const IconReports = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const NAV_LINKS = [
  { href: "/demo",          key: "dashboard", Icon: IconHome      },
  { href: "/demo/history",  key: "history",   Icon: IconHistory   },
  { href: "/demo/clients",  key: "clients",   Icon: IconClients   },
  { href: "/demo/analytics",key: "analytics", Icon: IconAnalytics },
  { href: "/demo/forecast", key: "forecast",  Icon: IconForecast  },
  { href: "/demo/reports",  key: "reports",   Icon: IconReports   },
] as const;

const MOBILE_NAV_LINKS = NAV_LINKS;

export default function DemoNavbar() {
  const pathname = usePathname();
  const t = useTranslations("common");

  function isActive(href: string) {
    if (href === "/demo") return pathname === "/demo";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Top bar */}
      <nav className="sticky top-0 z-50 border-b border-[#1E3550] bg-[#132537]">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold text-[#E8F0F8] text-sm tracking-tight hover:opacity-80 transition-opacity">
              {t("appName")}
            </Link>
            <div className="hidden min-[1400px]:flex items-center gap-0.5">
              {NAV_LINKS.map(({ href, key }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
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
            <LanguageSwitcher />
            <Link
              href="/signup"
              className="hidden sm:inline-flex whitespace-nowrap text-xs font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors px-3 py-2"
            >
              {t("buttons.createAccount")}
            </Link>
            <Link
              href="/login"
              className="btn-primary text-xs py-2 px-4 whitespace-nowrap"
            >
              {t("buttons.signIn")}
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile bottom navigation */}
      <div className="min-[1400px]:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#132537] border-t border-[#243F5E]">
        <div className="flex items-stretch">
          {MOBILE_NAV_LINKS.map(({ href, key, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-col items-center justify-center gap-1 flex-1 py-3 min-h-[56px] transition-colors ${
                  active ? "text-[#3AB5A0]" : "text-[#6A97B4] hover:text-[#7BA8C4]"
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#3AB5A0] rounded-full" />
                )}
                <Icon />
                <span className={`text-[11px] leading-none ${active ? "font-semibold" : "font-medium"}`}>
                  {t(`nav.${key}Mobile`)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
