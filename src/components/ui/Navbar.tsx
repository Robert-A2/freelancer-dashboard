"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", mobileLabel: "Home",     Icon: IconHome      },
  { href: "/upload",    label: "Upload CSV", mobileLabel: "Upload",   Icon: IconUpload    },
  { href: "/history",   label: "History",    mobileLabel: "History",  Icon: IconHistory   },
  { href: "/analytics", label: "Analytics",  mobileLabel: "Analytics",Icon: IconAnalytics },
  { href: "/forecast",  label: "Forecast",   mobileLabel: "Forecast", Icon: IconForecast  },
];

export default function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Top bar */}
      <nav className="sticky top-0 z-50 border-b border-[#ECEEE9] bg-white">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-[#1F2937] text-sm tracking-tight">
              Freelancer OS
            </span>
            <div className="hidden md:flex items-center gap-0.5">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === href
                      ? "bg-[#4F7A6512] text-[#4F7A65]"
                      : "text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F7F8F5]"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-[#9CA3AF] hover:text-[#6B7280] transition-colors px-3 py-2 min-h-[44px]"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Mobile bottom navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E8EAE5]">
        <div className="flex items-stretch">
          {NAV_LINKS.map(({ href, mobileLabel, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-col items-center justify-center gap-1 flex-1 py-3 min-h-[56px] transition-colors ${
                  active ? "text-[#4F7A65]" : "text-[#9CA3AF] hover:text-[#6B7280]"
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#4F7A65] rounded-full" />
                )}
                <Icon />
                <span className="text-[11px] font-medium leading-none">{mobileLabel}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
