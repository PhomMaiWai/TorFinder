import { useTranslations } from "next-intl";

import { SignInForm } from "@/components/auth/sign-in-form";

export default function OrganizationLoginPage() {
  const t = useTranslations("LoginOrganizationPage");

  return (
    <SignInForm
      icon="building"
      badge={t("badge")}
      title={t("title")}
      description={t("description")}
      redirectTo="/dashboard"
      switchHref="/login/admin"
      switchLabel={t("switchLabel")}
      signupHref="/signup/organization"
      signupLabel={t("signupLabel")}
    />
  );
}
