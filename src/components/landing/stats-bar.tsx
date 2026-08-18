const STATS = [
  { value: "200+", label: "TOR ซอฟต์แวร์ต่อปี" },
  { value: "40+", label: "หน่วยงาน BMA" },
  { value: "฿450M+", label: "มูลค่าตลาดต่อปี" },
  { value: "ทุก 24 ชม.", label: "รอบอัปเดตข้อมูล" },
];

export function StatsBar() {
  return (
    <section className="border-y border-border bg-surface-alt">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-ink">{stat.value}</p>
              <p className="mt-1 text-sm text-ink-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
