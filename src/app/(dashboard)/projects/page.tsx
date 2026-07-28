import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getExpectedIncome } from "@/lib/milestone-engine";
import { getRunway } from "@/lib/runway-engine";
import { getDefaultVatRatePct } from "@/lib/vat-rates";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import Link from "next/link";
import NewProjectPanel from "@/components/projects/NewProjectPanel";
import ProjectList, { type ProjectView } from "@/components/projects/ProjectList";
import RunwayCard from "@/components/dashboard/RunwayCard";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("projects");
  const locale = (await getLocale()) as Locale;

  const [dbProjects, dbUser, expectedIncome, runway] = await Promise.all([
    prisma.project.findMany({
      where: { userId: user.id },
      include: { milestones: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeAccountEnabled: true, brandLogoUrl: true, brandAccentColor: true, brandFont: true, vatStatus: true, country: true },
    }),
    getExpectedIncome(user.id),
    getRunway(user.id),
  ]);

  const projects: ProjectView[] = dbProjects.map((p) => ({
    id: p.id,
    clientName: p.clientName,
    projectName: p.projectName,
    totalValue: Number(p.totalValue),
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    milestones: p.milestones.map((m) => ({
      id: m.id,
      label: m.label,
      amount: Number(m.amount),
      status: m.status,
      dueDate: m.dueDate ? m.dueDate.toISOString() : null,
      paymentUrlToken: m.paymentUrlToken,
      paidAt: m.paidAt ? m.paidAt.toISOString() : null,
      invoiceNumber: m.invoiceNumber,
      vatRatePct: m.vatRatePct != null ? Number(m.vatRatePct) : null,
      isReverseCharge: m.isReverseCharge,
    })),
  }));

  const vatRegistered = dbUser?.vatStatus === "registered";
  const defaultVatRatePct = getDefaultVatRatePct(dbUser?.country ?? null);

  // Active projects first, completed ones sink below — a completed project
  // shouldn't compete for attention with work that's still in flight.
  projects.sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed"));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="label-light mb-1">{t("label")}</p>
          <h1 className="text-2xl font-bold text-[#16283B]">{t("title")}</h1>
          <p className="text-[#5B7185] text-sm mt-0.5">{t("subtitle")}</p>
        </div>
        {projects.length > 0 && (
          <NewProjectPanel locale={locale} vatRegistered={vatRegistered} defaultVatRatePct={defaultVatRatePct} />
        )}
      </div>

      {projects.length > 0 && <RunwayCard data={runway!} locale={locale} />}

      {expectedIncome.overdueCount > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#FCEAEA] border border-[#F3C6C4] rounded-xl">
          <span className="text-[#C0392B] flex-shrink-0 mt-0.5">⚠</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#C0392B]">
              {t("overdueSummary.heading", { count: expectedIncome.overdueCount })}
            </p>
            <p className="text-sm text-[#5B7185] mt-0.5">
              {t("overdueSummary.body", { amount: formatCurrency(expectedIncome.overdueAmount, locale), count: expectedIncome.overdueCount })}
            </p>
          </div>
        </div>
      )}

      {!dbUser?.stripeAccountEnabled && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#FDF3E3] border border-[#F2DEB3] rounded-xl">
          <span className="text-[#A66A0A] flex-shrink-0 mt-0.5">◈</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#A66A0A]">{t("noStripeBanner.title")}</p>
            <p className="text-sm text-[#5B7185] mt-0.5 leading-relaxed">{t("noStripeBanner.body")}</p>
            <Link href="/settings" className="inline-block mt-2 text-xs font-semibold text-[#A66A0A] hover:text-[#8A5608] transition-colors">
              {t("noStripeBanner.cta")}
            </Link>
          </div>
        </div>
      )}

      {projects.length > 0 && !dbUser?.brandLogoUrl && !dbUser?.brandAccentColor && !dbUser?.brandFont && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#E8F7F3] border border-[#C9E9E1] rounded-xl">
          <span className="text-[#1F8A73] flex-shrink-0 mt-0.5">◈</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#1F8A73]">{t("brandingNudge.title")}</p>
            <p className="text-sm text-[#5B7185] mt-0.5 leading-relaxed">{t("brandingNudge.body")}</p>
            <Link href="/settings" className="inline-block mt-2 text-xs font-semibold text-[#1F8A73] hover:text-[#166B58] transition-colors">
              {t("brandingNudge.cta")}
            </Link>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="card-light text-center py-16">
          <div className="text-5xl mb-4">🤝</div>
          <h2 className="text-xl font-semibold mb-2 text-[#16283B]">{t("emptyState.heading")}</h2>
          <p className="text-[#5B7185] mb-6 max-w-sm mx-auto">{t("emptyState.body")}</p>
          <NewProjectPanel locale={locale} vatRegistered={vatRegistered} defaultVatRatePct={defaultVatRatePct} />
        </div>
      ) : (
        <ProjectList projects={projects} locale={locale} />
      )}
    </div>
  );
}
