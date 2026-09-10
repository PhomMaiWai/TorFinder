import { useTranslations } from "next-intl";

import { SignInForm } from "@/components/auth/sign-in-form";

export default function AdminLoginPage() {
  const t = useTranslations("LoginAdminPage");

  return (
    <SignInForm
      icon="shield"
      badge="Admin"
      title={t("title")}
      description={t("description")}
      redirectTo="/admin"
      switchHref="/login/organization"
      switchLabel={t("switchLabel")}
      tone="danger"
      allowGoogleSignIn={false}
    />
  );
}
