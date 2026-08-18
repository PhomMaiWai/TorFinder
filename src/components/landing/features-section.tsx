import { Bell, Eye, FileSearch, Sparkles } from "lucide-react";
import type { ComponentType } from "react";

type Feature = {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  {
    icon: FileSearch,
    title: "รวบรวม TOR อัตโนมัติ",
    description:
      "ดึงและกรองประกาศจัดซื้อจัดจ้างซอฟต์แวร์จาก e-GP และหน่วยงาน กทม. อัตโนมัติ พร้อมตรวจจับรายการซ้ำ",
  },
  {
    icon: Sparkles,
    title: "AI สกัดข้อมูลจาก PDF",
    description:
      "Vertex AI ช่วยวิเคราะห์และสกัดข้อมูลสำคัญ เช่น ขอบเขตงาน คุณสมบัติ งบประมาณ โดยไม่ต้องเสียเวลาเปิดอ่าน PDF ทีละฉบับ",
  },
  {
    icon: Bell,
    title: "จับคู่บริษัท & แจ้งเตือน",
    description:
      "เปรียบเทียบความต้องการของ TOR กับโปรไฟล์บริษัทของคุณ และแจ้งเตือนทันทีเมื่อมีโครงการที่เหมาะสม (Match Score)",
  },
  {
    icon: Eye,
    title: "เครื่องมือเพื่อความโปร่งใส",
    description:
      "เปิดให้ประชาชนค้นหาข้อมูล และให้ สตง. ตรวจสอบความผิดปกติของราคาและการแข่งขันที่ต่ำกว่าเกณฑ์ได้ง่ายขึ้น",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="bg-white py-20 sm:py-24 border-t border-zinc-100">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            แพลตฟอร์มที่ตอบโจทย์ทั้งภาคธุรกิจและรัฐ
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-[15px] text-zinc-500 leading-relaxed">
            ระบบทำงานอัตโนมัติตั้งแต่ดึงข้อมูลไปจนถึงแจ้งเตือน ลดภาระให้เอกชน พร้อมเพิ่มความโปร่งใสให้ภาครัฐ
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 transition-all duration-200 hover:border-zinc-300 hover:shadow-sm"
            >
              <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <feature.icon size={24} />
              </div>
              <h3 className="text-[17px] font-bold text-zinc-900">{feature.title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-zinc-500">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
