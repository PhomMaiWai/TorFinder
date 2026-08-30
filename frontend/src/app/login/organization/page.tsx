import { SignInForm } from "@/components/auth/sign-in-form";

export default function OrganizationLoginPage() {
  return (
    <SignInForm
      icon="building"
      badge="หน่วยงาน / บริษัท"
      title="เข้าสู่ระบบสำหรับหน่วยงาน"
      description="ติดตามและจับคู่โอกาส TOR ที่ตรงกับบริษัทของคุณ"
      redirectTo="/dashboard"
      switchHref="/login/admin"
      switchLabel="เข้าสู่ระบบผู้ดูแลระบบแทน →"
      signupHref="/signup/organization"
      signupLabel="สมัครสมาชิกหน่วยงาน"
    />
  );
}
