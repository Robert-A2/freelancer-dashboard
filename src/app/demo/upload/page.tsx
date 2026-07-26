"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const STEP_KEYS = ["reading", "parsing", "detecting", "categorizing", "building"] as const;
const STEP_PCTS = [15, 35, 55, 75, 92] as const;
const STEP_DURATION = 750;

export default function DemoUploadPage() {
  const router = useRouter();
  const t = useTranslations("demo.uploadProgress");
  const [currentStep, setCurrentStep]   = useState(-1);
  const [progress, setProgress]         = useState(0);
  const [complete, setComplete]         = useState(false);

  useEffect(() => {
    let step = 0;

    const advance = () => {
      if (step < STEP_KEYS.length) {
        setCurrentStep(step);
        setProgress(STEP_PCTS[step]);
        step++;
        setTimeout(advance, STEP_DURATION);
      } else {
        setProgress(100);
        setComplete(true);
        setTimeout(() => router.push("/demo"), 700);
      }
    };

    const initial = setTimeout(advance, 400);
    return () => clearTimeout(initial);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0D1B2B] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">

        {/* File icon */}
        <div className="flex justify-center mb-10">
          <div className={`relative transition-all duration-500 ${complete ? "scale-110" : "scale-100"}`}>
            {/* CSV file card */}
            <div className={`w-24 h-28 rounded-2xl flex flex-col items-center justify-center border-2 transition-colors duration-500 ${
              complete
                ? "border-[#3AB5A0] bg-[#3AB5A015]"
                : "border-[#1E3550] bg-[#132537]"
            }`}>
              <svg
                className={`w-8 h-8 mb-2 transition-colors duration-500 ${complete ? "text-[#3AB5A0]" : "text-[#4A7A9B]"}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
              <span className={`text-[10px] font-bold tracking-wider transition-colors duration-500 ${complete ? "text-[#3AB5A0]" : "text-[#4A7A9B]"}`}>
                CSV
              </span>
            </div>

            {/* Checkmark overlay */}
            {complete && (
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#3AB5A0] rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-4 h-4 text-[#0D1B2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Status label */}
        <div className="text-center mb-8 h-6">
          {complete ? (
            <p className="text-[#3AB5A0] font-semibold text-base">{t("ready")}</p>
          ) : currentStep >= 0 ? (
            <p className="text-[#A8C6E0] text-sm">{t(`steps.${STEP_KEYS[currentStep]}`)}…</p>
          ) : (
            <p className="text-[#4A7A9B] text-sm">{t("preparing")}</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-[#1A3048] rounded-full overflow-hidden mb-8">
          <div
            className="h-full bg-[#3AB5A0] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step checklist */}
        <ul className="space-y-3">
          {STEP_KEYS.map((key, i) => {
            const done   = i < currentStep || complete;
            const active = i === currentStep && !complete;
            return (
              <li key={key} className={`flex items-center gap-3 text-sm transition-opacity duration-300 ${
                i > currentStep && !complete ? "opacity-30" : "opacity-100"
              }`}>
                <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border transition-colors duration-300 ${
                  done
                    ? "bg-[#3AB5A0] border-[#3AB5A0]"
                    : active
                    ? "border-[#3AB5A0]"
                    : "border-[#1E3550]"
                }`}>
                  {done ? (
                    <svg className="w-3 h-3 text-[#0D1B2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : active ? (
                    <span className="w-1.5 h-1.5 bg-[#3AB5A0] rounded-full animate-pulse" />
                  ) : null}
                </span>
                <span className={done ? "text-[#7BA8C4]" : active ? "text-[#E8F0F8] font-medium" : "text-[#4A7A9B]"}>
                  {t(`steps.${key}`)}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-center text-xs text-[#243F5E] mt-10">
          {t("footer")}
        </p>
      </div>
    </div>
  );
}
