import Link from "next/link";

const SAMPLE_CSVS = [
  { name: "Designer", file: "designer.csv", desc: "Freelance UX / product designer, 3 clients, Paris" },
  { name: "Developer", file: "developer.csv", desc: "Full-stack contractor, 2 agencies, London" },
  { name: "Consultant", file: "consultant.csv", desc: "Strategy consultant, 4 clients, variable income" },
  { name: "Photographer", file: "photographer.csv", desc: "Commercial photographer, project-based income" },
];

export default function DemoSection() {
  return (
    <div className="space-y-6">
      {/* Headline */}
      <div>
        <p className="text-xs font-medium text-[#3AB5A0] uppercase tracking-widest mb-3">
          See it in action
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#E8F0F8] leading-tight mb-2">
          See how Freelancer OS understands a freelancer&apos;s financial life.
        </h2>
        <p className="text-[#7BA8C4] text-base leading-relaxed">
          No accounting. No spreadsheets. Just clarity.
        </p>
      </div>

      {/* Primary CTA — demo workspace */}
      <Link
        href="/demo"
        className="block w-full bg-[#3AB5A015] hover:bg-[#3AB5A025] border border-[#3AB5A030] hover:border-[#3AB5A060] rounded-2xl px-6 py-5 transition-all group"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-[#3AB5A020] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#3AB5A030] transition-colors">
            <span className="text-[#3AB5A0] text-lg">▶</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#E8F0F8] text-sm mb-0.5">Explore Sample Freelancer</p>
            <p className="text-xs text-[#7BA8C4] leading-relaxed">
              Sophie Martin · Freelance UX Designer · 3 years of data · No login required
            </p>
          </div>
          <svg className="w-4 h-4 text-[#3AB5A0] flex-shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>

        {/* Preview metrics */}
        <div className="mt-4 grid grid-cols-3 gap-2 pt-4 border-t border-[#3AB5A015]">
          {[
            { label: "Income growth", value: "+16%", color: "text-[#4CC4A4]" },
            { label: "Top client share", value: "83%", color: "text-[#D4A254]" },
            { label: "Months of data", value: "36",   color: "text-[#7BA8C4]" },
          ].map(m => (
            <div key={m.label} className="text-center">
              <p className={`text-lg font-bold tabular-nums ${m.color}`}>{m.value}</p>
              <p className="text-[10px] text-[#6A97B4] mt-0.5 leading-tight">{m.label}</p>
            </div>
          ))}
        </div>
      </Link>

      {/* Secondary CTA — sample CSVs */}
      <div className="bg-[#1A3048] border border-[#243F5E] rounded-2xl px-5 py-4">
        <p className="text-xs font-semibold text-[#7BA8C4] uppercase tracking-wider mb-3">
          Upload Sample CSV
        </p>
        <p className="text-xs text-[#6A97B4] mb-4 leading-relaxed">
          Download a realistic freelancer CSV and run it through the real engine — the same one real users see.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SAMPLE_CSVS.map(csv => (
            <a
              key={csv.file}
              href={`/samples/${csv.file}`}
              download
              className="flex items-start gap-2.5 p-2.5 bg-[#132537] hover:bg-[#1E3A56] border border-[#243F5E] hover:border-[#3AB5A030] rounded-xl transition-colors group"
            >
              <svg className="w-3.5 h-3.5 text-[#4A7A9B] flex-shrink-0 mt-0.5 group-hover:text-[#3AB5A0] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#A8C6E0] group-hover:text-[#E8F0F8] transition-colors">{csv.name}</p>
                <p className="text-[10px] text-[#4A7A9B] leading-tight mt-0.5 truncate">{csv.desc}</p>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-[#1E3550]">
          <p className="text-[10px] text-[#4A7A9B] leading-relaxed">
            After downloading, sign up and upload the CSV — you&apos;ll see insights generated from your data, not hardcoded examples.
          </p>
        </div>
      </div>

      {/* Trust note */}
      <p className="text-xs text-[#4A7A9B] text-center">
        The demo uses the exact same engine as real accounts.
      </p>
    </div>
  );
}
