"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import { getExpectedPaymentDisplayStatus } from "@/lib/upcoming-item";
import type { UpcomingItem } from "@/lib/upcoming-item";
import type { Locale } from "@/i18n/locales";
import type { ReserveForPayment } from "@/lib/reserve-engine";
import type { MoneyBreakdown, MoneyBreakdownProjection } from "@/lib/money-breakdown";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { todayInputValue, dateInputValue } from "@/lib/date-input";
import ReserveBreakdown from "@/components/ui/ReserveBreakdown";
import MoneyBreakdownSummary from "@/components/ui/MoneyBreakdownSummary";

type View = "detail" | "edit" | "markReceived" | "received";

interface Scenario {
  reserve: ReserveForPayment;
  current: MoneyBreakdown;
  scenario: MoneyBreakdownProjection;
}

// Expected-payment detail/edit/mark-received flow (spec sections 5-6, 9-10)
// — reuses QuickAddDrawer/MonthDrawer's portal/backdrop/ESC pattern rather
// than inventing a new one. Only ever touches ExpectedPayment + (via
// markReceived, server-side) a single new Transaction; never Forecast,
// Analytics, or any other existing calculation.
export default function ExpectedPaymentDrawer({
  item,
  onClose,
  demoScenario,
  demoAfter,
  demoAutoPlay,
}: {
  item: UpcomingItem | null;
  onClose: () => void;
  /** Landing-page product showcase only (src/lib/landing-demo-data.ts) — when
   * set, skips the real /api/expected-payments fetch and PATCH entirely and
   * uses this precomputed scenario instead. Undefined for every real caller,
   * so real behavior is unchanged. */
  demoScenario?: Scenario;
  /** Paired with demoScenario — the Current cash / Money in this month to
   * show on the simulated "received" confirmation, instead of a real
   * /api/today-facts fetch. */
  demoAfter?: { currentCash: number; moneyInThisMonth: number };
  /** Landing-page product showcase only — self-advances detail -> mark as
   * received -> confirm -> done, then closes, entirely via real onClick
   * handlers (no DOM simulation). Undefined for every real caller. */
  demoAutoPlay?: boolean;
}) {
  const t = useTranslations("manual.expectedPayment");
  const tQuickAdd = useTranslations("manual.quickAdd.forms.expectedPayment");
  // Reuses Quick Add's exact reward copy (Current cash / Income this month /
  // For this payment / Done) rather than a second set of near-identical
  // strings for this drawer's own confirmation screen.
  const tQuickAddReward = useTranslations("manual.quickAdd.reward");
  // Runway copy reused verbatim from the Dashboard's Money Breakdown card —
  // one namespace, never a second set of "X months" strings.
  const tDashMoney = useTranslations("dashboard.moneyBreakdown");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<View>("detail");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editAmount, setEditAmount] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editProject, setEditProject] = useState("");
  const [editDate, setEditDate] = useState("");

  const [receivedAmount, setReceivedAmount] = useState("");
  const [receivedDate, setReceivedDate] = useState(todayInputValue());

  // Set once confirmReceived() succeeds — drives the "received" confirmation
  // view (spec section 7's own worked example: "Current Cash / Money In this
  // month" shown right after confirming). Money received must never be
  // confirmed silently.
  const [receivedResult, setReceivedResult] = useState<{ amount: number; reserve: ReserveForPayment | null } | null>(null);
  const [facts, setFacts] = useState<{ currentCash: number; moneyInThisMonth: number } | null>(null);
  const [receivedBreakdown, setReceivedBreakdown] = useState<MoneyBreakdown | null>(null);

  // "Before it arrives" — gross/reserve/after-reserve for this one payment
  // plus the "if this arrives" projection (spec sections 6, 32). Fetched
  // fresh per item since it depends on this payment's own amount.
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Reset to the detail view and re-seed the edit/receive forms every time a
  // different (or newly reopened) item is shown.
  useEffect(() => {
    if (!item) return;
    // Landing-page product showcase only — tells the outer app-shell
    // (which can't otherwise reach across the Server Component boundary
    // that TodayLayer sits on) that a fresh cycle is starting, so it can
    // show the "before" dashboard state again. No-op without a listener.
    if (demoScenario && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nonodia-demo-state", { detail: { received: false } }));
    }
    setView("detail");
    setError(null);
    setEditAmount(String(item.amount));
    setEditClient(item.clientName ?? "");
    setEditProject(item.projectName ?? "");
    setEditDate(dateInputValue(item.date));
    setReceivedAmount(String(item.amount));
    setReceivedDate(todayInputValue());
    setReceivedResult(null);
    setFacts(null);
    setReceivedBreakdown(null);
    setScenario(null);

    // Recurring expenses share this drawer's item shape but have no
    // expected-payments scenario endpoint — only fetch for income items.
    if (item.kind !== "expected_income") return;
    if (demoScenario) { setScenario(demoScenario); return; }
    setScenarioLoading(true);
    fetchWithTimeout(`/api/expected-payments/${item.id}`, {})
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setScenario(data); })
      .catch(() => { /* detail view still works without the scenario — non-fatal */ })
      .finally(() => setScenarioLoading(false));
  }, [item, demoScenario]);

  // Landing-page product showcase only — self-advances through the same
  // steps a visitor could click through manually, via the same view-state
  // transitions and the same confirmReceived() above (which no-ops the real
  // mutation when demoScenario is set). Undefined demoAutoPlay -> no timers,
  // zero effect on real usage.
  useEffect(() => {
    if (!demoAutoPlay || !item || !demoScenario) return;
    if (view === "detail") {
      const t = setTimeout(() => setView("markReceived"), 2300);
      return () => clearTimeout(t);
    }
    if (view === "markReceived") {
      const t = setTimeout(() => { confirmReceived(); }, 1300);
      return () => clearTimeout(t);
    }
    if (view === "received") {
      const t = setTimeout(() => onClose(), 2400);
      return () => clearTimeout(t);
    }
  }, [demoAutoPlay, item, demoScenario, view]);

  useEffect(() => {
    if (item) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [item]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !item) return;
      // "received" is a terminal confirmation, same as clicking Done —
      // going "back" to the now-stale detail view would be confusing.
      if (view !== "detail" && view !== "received") setView("detail");
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, view, onClose]);

  if (!mounted) return null;

  const isOpen = !!item;
  const display = item ? getExpectedPaymentDisplayStatus(item.date) : null;

  async function saveEdit() {
    if (!item) return;
    const amount = Number(editAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !editDate) return;
    setSaving(true); setError(null);
    try {
      const res = await fetchWithTimeout(`/api/expected-payments/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount, clientName: editClient.trim() || null, projectName: editProject.trim() || null, expectedDate: editDate,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      router.refresh();
      onClose();
    } catch (err) {
      setError(`${t("errors.generic")} — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function confirmReceived() {
    if (!item) return;
    const amount = Number(receivedAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !receivedDate) return;

    // Landing-page product showcase only — never a real mutation, never a
    // real network call. Simulates exactly what the real flow shows next,
    // using the real reserve figure already computed for this demo item.
    if (demoScenario) {
      setReceivedResult({ amount, reserve: demoScenario.reserve });
      setFacts(demoAfter ?? null);
      setReceivedBreakdown(null);
      setView("received");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("nonodia-demo-state", { detail: { received: true } }));
      }
      return;
    }

    setSaving(true); setError(null);
    try {
      const res = await fetchWithTimeout(`/api/expected-payments/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markReceived: true, actualAmount: amount, receivedDate }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      // Never confirm money received silently (spec section 7) — show what
      // changed instead of just closing the drawer.
      router.refresh();
      setReceivedResult({ amount, reserve: body.reserve ?? null });
      setReceivedBreakdown(body.moneyBreakdown ?? null);
      setView("received");
      try {
        const factsRes = await fetchWithTimeout("/api/today-facts", {});
        if (factsRes.ok) {
          const factsBody = await factsRes.json();
          setFacts({ currentCash: factsBody.facts.currentCash, moneyInThisMonth: factsBody.facts.moneyInThisMonth });
        }
      } catch {
        // confirmation still shows without the facts refresh — non-fatal
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const detail = isAbort ? t("errors.timeout") : err instanceof Error ? err.message : String(err);
      setError(`${t("errors.generic")} — ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-[#0D2137] border-l border-[#1E3A55]
          shadow-2xl flex flex-col transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {item && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-5 border-b border-[#1E3A55]">
              <div className="flex items-center gap-3 min-w-0">
                {view !== "detail" && view !== "received" && (
                  <button onClick={() => setView("detail")} aria-label={t("markReceived.back")}
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-[#4A7A9B] hover:text-[#E8F0F8] hover:bg-[#1E3446] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-[#E8F0F8] truncate">
                    {view === "markReceived" ? t("markReceived.title") : item.label}
                  </h2>
                  {/* item.label already falls back to projectName when there's no
                      client name — only show this subtitle when it adds something
                      the title doesn't already say. */}
                  {view === "detail" && item.projectName && item.projectName !== item.label && (
                    <p className="text-xs text-[#6A97B4] truncate">{item.projectName}</p>
                  )}
                </div>
              </div>
              <button onClick={onClose} aria-label={t("detail.close")}
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-[#4A7A9B] hover:text-[#E8F0F8] hover:bg-[#1E3446] transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* ── Detail ─────────────────────────────────────────────────── */}
              {view === "detail" && display && (
                <div className="space-y-5">
                  <div>
                    <p className="label mb-1">{t("detail.amountLabel")}</p>
                    <p className="text-3xl font-bold text-[#4CC4A4] tabular-nums">+{formatCurrency(item.amount, locale)}</p>
                  </div>
                  <div>
                    <p className="label mb-1">{t("detail.expectedDateLabel")}</p>
                    <p className="text-sm text-[#C8DCF0]">
                      {item.date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
                    </p>
                  </div>
                  <div>
                    <p className="label mb-1">{t("status.label")}</p>
                    <span className={`inline-block text-sm font-semibold px-3 py-1 rounded-full ${
                      display.status === "overdue" ? "text-[#E5484D] bg-[#4A2A2A]" :
                      display.status === "dueToday" ? "text-[#D4A254] bg-[#332C1A]" :
                      "text-[#7BA8C4] bg-[#1E3446]"
                    }`}>
                      {display.status === "overdue" ? t("status.overdue", { days: display.overdueDays }) :
                       display.status === "dueToday" ? t("status.dueToday") : t("status.expected")}
                    </span>
                  </div>

                  {/* Gross/reserve/after-reserve for THIS payment — the same
                      Financial Reserve Engine calculation shown everywhere
                      else, never a second one (spec sections 6, 27). */}
                  {item.kind === "expected_income" && scenario && (
                    <div className="pt-1 border-t border-[#1E3446]">
                      <p className="text-xs text-[#6A97B4] mt-3 mb-2">{t("detail.reserveHeading")}</p>
                      <ReserveBreakdown reserve={scenario.reserve} />
                    </div>
                  )}

                  {/* "If this arrives" — a labeled scenario, never added to
                      actual Current Cash before it's really received (spec
                      sections 6, 23-24, 32). */}
                  {item.kind === "expected_income" && scenario && (
                    <div className="pt-1 border-t border-[#1E3446]">
                      <p className="text-xs text-[#6A97B4] mt-3 mb-2">{t("detail.ifArrivesHeading")}</p>
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#6A97B4]">{t("detail.projectedCash")}</span>
                          <span className="font-semibold text-[#E8F0F8] tabular-nums">{formatCurrency(scenario.scenario.projectedCash, locale)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#6A97B4]">
                            {scenario.current.safeToUse !== null ? t("detail.projectedSafeToUse") : t("detail.projectedAvailable")}
                          </span>
                          <span className="font-semibold text-[#E8F0F8] tabular-nums">{formatCurrency(scenario.scenario.projectedAvailableAfterProtections, locale)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#6A97B4]">{t("detail.projectedRunway")}</span>
                          <span className="font-semibold text-[#E8F0F8] tabular-nums">
                            {scenario.scenario.projectedRunwayMonths === null
                              ? tDashMoney("runwayUnknown")
                              : scenario.scenario.projectedRunwayMonths < 0
                                ? tDashMoney("runwayAlreadyBehind")
                                : tDashMoney("runwayMonths", { months: Math.round(scenario.scenario.projectedRunwayMonths * 10) / 10 })}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#6A97B4] mt-3">{t("detail.scenarioDisclaimer")}</p>
                    </div>
                  )}
                  {item.kind === "expected_income" && scenarioLoading && !scenario && (
                    <p className="text-xs text-[#6A97B4]">{t("detail.scenarioLoading")}</p>
                  )}

                  {error && <p className="text-sm text-[#E5484D]">{error}</p>}

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setView("edit")} className="btn-secondary flex-1 text-sm">{t("detail.edit")}</button>
                    <button onClick={() => setView("markReceived")} className="btn-primary flex-1 text-sm">{t("detail.markAsReceived")}</button>
                  </div>
                </div>
              )}

              {/* ── Edit ───────────────────────────────────────────────────── */}
              {view === "edit" && (
                <div className="space-y-4">
                  <div>
                    <label className="label mb-2 block">{tQuickAdd("amountLabel")}</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6A97B4] text-lg">€</span>
                      <input inputMode="decimal" className="input pl-8 text-xl font-bold" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="label mb-2 block">{tQuickAdd("client")}</label>
                    <input className="input" placeholder={tQuickAdd("clientPlaceholder")} value={editClient} onChange={(e) => setEditClient(e.target.value)} />
                  </div>
                  <div>
                    <label className="label mb-2 block">{tQuickAdd("project")}</label>
                    <input className="input" placeholder={tQuickAdd("projectPlaceholder")} value={editProject} onChange={(e) => setEditProject(e.target.value)} />
                  </div>
                  <div>
                    <label className="label mb-2 block">{tQuickAdd("date")}</label>
                    <input type="date" className="input" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                  </div>
                  {error && <p className="text-sm text-[#E5484D]">{error}</p>}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setView("detail")} className="btn-secondary flex-1 text-sm">{t("detail.cancel")}</button>
                    <button disabled={saving || !editAmount || !editDate} onClick={saveEdit} className="btn-primary flex-1 text-sm">
                      {t("detail.save")}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Mark as received ──────────────────────────────────────── */}
              {view === "markReceived" && (
                <div className="space-y-4">
                  <div>
                    <label className="label mb-2 block">{t("markReceived.amountReceivedLabel")}</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6A97B4] text-lg">€</span>
                      <input autoFocus inputMode="decimal" className="input pl-8 text-2xl font-bold" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="label mb-2 block">{t("markReceived.dateReceivedLabel")}</label>
                    <input type="date" className="input" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
                  </div>
                  {error && <p className="text-sm text-[#E5484D]">{error}</p>}
                  <button disabled={saving || !receivedAmount || !receivedDate} onClick={confirmReceived} className="btn-primary w-full">
                    {t("markReceived.confirmPayment")}
                  </button>
                </div>
              )}

              {/* ── Received confirmation ─────────────────────────────────── —
                  money received must never be confirmed silently (spec
                  section 7's own example: shows Current Cash and Money In
                  right after confirming). Reuses Quick Add's exact reward
                  copy/labels rather than a second set of strings. */}
              {view === "received" && receivedResult && (
                <div className="space-y-5">
                  <div className="surface-teal rounded-2xl p-5">
                    <p className="text-lg font-bold text-[#E8F0F8]">
                      {tQuickAddReward("incomeAdded", { amount: formatCurrency(receivedResult.amount, locale) })}
                    </p>
                  </div>

                  {facts && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#6A97B4]">{tQuickAddReward("currentCash")}</span>
                        <span className="font-semibold text-[#E8F0F8] tabular-nums">{formatCurrency(facts.currentCash, locale)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#6A97B4]">{tQuickAddReward("incomeThisMonth")}</span>
                        <span className="font-semibold text-[#E8F0F8] tabular-nums">{formatCurrency(facts.moneyInThisMonth, locale)}</span>
                      </div>
                    </div>
                  )}

                  {receivedResult.reserve && (
                    <div className="pt-1 border-t border-[#1E3446]">
                      <p className="text-xs text-[#6A97B4] mt-3 mb-2">{tQuickAddReward("forThisPayment")}</p>
                      <ReserveBreakdown reserve={receivedResult.reserve} />
                    </div>
                  )}

                  {receivedBreakdown && (
                    <div className="pt-1 border-t border-[#1E3446]">
                      <p className="text-xs text-[#6A97B4] mt-3 mb-2">{tQuickAddReward("overall")}</p>
                      <MoneyBreakdownSummary breakdown={receivedBreakdown} />
                    </div>
                  )}

                  <button onClick={onClose} className="btn-primary w-full">{tQuickAddReward("done")}</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  );
}
