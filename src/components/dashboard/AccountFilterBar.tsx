import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface Account {
  id: string;
  name: string;
  color: string | null;
}

interface Props {
  accounts: Account[];
  selectedAccountId: string | null;
}

const FALLBACK_COLORS = ["#4CC4A4", "#7BA8C4", "#D4A254", "#A78BFA", "#F09EC0", "#60A5FA"];

export default async function AccountFilterBar({ accounts, selectedAccountId }: Props) {
  if (accounts.length < 2) return null;

  const t = await getTranslations("dashboard.accountFilter");

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Link
        href="/dashboard"
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
          !selectedAccountId
            ? "bg-[#3AB5A0] text-[#112232]"
            : "bg-[#1E3446] text-[#7BA8C4] hover:text-[#E8F0F8] hover:bg-[#1E3A58]"
        }`}
      >
        {t("allAccounts")}
      </Link>

      {accounts.map((acct, i) => {
        const color     = acct.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
        const isSelected = selectedAccountId === acct.id;

        return (
          <Link
            key={acct.id}
            href={`/dashboard?accountId=${acct.id}`}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isSelected
                ? "bg-[#1E3446] text-[#E8F0F8] ring-1 ring-[#3AB5A0]"
                : "bg-[#1E3446] text-[#7BA8C4] hover:text-[#E8F0F8] hover:bg-[#1E3A58]"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            {acct.name}
          </Link>
        );
      })}
    </div>
  );
}
