import { useTranslations } from "next-intl";
import type { Insight } from "@/lib/insight-types";
import { resolveInsightValues } from "@/lib/insight-types";

interface Props {
  insight: Insight;
  accent?: string;
}

// Renders a translated Insight via `t.rich`, resolving category-id sentinels
// and bolding the `<b>` figures embedded in the message templates.
export default function InsightText({ insight, accent }: Props) {
  const t = useTranslations();
  const tCategories = useTranslations("categories");

  return (
    <>
      {t.rich(insight.key, {
        ...resolveInsightValues(insight.values, tCategories),
        b: (chunks) => (
          <strong className="font-semibold" style={accent ? { color: accent } : undefined}>
            {chunks}
          </strong>
        ),
      })}
    </>
  );
}
