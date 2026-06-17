
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export interface WalkthroughStep {
  label: string;
  title: string;
  body: string;
}

interface WalkthroughTransaction {
  desc: string;
  amount: string;
  category: string;
}

export interface WalkthroughSample {
  transactions: WalkthroughTransaction[];
  income: string;
  expenses: string;
  cashflow: string;
  incomeValue: string;
  expensesValue: string;
  cashflowValue: string;
  insightTitle: string;
  insightBody: string;
  forecastLabel: string;
  forecastValue: string;
  recommendationTitle: string;
  recommendationBody: string;
}

interface Props {
  steps: WalkthroughStep[];
  sample: WalkthroughSample;
}

const STEP_DURATION = 3400;

export default function ProductWalkthrough({ steps, sample }: Props) {
  const tc = useTranslations("common");
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % steps.length), STEP_DURATION);
    return () => clearInterval(id);
  }, [steps.length]);

  const current = steps[step];

  return (
    <div className="rounded-2xl border border-[#1E3550] bg-[#132537] overflow-hidden shadow-2xl shadow-black/50">
      {/* Mini top bar */}
      <div className="h-9 bg-[#0D1B2B] border-b border-[#1E3550] flex items-center px-3 gap-3">
        <span className="text-[10px] font-bold text-[#E8F0F8]">{tc("appName")}</span>
        <div className="flex gap-1.5">
          {[tc("nav.dashboard"), tc("nav.history"), tc("nav.forecast")].map((l) => (
            <span key={l} className="text-[9px] text-[#7BA8C4] px-2 py-0.5 rounded bg-[#1E3550]">{l}</span>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="p-4">
        <div key={step} className="animate-fadeIn">
          {step === 0 && <UploadStep />}
          {step === 1 && <TransactionRows transactions={sample.transactions} showCategory={false} />}
          {step === 2 && <TransactionRows transactions={sample.transactions} showCategory={true} />}
          {step === 3 && <InsightsStep sample={sample} />}
          {step === 4 && <ForecastStep sample={sample} />}
          {step === 5 && <RecommendStep sample={sample} />}
        </div>
      </div>

      {/* Caption + step indicator */}
      <div className="border-t border-[#1E3550] px-4 py-3">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-[10px] font-bold text-[#3AB5A0] uppercase tracking-wide">{current.label}</span>
          <span className="text-xs font-semibold text-[#E8F0F8]">{current.title}</span>
        </div>
        <p className="text-xs text-[#7BA8C4] leading-relaxed mb-3 min-h-[2.5em]">{current.body}</p>
        <div className="flex items-center gap-1.5">
          {steps.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setStep(i)}
              aria-label={s.label}
              aria-current={i === step}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-[#3AB5A0]" : "w-1.5 bg-[#1E3550]"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function UploadStep() {
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="h-[212px] flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-[#3AB5A040] flex items-center justify-center text-3xl">
        📄
      </div>
      <div className="text-xs text-[#A8C6E0] font-mono">statement.csv</div>
      <div className="w-40 h-1.5 bg-[#0D1B2B] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#3AB5A0] transition-all duration-[2800ms] ease-linear"
          style={{ width: filled ? "100%" : "0%" }}
        />
      </div>
    </div>
  );
}

function TransactionRows({ transactions, showCategory }: { transactions: WalkthroughTransaction[]; showCategory: boolean }) {
  return (
    <div className="h-[212px] flex flex-col justify-center gap-2">
      {transactions.map((tx, i) => (
        <div
          key={tx.desc}
          className="flex items-center justify-between gap-2 bg-[#0D1B2B] rounded-xl px-3 py-2.5 animate-fadeIn"
          style={{ animationDelay: `${i * 150}ms`, animationFillMode: "backwards" }}
        >
          <div className="min-w-0 flex-1">
            <div className="text-xs text-[#E8F0F8] truncate">{tx.desc}</div>
            {showCategory && (
              <span
                className="inline-block mt-1 text-[9px] font-medium text-[#3AB5A0] bg-[#3AB5A015] rounded px-1.5 py-0.5 animate-fadeIn"
                style={{ animationDelay: `${i * 150 + 200}ms`, animationFillMode: "backwards" }}
              >
                {tx.category}
              </span>
            )}
          </div>
          <div className={`text-xs font-semibold tabular-nums shrink-0 ${tx.amount.startsWith("+") ? "text-[#4CC4A4]" : "text-[#E8F0F8]"}`}>
            {tx.amount}
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightsStep({ sample }: { sample: WalkthroughSample }) {
  return (
    <div className="h-[212px] flex flex-col justify-center gap-3">
      <div className="grid grid-cols-3 gap-2">
        <SummaryTile label={sample.income} value={sample.incomeValue} color="#4CC4A4" />
        <SummaryTile label={sample.expenses} value={sample.expensesValue} color="#D4A254" />
        <SummaryTile label={sample.cashflow} value={sample.cashflowValue} color="#3AB5A0" />
      </div>
      <div className="bg-[#D4A2540A] border border-[#D4A25425] rounded-xl p-3">
        <p className="text-xs font-semibold text-[#D4A254] mb-1">{sample.insightTitle}</p>
        <p className="text-[11px] text-[#7BA8C4] leading-relaxed">{sample.insightBody}</p>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#0D1B2B] rounded-xl p-2.5">
      <div className="text-[8px] text-[#7BA8C4] uppercase tracking-wide mb-1">{label}</div>
      <div className="text-xs font-bold tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

function ForecastStep({ sample }: { sample: WalkthroughSample }) {
  return (
    <div className="h-[212px] flex flex-col justify-center gap-3">
      <div className="bg-[#0D1B2B] rounded-xl p-3">
        <svg viewBox="0 0 240 60" className="w-full" preserveAspectRatio="none">
          <line x1="0" y1="15" x2="240" y2="15" stroke="#1E3550" strokeWidth="0.5" />
          <line x1="0" y1="30" x2="240" y2="30" stroke="#1E3550" strokeWidth="0.5" />
          <line x1="0" y1="45" x2="240" y2="45" stroke="#1E3550" strokeWidth="0.5" />
          <polyline points="0,42 30,38 60,40 90,30 120,32 150,22 180,24" fill="none" stroke="#3AB5A0" strokeWidth="1.5" strokeLinejoin="round" />
          <polyline points="180,24 210,18 240,16" fill="none" stroke="#3AB5A0" strokeWidth="1.5" strokeDasharray="4 3" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="bg-[#3AB5A00A] border border-[#3AB5A018] rounded-xl p-3">
        <div className="text-[9px] text-[#7BA8C4] mb-1">{sample.forecastLabel}</div>
        <div className="text-sm font-bold text-[#3AB5A0]">{sample.forecastValue}</div>
      </div>
    </div>
  );
}

function RecommendStep({ sample }: { sample: WalkthroughSample }) {
  return (
    <div className="h-[212px] flex flex-col justify-center">
      <div className="bg-[#3AB5A00A] border border-[#3AB5A025] rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[#3AB5A0] text-sm">💡</span>
          <span className="text-xs font-semibold text-[#3AB5A0]">{sample.recommendationTitle}</span>
        </div>
        <p className="text-xs text-[#A8C6E0] leading-relaxed">{sample.recommendationBody}</p>
      </div>
    </div>
  );
}
