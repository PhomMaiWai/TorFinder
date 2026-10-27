import { getRequestConfig } from "next-intl/server";

import type { Locale } from "./config";
import { getUserLocale } from "./locale";

/*
 * Static imports, not `import(\`../../messages/${locale}.json\`)`: the dev
 * server never invalidates a template-string import, so edited copy stayed
 * stale until a full restart.
 */
import en from "../../messages/en.json";
import th from "../../messages/th.json";

const MESSAGES: Record<Locale, typeof th> = { th, en };

export default getRequestConfig(async () => {
  const locale = await getUserLocale();

  return {
    locale,
    messages: MESSAGES[locale],
  };
});
