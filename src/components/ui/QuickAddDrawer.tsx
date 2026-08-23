"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { ReserveForPayment } from "@/lib/reserve-engine";
import type { MoneyBreakdown } from "@/lib/money-breakdown";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { todayInputValue } from "@/lib/date-input";
import ReserveBreakdown from "./ReserveBreakdown";
import MoneyBreakdownSummary from "./MoneyBreakdownSummary";

type View = "menu" | "expense" | "income" | "expectedPayment" | "recurringExpense" | "payMyself";
type Tag = "business" | "personal";

const EXPENSE_CATEGORIES = ["food", "transport", "software", "business services", "housing", "insurance", "equipment", "taxes", "uncategorized"] as const;

// Only ever shown when the user's tax profile activityType is "mixed" — a
// single blended percentage would be dishonest for a mixed-activity
// freelancer, so each payment identifies its own activity instead (Tax &
// Contributions spec section 5). Reuses the exact same option labels
// Settings' TaxContributionsSection already defines — no second copy.
const ACTIVITY_OPTIONS = ["bnc_liberal", "bic_service_commercial", "bic_service_artisan", "bic_sales", "cipav_liberal"] as const;

interface RewardData {
  kind: "expense" | "income" | "expectedPayment" | "recurringExpense" | "payMyself";
  amount?: number;
  category?: string;
  reserve?: ReserveForPayment | null;
}

// The persistent "+ Add" action (spec section 5) — one drawer, four small
// forms, all writing into the same unified transaction/expected-payment/
// recurring-expense system the rest of the app already reads. Reuses
// MonthDrawer's portal/backdrop/ESC pattern rather than inventing a new one.
export default function QuickAddDrawer({ open, onClose, isMixedActivity: isMixedActivityProp, accountsSeparated: accountsSeparatedProp }: { open: boolean; onClose: () => void; isMixedActivity: boolean; accountsSeparated: boolean }) {
  const t = useTranslations("manual.quickAdd");
  const tCat = useTranslations("categories");
  const tActivity = useTranslations("settings.financialProfile.activityTypeOptions");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  // Seeded from the (dashboard) layout's props for an instant first paint,
  // then refreshed from a real fetch every time the drawer opens — the
  // layout that supplies those props is shared across every page in the
  // app and doesn't necessarily re-render on every client-side navigation
  // between sibling pages, so the prop alone can go stale (spec: "Pay
  // yourself only shows once, then I can't find it").
  const [isMixedActivity, setIsMixedActivity] = useState(isMixedActivityProp);
  const [accountsSeparated, setAccountsSeparated] = useState(accountsSeparatedProp);
  const [view, setView] = useState<View>("menu");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reward, setReward] = useState<RewardData | null>(null);
  const [facts, setFacts] = useState<{ currentCash: number; moneyInThisMonth: number; moneyOutThisMonth: number; reserved: number | null; spendingByCategoryThisMonth: { category: string; amount: number }[] } | null>(null);
  const [moneyBreakdown, setMoneyBreakdown] = useState<MoneyBreakdown | null>(null);

  // Expense form state
  const [expAmount, setExpAmount] = useState("");
  const [expWhat, setExpWhat] = useState("");
  const [expCategory, setExpCategory] = useState<string>("uncategorized");
  const [expDate, setExpDate] = useState(todayInputValue());
  const [expTag, setExpTag] = useState<Tag>("personal");

  // Income form state
  const [incAmount, setIncAmount] = useState("");
  const [incSource, setIncSource] = useState("");
  const [incDate, setIncDate] = useState(todayInputValue());
  const [incTag, setIncTag] = useState<Tag>("business");
  const [incActivity, setIncActivity] = useState("");

  // Expected payment form state
  const [epAmount, setEpAmount] = useState("");
  const [epClient, setEpClient] = useState("");
  const [epProject, setEpProject] = useState("");
  const [epDate, setEpDate] = useState(todayInputValue());
  const [epActivity, setEpActivity] = useState("");

  // Recurring expense form state
  const [reName, setReName] = useState("");
  const [reAmount, setReAmount] = useState("");
  const [reCategory, setReCategory] = useState<string>("software");
  const [reDay, setReDay] = useState("1");
  const [reTag, setReTag] = useState<Tag>("personal");

  // Pay yourself form state — a transfer from Business to Personal, not a
  // new business expense or new personal income (see /api/owner-pay).
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayInputValue());

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    fetchWithTimeout("/api/today-facts", {})
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (typeof data.isMixedActivity === "boolean") setIsMixedActivity(data.isMixedActivity);
        if (typeof data.accountsSeparated === "boolean") setAccountsSeparated(data.accountsSeparated);
      })
      .catch(() => { /* menu still works off the last-known prop/state — non-fatal */ });
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view]);

  function reset() {
    setView("menu");
    setError(null);
    setReward(null);
    setFacts(null);
    setMoneyBreakdown(null);
    setExpAmount(""); setExpWhat(""); setExpCategory("uncategorized"); setExpDate(todayInputValue()); setExpTag("personal");
    setIncAmount(""); setIncSource(""); setIncDate(todayInputValue()); setIncTag("business"); setIncActivity("");
    setEpAmount(""); setEpClient(""); setEpProject(""); setEpDate(todayInputValue()); setEpActivity("");
    setReName(""); setReAmount(""); setReCategory("software"); setReDay("1"); setReTag("personal");
    setPayAmount(""); setPayDate(todayInputValue());
  }

  function handleClose() {
    onClose();
    setTimeout(reset, 250); // let the close transition finish before wiping state
  }

  async function afterSave(kind: RewardData["kind"], amount?: number, category?: string, reserve?: ReserveForPayment | null) {
    router.refresh();
    setReward({ kind, amount, category, reserve });
    try {
      const res = await fetchWithTimeout("/api/today-facts", {});
      if (res.ok) {
        const data = await res.json();
        setFacts(data.facts);
        setMoneyBreakdown(data.moneyBreakdown);
        if (typeof data.isMixedActivity === "boolean") setIsMixedActivity(data.isMixedActivity);
        if (typeof data.accountsSeparated === "boolean") setAccountsSeparated(data.accountsSeparated);
      }
    } catch {
      // reward still shows without the facts refresh — non-fatal
    }
  }

  // Shared by all four forms so every one of them fails the exact same
  // way (visible, specific error; never a silent hang) — a single code
  // path instead of four hand-copies that could quietly drift apart.
  async function submitAndHandle(kind: RewardData["kind"], url: string, body: unknown, rewardAmount?: number, rewardCategory?: string) {
    setSaving(true); setError(null);
    try {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const resBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resBody.error ?? `HTTP ${res.status}`);
      }
      // Only /api/transactions/manual (income) and the expected-payments
      // mark-received route ever return this — undefined everywhere else,
      // and afterSave/ReserveBreakdown both already treat that as "nothing
      // to reserve here" rather than a missing-data error.
      await afterSave(kind, rewardAmount, rewardCategory, resBody.reserve);
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const detail = isAbort ? t("errors.timeout") : err instanceof Error ? err.message : String(err);
      setError(`${t("errors.generic")} — ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  async function submitExpense() {
    const amount = Number(expAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !expWhat.trim()) return;
    await submitAndHandle(
      "expense",
      "/api/transactions/manual",
      { transactions: [{ amount, merchantName: expWhat.trim(), category: expCategory, transactionType: "expense", tag: expTag, date: expDate }] },
      amount, expCategory,
    );
  }

  async function submitIncome() {
    const amount = Number(incAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !incSource.trim()) return;
    await submitAndHandle(
      "income",
      "/api/transactions/manual",
      { transactions: [{ amount, merchantName: incSource.trim(), category: "client payment", transactionType: "income", tag: incTag, date: incDate, activityType: isMixedActivity ? (incActivity || null) : undefined }] },
      amount,
    );
  }

  async function submitExpectedPayment() {
    const amount = Number(epAmount);
    // Only amount + expected date are required — client/project are both
    // optional per spec.
    if (!Number.isFinite(amount) || amount <= 0 || !epDate) return;
    await submitAndHandle(
      "expectedPayment",
      "/api/expected-payments",
      { amount, clientName: epClient.trim() || null, projectName: epProject.trim() || null, expectedDate: epDate, activityType: isMixedActivity ? (epActivity || null) : undefined },
    );
  }

  async function submitRecurringExpense() {
    const amount = Number(reAmount);
    const day = Number(reDay);
    if (!Number.isFinite(amount) || amount <= 0 || !reName.trim()) return;
    await submitAndHandle(
      "recurringExpense",
      "/api/recurring-expenses",
      { amount, merchantName: reName.trim(), category: reCategory, tag: reTag, dayOfMonth: day },
    );
  }

  async function submitPayMyself() {
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    await submitAndHandle("payMyself", "/api/owner-pay", { amount, date: payDate }, amount);
  }

  if (!mounted) return null;

  const TagToggle = ({ value, onChange }: { value: Tag; onChange: (t: Tag) => void }) => (
    <div className="flex gap-2">
      {(["personal", "business"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 text-sm font-medium px-3 py-2.5 rounded-xl border transition-colors ${
            value === opt
              ? "bg-[#3AB5A012] border-[#3AB5A0] text-[#3AB5A0]"
              : "bg-[#112232] border-[#25405A] text-[#7BA8C4] hover:text-[#A8C6E0]"
          }`}
        >
          {t(`tag.${opt}`)}
        </button>
      ))}
    </div>
  );

  return createPortal(
    <>
      <div
        onClick={handleClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-[#0D2137] border-l border-[#1E3A55]
          shadow-2xl flex flex-col transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-5 border-b border-[#1E3A55]">
          <div className="flex items-center gap-3">
            {view !== "menu" && !reward && (
              <button onClick={() => setView("menu")} aria-label={t("back")}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#4A7A9B] hover:text-[#E8F0F8] hover:bg-[#1E3446] transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <h2 className="text-lg font-bold text-[#E8F0F8]">
              {view === "menu" ? t("menu.title") : t(`forms.${view}.title`)}
            </h2>
          </div>
          <button onClick={handleClose} aria-label={t("close")}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#4A7A9B] hover:text-[#E8F0F8] hover:bg-[#1E3446] transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ── Reward ─────────────────────────────────────────────────────── */}
          {reward && (
            <div className="space-y-5">
              <div className="surface-teal rounded-2xl p-5">
                <p className="text-lg font-bold text-[#E8F0F8]">
                  {reward.kind === "expense" && t("reward.expenseAdded", { amount: formatCurrency(reward.amount ?? 0, locale) })}
                  {reward.kind === "income" && t("reward.incomeAdded", { amount: formatCurrency(reward.amount ?? 0, locale) })}
                  {reward.kind === "expectedPayment" && t("reward.expectedSaved")}
                  {reward.kind === "recurringExpense" && t("reward.recurringSaved")}
                  {reward.kind === "payMyself" && t("reward.payMyselfSaved", { amount: formatCurrency(reward.amount ?? 0, locale) })}
                </p>
              </div>

              {reward.kind === "payMyself" && (
                <p className="text-sm text-[#A8C6E0]">{t("reward.payMyselfNote")}</p>
              )}

              {facts && reward.kind !== "payMyself" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6A97B4]">{t("reward.currentCash")}</span>
                    <span className="font-semibold text-[#E8F0F8] tabular-nums">{formatCurrency(facts.currentCash, locale)}</span>
                  </div>
                  {reward.kind === "expense" && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#6A97B4]">{t("reward.spentThisMonth")}</span>
                        <span className="font-semibold text-[#E8F0F8] tabular-nums">{formatCurrency(facts.moneyOutThisMonth, locale)}</span>
                      </div>
                      {reward.category && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#6A97B4]">
                            {t("reward.categoryThisMonth", { category: tCat.has(reward.category) ? tCat(reward.category) : reward.category })}
                          </span>
                          <span className="font-semibold text-[#E8F0F8] tabular-nums">
                            {formatCurrency(facts.spendingByCategoryThisMonth.find((c) => c.category === reward.category)?.amount ?? 0, locale)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  {reward.kind === "income" && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#6A97B4]">{t("reward.incomeThisMonth")}</span>
                      <span className="font-semibold text-[#E8F0F8] tabular-nums">{formatCurrency(facts.moneyInThisMonth, locale)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Reserve breakdown is returned directly in the save response
                  (see /api/transactions/manual) — available immediately,
                  doesn't wait on the facts refetch above. */}
              {reward.kind === "income" && reward.reserve && (
                <div className="pt-1 border-t border-[#1E3446]">
                  <p className="text-xs text-[#6A97B4] mt-3 mb-2">{t("reward.forThisPayment")}</p>
                  <ReserveBreakdown reserve={reward.reserve} />
                </div>
              )}

              {/* Where you stand overall, after this payment — one shared
                  engine, same numbers the Dashboard's "Your money" card
                  shows (spec: never just "Saved"). */}
              {reward.kind === "income" && moneyBreakdown && (
                <div className="pt-1 border-t border-[#1E3446]">
                  <p className="text-xs text-[#6A97B4] mt-3 mb-2">{t("reward.overall")}</p>
                  <MoneyBreakdownSummary breakdown={moneyBreakdown} />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={reset} className="btn-secondary flex-1 text-sm">{t("reward.addAnother")}</button>
                <button onClick={handleClose} className="btn-primary flex-1 text-sm">{t("reward.done")}</button>
              </div>
            </div>
          )}

          {/* ── Menu ───────────────────────────────────────────────────────── */}
          {!reward && view === "menu" && (
            <div className="space-y-2">
              {([
                { key: "income", icon: "↓", color: "text-[#4CC4A4]" },
                { key: "expense", icon: "↑", color: "text-[#D4A254]" },
                { key: "expectedPayment", icon: "◷", color: "text-[#7BB8E8]" },
                { key: "recurringExpense", icon: "↻", color: "text-[#A78BFA]" },
                ...(accountsSeparated ? [{ key: "payMyself", icon: "⇄", color: "text-[#4CC4A4]" }] as const : []),
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setView(opt.key)}
                  className="w-full flex items-center gap-4 text-left px-4 py-4 rounded-xl border border-[#25405A] bg-[#112232] hover:border-[#3AB5A0] transition-colors"
                >
                  <span className={`text-xl font-bold ${opt.color}`}>{opt.icon}</span>
                  <span className="text-sm font-semibold text-[#E8F0F8]">{t(`menu.${opt.key}`)}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── Expense form ───────────────────────────────────────────────── */}
          {!reward && view === "expense" && (
            <div className="space-y-4">
              <div>
                <label className="label mb-2 block">{t("forms.expense.amountLabel")}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6A97B4] text-lg">€</span>
                  <input autoFocus inputMode="decimal" className="input pl-8 text-2xl font-bold" placeholder="0"
                    value={expAmount} onChange={(e) => setExpAmount(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label mb-2 block">{t("forms.expense.whatWasIt")}</label>
                <input className="input" placeholder={t("forms.expense.whatWasItPlaceholder")}
                  value={expWhat} onChange={(e) => setExpWhat(e.target.value)} />
              </div>
              <div>
                <label className="label mb-2 block">{t("forms.expense.category")}</label>
                <select className="input" value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{tCat(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="label mb-2 block">{t("forms.expense.date")}</label>
                <input type="date" className="input" value={expDate} onChange={(e) => setExpDate(e.target.value)} />
              </div>
              <TagToggle value={expTag} onChange={setExpTag} />
              {error && <p className="text-sm text-[#E5484D]">{error}</p>}
              <button disabled={saving || !expAmount || !expWhat.trim()} onClick={submitExpense} className="btn-primary w-full">
                {t("forms.expense.save")}
              </button>
            </div>
          )}

          {/* ── Income form ────────────────────────────────────────────────── */}
          {!reward && view === "income" && (
            <div className="space-y-4">
              <div>
                <label className="label mb-2 block">{t("forms.income.amountLabel")}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6A97B4] text-lg">€</span>
                  <input autoFocus inputMode="decimal" className="input pl-8 text-2xl font-bold" placeholder="0"
                    value={incAmount} onChange={(e) => setIncAmount(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label mb-2 block">{t("forms.income.source")}</label>
                <input className="input" placeholder={t("forms.income.sourcePlaceholder")}
                  value={incSource} onChange={(e) => setIncSource(e.target.value)} />
              </div>
              <div>
                <label className="label mb-2 block">{t("forms.income.date")}</label>
                <input type="date" className="input" value={incDate} onChange={(e) => setIncDate(e.target.value)} />
              </div>
              {isMixedActivity && (
                <div>
                  <label className="label mb-2 block">{t("forms.activityLabel")}</label>
                  <select className="input" value={incActivity} onChange={(e) => setIncActivity(e.target.value)}>
                    <option value="">{t("forms.activityUnselected")}</option>
                    {ACTIVITY_OPTIONS.map((a) => <option key={a} value={a}>{tActivity(a)}</option>)}
                  </select>
                </div>
              )}
              <TagToggle value={incTag} onChange={setIncTag} />
              {error && <p className="text-sm text-[#E5484D]">{error}</p>}
              <button disabled={saving || !incAmount || !incSource.trim()} onClick={submitIncome} className="btn-primary w-full">
                {t("forms.income.save")}
              </button>
            </div>
          )}

          {/* ── Expected payment form ──────────────────────────────────────── */}
          {!reward && view === "expectedPayment" && (
            <div className="space-y-4">
              <div>
                <label className="label mb-2 block">{t("forms.expectedPayment.amountLabel")}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6A97B4] text-lg">€</span>
                  <input autoFocus inputMode="decimal" className="input pl-8 text-2xl font-bold" placeholder="0"
                    value={epAmount} onChange={(e) => setEpAmount(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label mb-2 block">{t("forms.expectedPayment.client")}</label>
                <input className="input" placeholder={t("forms.expectedPayment.clientPlaceholder")}
                  value={epClient} onChange={(e) => setEpClient(e.target.value)} />
              </div>
              <div>
                <label className="label mb-2 block">{t("forms.expectedPayment.project")}</label>
                <input className="input" placeholder={t("forms.expectedPayment.projectPlaceholder")}
                  value={epProject} onChange={(e) => setEpProject(e.target.value)} />
              </div>
              <div>
                <label className="label mb-2 block">{t("forms.expectedPayment.date")}</label>
                <input type="date" className="input" value={epDate} onChange={(e) => setEpDate(e.target.value)} />
              </div>
              {isMixedActivity && (
                <div>
                  <label className="label mb-2 block">{t("forms.activityLabel")}</label>
                  <select className="input" value={epActivity} onChange={(e) => setEpActivity(e.target.value)}>
                    <option value="">{t("forms.activityUnselected")}</option>
                    {ACTIVITY_OPTIONS.map((a) => <option key={a} value={a}>{tActivity(a)}</option>)}
                  </select>
                </div>
              )}
              {error && <p className="text-sm text-[#E5484D]">{error}</p>}
              <button disabled={saving || !epAmount || !epDate} onClick={submitExpectedPayment} className="btn-primary w-full">
                {t("forms.expectedPayment.save")}
              </button>
            </div>
          )}

          {/* ── Recurring expense form ─────────────────────────────────────── */}
          {!reward && view === "recurringExpense" && (
            <div className="space-y-4">
              <div>
                <label className="label mb-2 block">{t("forms.recurringExpense.name")}</label>
                <input autoFocus className="input" placeholder={t("forms.recurringExpense.namePlaceholder")}
                  value={reName} onChange={(e) => setReName(e.target.value)} />
              </div>
              <div>
                <label className="label mb-2 block">{t("forms.recurringExpense.amountLabel")}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6A97B4] text-lg">€</span>
                  <input inputMode="decimal" className="input pl-8 text-2xl font-bold" placeholder="0"
                    value={reAmount} onChange={(e) => setReAmount(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label mb-2 block">{t("forms.recurringExpense.category")}</label>
                <select className="input" value={reCategory} onChange={(e) => setReCategory(e.target.value)}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{tCat(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="label mb-2 block">{t("forms.recurringExpense.dayOfMonth")}</label>
                <select className="input" value={reDay} onChange={(e) => setReDay(e.target.value)}>
                  {Array.from({ length: 28 }, (_, d) => d + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <TagToggle value={reTag} onChange={setReTag} />
              {error && <p className="text-sm text-[#E5484D]">{error}</p>}
              <button disabled={saving || !reAmount || !reName.trim()} onClick={submitRecurringExpense} className="btn-primary w-full">
                {t("forms.recurringExpense.save")}
              </button>
            </div>
          )}

          {/* ── Pay yourself ───────────────────────────────────────────────── */}
          {!reward && view === "payMyself" && (
            <div className="space-y-4">
              <p className="text-sm text-[#6A97B4]">{t("forms.payMyself.hint")}</p>
              <div>
                <label className="label mb-2 block">{t("forms.payMyself.amountLabel")}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6A97B4] text-lg">€</span>
                  <input autoFocus inputMode="decimal" className="input pl-8 text-2xl font-bold" placeholder="0"
                    value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label mb-2 block">{t("forms.payMyself.date")}</label>
                <input type="date" className="input" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              {error && <p className="text-sm text-[#E5484D]">{error}</p>}
              <button disabled={saving || !payAmount} onClick={submitPayMyself} className="btn-primary w-full">
                {t("forms.payMyself.save")}
              </button>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
