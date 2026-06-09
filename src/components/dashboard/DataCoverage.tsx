import type { DataCoverage } from "@/lib/analytics-engine";

interface Props { coverage: DataCoverage; }

function formatSpan(years: number, months: number): string {
  if (years >= 1) {
    const remainder = months - years * 12;
    return remainder >= 1 ? `${years}y ${remainder}m` : `${years} year${years !== 1 ? "s" : ""}`;
  }
  return `${months} month${months !== 1 ? "s" : ""}`;
}

export default function DataCoverage({ coverage }: Props) {
  if (coverage.count === 0) return null;

  const span = formatSpan(coverage.years, coverage.months);

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-[#4CC4A40A] border border-[#4CC4A420] rounded-xl">
      <div className="w-5 h-5 rounded-full bg-[#4CC4A4] flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-0.5 sm:gap-x-4 min-w-0">
        <span className="text-sm font-semibold text-[#4CC4A4]">
          {span} of history · {coverage.count.toLocaleString()} transactions
        </span>
        {coverage.rangeLabel && (
          <span className="text-xs text-[#6A97B4]">Analysis range: {coverage.rangeLabel}</span>
        )}
      </div>
    </div>
  );
}
