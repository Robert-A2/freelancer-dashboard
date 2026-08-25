"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { todayInputValue } from "@/lib/date-input";

type RecurringRow = { name: string; amount: string; category: string; dayOfMonth: string; tag: "business" | "personal" };

const RECURRING_CATEGORIES = ["housing", "software", "insurance", "transport", "business services", "equipment", "uncategorized"] as const;

const ACTIVITY_OPTIONS = ["bnc_liberal", "bic_service_commercial", "bic_service_artisan", "bic_sales", "cipav_liberal", "mixed", "unsure"] as const;

const TOTAL_STEPS = 6;

function emptyRow(): RecurringRow {
  return { name: "", amount: "", category: "software", dayOfMonth: "1", tag: "personal" };
}

export default function OnboardingWizard() {
  const t = useTranslations("manual.onboarding");
  const tCat = useTranslations("categories");
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // How the user manages their money (spec: separate the Business/Personal
  // account filter from actually showing distinct numbers) — null = not yet
  // answered, gates step 1's continue button same as currentCash does.
  const [accountsSeparated, setAccountsSeparated] = useState<boolean | null>(null);
  const [currentCash, setCurrentCash] = useState("");
  const [taxReserve, setTaxReserve] = useState("");
  const [recurring, setRecurring] = useState<RecurringRow[]>([]);
  const [businessSpendingEstimate, setBusinessSpendingEstimate] = useState("");
  const [personalSpendingEstimate, setPersonalSpendingEstimate] = useState("");
  const [expectAmount, setExpectAmount] = useState("");
  const [expectClient, setExpectClient] = useState("");
  const [expectProject, setExpectProject] = useState("");
  const [expectDate, setExpectDate] = useState(todayInputValue());

  // Step 6 — Tax & contributions (spec: Nonodia France Tax & Contributions
  // Onboarding). "country" doubles as the entry gate: only France shows the
  // rest of this step today, matching Settings' TaxContributionsSection.
  const [taxCountry, setTaxCountry] = useState("");
  const [businessStatus, setBusinessStatus] = useState("");
  const [activityType, setActivityType] = useState("");
  const [vfl, setVfl] = useState("");
  const [acre, setAcre] = useState("");
  const [activityStartDate, setActivityStartDate] = useState(todayInputValue());
  const [vatCharged, setVatCharged] = useState("");
  const [urssafFrequency, setUrssafFrequency] = useState("");

  const step1Valid = accountsSeparated !== null && currentCash.trim() !== "" && Number.isFinite(Number(currentCash));

  function updateRow(i: number, patch: Partial<RecurringRow>) {
    setRecurring((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountsSeparated,
          currentCash: Number(currentCash),
          taxReserve: taxReserve.trim() === "" ? null : Number(taxReserve),
          recurring: recurring
            .filter((r) => r.name.trim() && Number.isFinite(Number(r.amount)) && Number(r.amount) > 0)
            .map((r) => ({
              name: r.name.trim(),
              amount: Number(r.amount),
              category: r.category,
              frequency: "monthly" as const,
              dayOfMonth: Number(r.dayOfMonth) || 1,
              tag: r.tag,
            })),
          businessSpendingEstimate: businessSpendingEstimate.trim() === "" ? null : Number(businessSpendingEstimate),
          personalSpendingEstimate: personalSpendingEstimate.trim() === "" ? null : Number(personalSpendingEstimate),
          expectedPayment:
            expectAmount.trim() && expectDate
              ? {
                  amount: Number(expectAmount),
                  clientName: expectClient.trim() || null,
                  projectName: expectProject.trim() || null,
                  expectedDate: expectDate,
                }
              : null,
          taxProfile: taxCountry
            ? {
                country: taxCountry,
                businessLegalStatus: businessStatus || null,
                activityType: activityType || null,
                versementLiberatoireStatus: vfl || null,
                acreStatus: acre || null,
                activityStartDate: acre === "yes" ? activityStartDate : null,
                vatStatus: vatCharged || null,
                urssafFrequency: urssafFrequency || null,
              }
            : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed");
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("errors.generic"));
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto py-6">
      {/* Progress */}
      <div className="flex items-center gap-1.5 mb-8">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i + 1 <= step ? "bg-[#3AB5A0]" : "bg-[#25405A]"}`}
          />
        ))}
      </div>

      <div className="card">
        {step === 1 && (
          <div>
            <p className="label mb-2">{t("step1.eyebrow")}</p>
            <h1 className="text-xl font-bold text-[#E8F0F8] mb-2">{t("step1.separationQuestion")}</h1>
            <p className="text-sm text-[#6A97B4] mb-4">{t("step1.separationHint")}</p>
            <div className="space-y-2 mb-6">
              {([true, false] as const).map((opt) => (
                <button
                  key={String(opt)}
                  type="button"
                  onClick={() => setAccountsSeparated(opt)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-colors ${
                    accountsSeparated === opt
                      ? "bg-[#3AB5A012] border-[#3AB5A0] text-[#3AB5A0]"
                      : "bg-[#112232] border-[#25405A] text-[#A8C6E0] hover:border-[#3AB5A055]"
                  }`}
                >
                  {opt ? t("step1.separationSeparate") : t("step1.separationShared")}
                </button>
              ))}
            </div>

            {accountsSeparated !== null && (
              <>
                <h2 className="text-lg font-bold text-[#E8F0F8] mb-2">
                  {accountsSeparated ? t("step1.question") : t("step1.questionShared")}
                </h2>
                <p className="text-sm text-[#6A97B4] mb-6">{t("step1.hint")}</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6A97B4] text-lg">€</span>
                  <input
                    autoFocus
                    inputMode="decimal"
                    className="input pl-8 text-2xl font-bold"
                    placeholder="0"
                    value={currentCash}
                    onChange={(e) => setCurrentCash(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="label mb-2">{t("step2.eyebrow")}</p>
            <h1 className="text-xl font-bold text-[#E8F0F8] mb-2">{t("step2.question")}</h1>
            <p className="text-sm text-[#6A97B4] mb-6">{t("step2.hint")}</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6A97B4] text-lg">€</span>
              <input
                inputMode="decimal"
                className="input pl-8 text-2xl font-bold"
                placeholder="0"
                value={taxReserve}
                onChange={(e) => setTaxReserve(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="label mb-2">{t("step3.eyebrow")}</p>
            <h1 className="text-xl font-bold text-[#E8F0F8] mb-2">{t("step3.question")}</h1>
            <p className="text-sm text-[#6A97B4] mb-6">{t("step3.hint")}</p>

            <div className="space-y-4">
              {recurring.map((row, i) => (
                <div key={i} className="bg-[#112232] border border-[#25405A] rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      className="input"
                      placeholder={t("step3.namePlaceholder")}
                      value={row.name}
                      onChange={(e) => updateRow(i, { name: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setRecurring((rows) => rows.filter((_, idx) => idx !== i))}
                      className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg text-[#6A97B4] hover:text-[#E5484D] hover:bg-[#1E3446] transition-colors"
                      aria-label={t("step3.remove")}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6A97B4] text-sm">€</span>
                      <input
                        inputMode="decimal"
                        className="input pl-6 text-sm"
                        placeholder="0"
                        value={row.amount}
                        onChange={(e) => updateRow(i, { amount: e.target.value })}
                      />
                    </div>
                    <select
                      className="input text-sm"
                      value={row.category}
                      onChange={(e) => updateRow(i, { category: e.target.value })}
                    >
                      {RECURRING_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{tCat(c)}</option>
                      ))}
                    </select>
                    <select
                      className="input text-sm"
                      value={row.dayOfMonth}
                      onChange={(e) => updateRow(i, { dayOfMonth: e.target.value })}
                    >
                      {Array.from({ length: 28 }, (_, d) => d + 1).map((d) => (
                        <option key={d} value={d}>{t("step3.dayOfMonth", { day: d })}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    {(["business", "personal"] as const).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => updateRow(i, { tag })}
                        className={`flex-1 text-xs font-medium px-2.5 py-2 rounded-lg border transition-colors ${
                          row.tag === tag
                            ? "bg-[#3AB5A012] border-[#3AB5A0] text-[#3AB5A0]"
                            : "bg-[#0D1B2B] border-[#25405A] text-[#7BA8C4] hover:text-[#A8C6E0]"
                        }`}
                      >
                        {t(`step3.tag.${tag}`)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRecurring((rows) => [...rows, emptyRow()])}
                className="w-full text-sm font-medium text-[#3AB5A0] hover:text-[#4CC4A4] border border-dashed border-[#25405A] hover:border-[#3AB5A0] rounded-xl py-3 transition-colors"
              >
                + {t("step3.addAnother")}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="label mb-2">{t("step4.eyebrow")}</p>

            <h1 className="text-lg font-bold text-[#E8F0F8] mb-1">{t("step4.businessQuestion")}</h1>
            <p className="text-xs text-[#6A97B4] mb-2">{t("step4.businessLabel")}</p>
            <div className="relative mb-6">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6A97B4] text-lg">€</span>
              <input
                autoFocus
                inputMode="decimal"
                className="input pl-8 text-xl font-bold"
                placeholder="0"
                value={businessSpendingEstimate}
                onChange={(e) => setBusinessSpendingEstimate(e.target.value)}
              />
            </div>

            <h1 className="text-lg font-bold text-[#E8F0F8] mb-1">{t("step4.personalQuestion")}</h1>
            <p className="text-xs text-[#6A97B4] mb-2">{t("step4.personalLabel")}</p>
            <div className="relative mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6A97B4] text-lg">€</span>
              <input
                inputMode="decimal"
                className="input pl-8 text-xl font-bold"
                placeholder="0"
                value={personalSpendingEstimate}
                onChange={(e) => setPersonalSpendingEstimate(e.target.value)}
              />
            </div>

            <p className="text-sm text-[#6A97B4]">{t("step4.explanation")}</p>
          </div>
        )}

        {step === 5 && (
          <div>
            <p className="label mb-2">{t("step5.eyebrow")}</p>
            <h1 className="text-xl font-bold text-[#E8F0F8] mb-2">{t("step5.question")}</h1>
            <p className="text-sm text-[#6A97B4] mb-6">{t("step5.hint")}</p>
            <div className="space-y-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6A97B4] text-lg">€</span>
                <input
                  inputMode="decimal"
                  className="input pl-8"
                  placeholder={t("step5.amountPlaceholder")}
                  value={expectAmount}
                  onChange={(e) => setExpectAmount(e.target.value)}
                />
              </div>
              <input
                className="input"
                placeholder={t("step5.clientPlaceholder")}
                value={expectClient}
                onChange={(e) => setExpectClient(e.target.value)}
              />
              <input
                className="input"
                placeholder={t("step5.projectPlaceholder")}
                value={expectProject}
                onChange={(e) => setExpectProject(e.target.value)}
              />
              <input
                type="date"
                className="input"
                value={expectDate}
                onChange={(e) => setExpectDate(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <p className="label mb-2">{t("step6.eyebrow")}</p>
            <h1 className="text-xl font-bold text-[#E8F0F8] mb-2">{t("step6.question")}</h1>
            <p className="text-sm text-[#6A97B4] mb-6">{t("step6.hint")}</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#6A97B4] mb-2 block">{t("step6.country")}</label>
                <select className="input" value={taxCountry} onChange={(e) => setTaxCountry(e.target.value)}>
                  <option value="">{t("step6.countryUnselected")}</option>
                  <option value="FR">{t("step6.countryFrance")}</option>
                  <option value="other">{t("step6.countryOther")}</option>
                </select>
              </div>

              {taxCountry === "FR" && (
                <>
                  <div>
                    <label className="text-xs text-[#6A97B4] mb-2 block">{t("step6.businessStatus")}</label>
                    <select className="input" value={businessStatus} onChange={(e) => setBusinessStatus(e.target.value)}>
                      <option value="">{t("step6.threeWayUnselected")}</option>
                      <option value="micro_entrepreneur">{t("step6.businessStatusMicro")}</option>
                      <option value="other">{t("step6.businessStatusOther")}</option>
                      <option value="unsure">{t("step6.threeWayUnsure")}</option>
                    </select>
                  </div>

                  {businessStatus === "micro_entrepreneur" && (
                    <>
                      <div>
                        <label className="text-xs text-[#6A97B4] mb-2 block">{t("step6.activityType")}</label>
                        <select className="input" value={activityType} onChange={(e) => setActivityType(e.target.value)}>
                          <option value="">{t("step6.activityTypeUnselected")}</option>
                          {ACTIVITY_OPTIONS.map((a) => (
                            <option key={a} value={a}>{t(`step6.activityTypeOptions.${a}`)}</option>
                          ))}
                        </select>
                        {activityType === "cipav_liberal" && (
                          <p className="text-xs text-[#4A7A9B] mt-1.5 leading-relaxed">{t("step6.cipavHint")}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs text-[#6A97B4] mb-2 block">{t("step6.versementLiberatoire")}</label>
                        <p className="text-xs text-[#4A7A9B] mb-1.5 leading-relaxed">{t("step6.versementLiberatoireHint")}</p>
                        <select className="input" value={vfl} onChange={(e) => setVfl(e.target.value)}>
                          <option value="">{t("step6.threeWayUnselected")}</option>
                          <option value="yes">{t("step6.threeWayYes")}</option>
                          <option value="no">{t("step6.threeWayNo")}</option>
                          <option value="unknown">{t("step6.threeWayUnsure")}</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-[#6A97B4] mb-2 block">{t("step6.acre")}</label>
                        <p className="text-xs text-[#4A7A9B] mb-1.5 leading-relaxed">{t("step6.acreHint")}</p>
                        <select className="input" value={acre} onChange={(e) => setAcre(e.target.value)}>
                          <option value="">{t("step6.threeWayUnselected")}</option>
                          <option value="yes">{t("step6.threeWayYes")}</option>
                          <option value="no">{t("step6.threeWayNo")}</option>
                          <option value="unknown">{t("step6.threeWayUnsure")}</option>
                        </select>
                      </div>

                      {acre === "yes" && (
                        <div>
                          <label className="text-xs text-[#6A97B4] mb-2 block">{t("step6.activityStartDate")}</label>
                          <input type="date" className="input" value={activityStartDate} onChange={(e) => setActivityStartDate(e.target.value)} />
                        </div>
                      )}

                      <div>
                        <label className="text-xs text-[#6A97B4] mb-2 block">{t("step6.urssafFrequency")}</label>
                        <p className="text-xs text-[#4A7A9B] mb-1.5 leading-relaxed">{t("step6.urssafFrequencyHint")}</p>
                        <select className="input" value={urssafFrequency} onChange={(e) => setUrssafFrequency(e.target.value)}>
                          <option value="">{t("step6.threeWayUnselected")}</option>
                          <option value="monthly">{t("step6.urssafMonthly")}</option>
                          <option value="quarterly">{t("step6.urssafQuarterly")}</option>
                          <option value="unknown">{t("step6.threeWayUnsure")}</option>
                        </select>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-xs text-[#6A97B4] mb-2 block">{t("step6.vatQuestion")}</label>
                    <select className="input" value={vatCharged} onChange={(e) => setVatCharged(e.target.value)}>
                      <option value="">{t("step6.threeWayUnselected")}</option>
                      <option value="registered">{t("step6.threeWayYes")}</option>
                      <option value="exempt">{t("step6.threeWayNo")}</option>
                      <option value="unknown">{t("step6.threeWayUnsure")}</option>
                    </select>
                    <p className="text-xs text-[#4A7A9B] mt-1.5">{t("step6.vatRateHint")}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-[#E5484D] mt-4">{error}</p>}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#25405A]">
          <button
            type="button"
            onClick={() => (step === 1 ? router.push("/dashboard") : setStep((s) => s - 1))}
            className="btn-ghost text-sm"
          >
            {step === 1 ? t("skipAll") : t("back")}
          </button>

          <div className="flex items-center gap-3">
            {step > 1 && step < TOTAL_STEPS && (
              <button type="button" onClick={() => setStep((s) => s + 1)} className="btn-ghost text-sm">
                {t("skip")}
              </button>
            )}
            {step < TOTAL_STEPS ? (
              <button
                type="button"
                disabled={step === 1 && !step1Valid}
                onClick={() => setStep((s) => s + 1)}
                className="btn-primary"
              >
                {t("continue")}
              </button>
            ) : (
              <button type="button" disabled={submitting} onClick={finish} className="btn-primary">
                {submitting ? t("saving") : t("finish")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
