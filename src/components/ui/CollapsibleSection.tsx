"use client";

import { useState } from "react";

export default function CollapsibleSection({
  label,
  title,
  subtitle,
  defaultOpen = true,
  children,
}: {
  label?: string;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 mb-4 group text-left"
      >
        <div>
          {label && <p className="label mb-1">{label}</p>}
          <h2 className="text-lg font-semibold text-[#E8F0F8] group-hover:text-[#3AB5A0] transition-colors">
            {title}
          </h2>
          {subtitle && <p className="text-sm text-[#7BA8C4] mt-0.5">{subtitle}</p>}
        </div>
        <svg
          className={`w-5 h-5 text-[#6A97B4] flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && children}
    </div>
  );
}
