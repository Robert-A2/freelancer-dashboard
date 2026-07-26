import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import DemoNavbar from "@/components/demo/DemoNavbar";

// The interactive demo is a feature of the marketing site, not a page of its
// own — it must never be indexed or shown as a separate search result next
// to the homepage. `follow: true` still lets crawlers pass through it to
// /signup rather than treating it as a dead end.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("demo");

  return (
    <div className="min-h-screen bg-[#0D1B2B] overflow-x-hidden">
      <DemoNavbar />

      {/* Demo banner — persistent, below the navbar */}
      <div className="bg-[#D4A25410] border-b border-[#D4A25430]">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D4A254] flex-shrink-0" />
          <p className="text-xs text-[#D4A254] font-medium">
            {t("banner.text")}
          </p>
          <a href="/signup" className="ml-auto text-xs font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors flex-shrink-0">
            {t("banner.cta")}
          </a>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-5 pt-8 pb-28 sm:px-6 min-[1400px]:pt-12 min-[1400px]:pb-12">
        {children}
      </main>
    </div>
  );
}
