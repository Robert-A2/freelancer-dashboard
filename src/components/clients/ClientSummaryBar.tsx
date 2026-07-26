"use client";

import { useTranslations } from "next-intl";

export default function ClientSummaryBar({ totalClients, currentCount, followUpCount, inactiveCount }: {
  totalClients: number; currentCount: number; followUpCount: number; inactiveCount: number;
}) {
  const t = useTranslations("clients");

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: t("summary.totalClients"), value: totalClients, color: "text-[#E8F0F8]" },
        { label: t("summary.current"),      value: currentCount,  color: "text-[#4CC4A4]" },
        { label: t("summary.followUp"),     value: followUpCount, color: "text-[#D4A254]" },
        { label: t("summary.inactive"),     value: inactiveCount, color: "text-[#6A97B4]" },
      ].map(m => (
        <div key={m.label} className="bg-[#1A3048] rounded-xl p-4">
          <p className="label mb-1">{m.label}</p>
          <p className={`text-2xl font-bold tabular-nums ${m.color}`}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}
