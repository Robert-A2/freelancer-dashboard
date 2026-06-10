"use server";

import { cookies } from "next/headers";
import { LOCALES, type Locale } from "@/i18n/locales";
import { LOCALE_COOKIE } from "@/i18n/request";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setUserLocale(locale: Locale) {
  if (!LOCALES.includes(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
    sameSite: "lax",
  });
}
