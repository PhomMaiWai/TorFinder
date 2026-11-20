"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, locales, defaultLocale, type Locale } from "./config";

export async function getUserLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  return locales.includes(cookieLocale as Locale) ? (cookieLocale as Locale) : defaultLocale;
}

export async function setUserLocale(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}
