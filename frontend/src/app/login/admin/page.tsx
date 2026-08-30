import { SignInForm } from "@/components/auth/sign-in-form";

export default function AdminLoginPage() {
  return (
    <SignInForm
      icon="shield"
      badge="Admin"
      title="เข้าสู่ระบบผู้ดูแลระบบ"
      description="สำหรับผู้ดูแลระบบ TorFinder เท่านั้น"
      redirectTo="/admin"
      switchHref="/login/organization"
      switchLabel="เข้าสู่ระบบหน่วยงานแทน →"
      tone="danger"
    />
  );
}
