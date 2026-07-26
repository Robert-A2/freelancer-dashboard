"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

export default function CsvHelpPanel() {
  const t = useTranslations("landing.csvHelp");
  const [open, setOpen] = useState(false);
  const steps = t.raw("steps") as { title: string; body: string }[];

  return (
    <div className="text-center">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-sm text-[#7BA8C4] hover:text-[#E8F0F8] transition-colors"
      >
        <span>{t("trigger")}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-6 bg-[#132537] border border-[#1E3550] rounded-2xl p-6 max-w-sm mx-auto text-left shadow-sm">
          <p className="text-sm font-semibold text-[#E8F0F8] mb-5">{t("heading")}</p>
          <div className="space-y-5">
            {steps.map((step, i) => (
              <div key={step.title} className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-[#3AB5A014] border border-[#3AB5A030] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#3AB5A0]">{i + 1}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#E8F0F8]">{step.title}</p>
                  <p className="text-xs text-[#7BA8C4] mt-1 leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#6A97B4] mt-5 pt-5 border-t border-[#1E3550] leading-relaxed">
            {t("footer")}
          </p>
        </div>
      )}
    </div>
  );
}
