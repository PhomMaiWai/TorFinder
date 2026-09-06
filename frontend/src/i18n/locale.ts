"use server";

import { cookies } from "next/headers";
import { locales, defaultLocale, type Locale } from "./config";

const COOKIE_NAME = "NEXT_LOCALE";

export async function getUserLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get(COOKIE_NAME)?.value;
  return locales.includes(cookieLocale as Locale) ? (cookieLocale as Locale) : defaultLocale;
}

export async function setUserLocale(locale: Locale) {
  (await cookies()).set(COOKIE_NAME, locale, { maxAge: 60 * 60 * 24 * 365, path: "/" });
}
