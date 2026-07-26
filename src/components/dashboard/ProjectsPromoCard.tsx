import { getTranslations } from "next-intl/server";
import Link from "next/link";

// Shown once, in place of ExpectedIncomeCard + RunwayCard, when the
// user has never created a project — both of those cards used to render their
// own "create a project" empty state at the same time, saying the same thing
// two different ways. One card, one message.
export default async function ProjectsPromoCard({ basePath = "" }: { basePath?: string }) {
  const t = await getTranslations("dashboard.projectsPromo");
  const isDemo = basePath !== "";

  return (
    <div className="flex items-start gap-4 px-5 py-4 bg-[#1A3048] border border-[#243F5E] rounded-2xl">
      <span className="text-[#3AB5A0] text-xl flex-shrink-0 mt-0.5">🤝</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#A8C6E0] mb-1">{t("title")}</p>
        <p className="text-sm text-[#6A97B4] leading-relaxed">{t("body")}</p>
        <Link href={isDemo ? "/signup" : "/projects"} className="inline-block mt-2 text-xs font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors">
          {isDemo ? t("ctaDemo") : t("cta")} →
        </Link>
      </div>
    </div>
  );
}
