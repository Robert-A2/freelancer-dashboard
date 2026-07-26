import type { ClientStatus } from "@/lib/client-risk-engine";

export const STATUS_STYLES: Record<ClientStatus, { dot: string; text: string; bg: string }> = {
  current:  { dot: "bg-[#4CC4A4]", text: "text-[#4CC4A4]", bg: "bg-[#4CC4A415]" },
  watch:    { dot: "bg-[#D4A254]", text: "text-[#D4A254]", bg: "bg-[#D4A25415]" },
  risk:     { dot: "bg-[#D97070]", text: "text-[#D97070]", bg: "bg-[#D9707015]" },
  inactive: { dot: "bg-[#4A7A9B]", text: "text-[#6A97B4]", bg: "bg-[#1A304880]" },
};

export default function StatusBadge({ status, label }: { status: ClientStatus; label: string }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {label}
    </span>
  );
}
