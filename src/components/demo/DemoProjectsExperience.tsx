"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/locales";
import DemoNewProjectForm from "./DemoNewProjectForm";
import DemoProjectList from "./DemoProjectList";
import type { DemoProject } from "./types";

// The interactive part of the demo Projects page: create a project, see it
// land in the milestone list, copy a payment link, watch it flip to "sent"
// — entirely in local component state, so a demo visitor gets a hands-on
// feel for the real flow without needing an account. Nothing here is
// persisted; refreshing the page resets it, same as the rest of the demo.
export default function DemoProjectsExperience({ locale }: { locale: Locale }) {
  const t = useTranslations("projects");
  const [projects, setProjects] = useState<DemoProject[]>([]);
  const [showForm, setShowForm] = useState(false);

  const nextInvoiceNumber = projects.reduce((n, p) => n + p.milestones.length, 0) + 1;

  function handleCreate(project: DemoProject) {
    setProjects((prev) => [project, ...prev]);
    setShowForm(false);
  }

  function handleMarkSent(projectId: string, milestoneId: string) {
    setProjects((prev) =>
      prev.map((p) =>
        p.id !== projectId
          ? p
          : { ...p, milestones: p.milestones.map((m) => (m.id === milestoneId ? { ...m, status: "sent" } : m)) }
      )
    );
  }

  if (showForm) {
    return <DemoNewProjectForm locale={locale} onCreate={handleCreate} onCancel={() => setShowForm(false)} nextInvoiceNumber={nextInvoiceNumber} />;
  }

  if (projects.length === 0) {
    return (
      <div className="card-light text-center py-16">
        <div className="text-5xl mb-4">🤝</div>
        <h2 className="text-xl font-semibold mb-2 text-[#16283B]">{t("emptyState.heading")}</h2>
        <p className="text-[#5B7185] mb-6 max-w-sm mx-auto">{t("emptyState.body")}</p>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          {t("newProject.cta")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="btn-primary">
          {t("newProject.cta")}
        </button>
      </div>
      <DemoProjectList projects={projects} locale={locale} onMarkSent={handleMarkSent} />
    </div>
  );
}
