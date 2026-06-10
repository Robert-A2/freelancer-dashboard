import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;

  let locale: Locale;
  if (isLocale(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const acceptLanguage = (await headers()).get("accept-language");
    const preferred = acceptLanguage?.split(",")[0]?.split("-")[0];
    locale = isLocale(preferred) ? preferred : DEFAULT_LOCALE;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
