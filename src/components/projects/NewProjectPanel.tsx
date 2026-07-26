"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/locales";
import NewProjectForm from "./NewProjectForm";

interface Props {
  locale: Locale;
  vatRegistered?: boolean;
  defaultVatRatePct?: number | null;
}

export default function NewProjectPanel({ locale, vatRegistered = false, defaultVatRatePct = null }: Props) {
  const t = useTranslations("projects.newProject");
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <NewProjectForm
        locale={locale}
        onDone={() => setOpen(false)}
        vatRegistered={vatRegistered}
        defaultVatRatePct={defaultVatRatePct}
      />
    );
  }

  return (
    <button onClick={() => setOpen(true)} className="btn-primary">
      {t("cta")}
    </button>
  );
}
