import { connection } from "next/server";

import { issueFormToken } from "@/lib/form-timing";

import { OrganizationSignupForm } from "./signup-form";

/**
 * Rendered per request, never prerendered: the form carries a token saying
 * when this page was served, and the backend refuses a sign-up sent back
 * sooner than a person could fill it in (ASVS 2.4.2).
 */
export default async function OrganizationSignupPage() {
  await connection();
  return <OrganizationSignupForm formToken={issueFormToken("signup")} />;
}
