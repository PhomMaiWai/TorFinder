const STEPS = [
  {
    number: "01",
    title: "กรอกโปรไฟล์บริษัท",
    description:
      "ระบุทักษะเทคโนโลยี ขนาดองค์กร และความเชี่ยวชาญ ใช้เวลาไม่ถึง 5 นาที",
  },
  {
    number: "02",
    title: "AI วิเคราะห์และจับคู่",
    description:
      "ระบบสแกน TOR ใหม่ทุกวัน เปรียบเทียบกับโปรไฟล์ และคำนวณคะแนนความเหมาะสม",
  },
  {
    number: "03",
    title: "รับโอกาสและยื่นข้อเสนอ",
    description:
      "รับการแจ้งเตือน ดูรายละเอียดที่ AI สรุปให้แล้ว และยื่นข้อเสนอก่อนคู่แข่ง",
  },
];

export function StepsSection() {
  return (
    <section id="how-it-works" className="bg-surface-alt py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            เริ่มต้นภายใน 3 ขั้นตอน
          </h2>
          <p className="mt-3 text-base text-ink-muted">
            ง่าย รวดเร็ว ไม่ต้องการความรู้ด้านเทคนิค
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="rounded-xl border border-border bg-white p-6"
            >
              <p className="mb-4 text-5xl font-black tracking-tighter text-border">
                {step.number}
              </p>
              <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
