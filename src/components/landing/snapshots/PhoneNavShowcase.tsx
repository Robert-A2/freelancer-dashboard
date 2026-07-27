import { getTranslations } from "next-intl/server";
import PhoneForecastShowcase from "@/components/landing/PhoneForecastShowcase";

// Frozen real snapshot from the Forecast page — same content, same order,
// same i18n keys as src/app/(dashboard)/forecast/page.tsx's health-overview
// row and "How This Forecast Was Built" card (Year-End Projection in
// between is intentionally skipped). Only the two data-specific insight
// sentences are hardcoded (landing.forecastShowcase.*); everything else —
// labels, risk copy, confidence-reason text — reuses the real translation
// keys the forecast page itself uses. This component only fetches strings;
// the client component does the phased pop-out animation.
const CONFIDENCE_PCT = 83;

export default async function PhoneNavShowcase() {
  const t  = await getTranslations("common");
  const tf = await getTranslations("forecast");
  const td = await getTranslations("dashboard");
  const ts = await getTranslations("landing.forecastShowcase");

  const navLabels = {
    dashboard: t("nav.dashboardMobile"),
    upload:    t("nav.uploadMobile"),
    projects:  t("nav.projectsMobile"),
    clients:   t("nav.clientsMobile"),
    analytics: t("nav.analyticsMobile"),
    forecast:  t("nav.forecastMobile"),
  };

  const health = {
    label: tf("healthScore.label"),
    badge: td("health.watch"),
    badgeClass: "bg-[#D4A2540A] text-[#D4A254]",
    body: ts("healthExplanation"),
    bodyClass: "text-[#D4A254]",
  };

  const cashflowRisk = {
    label: tf("cashflowRiskLabel"),
    title: tf("cashflowRisk.medium.label"),
    desc: tf("cashflowRisk.medium.desc"),
    monthsPositive: tf("monthsPositive", { positive: 11, total: 14 }),
  };

  const direction = {
    label: tf("businessDirection"),
    badge: tf("trend.weakening"),
    badgeClass: "bg-[#E5484D15] text-[#E5484D]",
    body: ts("directionInsight"),
    bodyClass: "text-[#7BA8C4]",
  };

  const howBuilt = {
    label: tf("howBuilt.label"),
    tiles: [
      { label: tf("howBuilt.dataAnalyzed"), value: "June 2025 – July 2026" },
      { label: tf("howBuilt.monthsOfHistory"), value: tf("howBuilt.monthsValue", { count: 14 }) },
      { label: tf("howBuilt.transactions"), value: "231" },
      { label: tf("howBuilt.forecastConfidence"), value: tf("confidenceLevels.high"), color: "text-[#4CC4A4]" },
    ],
    methodologyLabel: tf("howBuilt.methodologyLabel"),
    methodologySubtitle: tf("howBuilt.methodologySubtitle"),
    confidenceScoreLabel: tf("howBuilt.confidenceScore"),
    confidencePct: CONFIDENCE_PCT,
    reasons: [
      tf("howBuilt.confidence.depthSolid", { count: 14 }),
      tf("howBuilt.confidence.volatilityMedium"),
      tf("howBuilt.confidence.classMedium", { pct: 62 }),
    ],
  };

  return (
    <PhoneForecastShowcase
      appName={t("appName")}
      health={health}
      cashflowRisk={cashflowRisk}
      direction={direction}
      howBuilt={howBuilt}
      navLabels={navLabels}
    />
  );
}
