const FOOTER_LINKS = [
  {
    heading: "ผลิตภัณฑ์",
    links: ["ค้นหา TOR", "การแจ้งเตือน", "จับคู่ AI", "ข้อมูลเชิงลึก"],
  },
  {
    heading: "สำหรับผู้ว่าจ้าง",
    links: ["โอเพ่นดาต้า", "สตง.", "ผู้บริหาร BMA"],
  },
  {
    heading: "บริษัท",
    links: ["เกี่ยวกับ", "นโยบายความเป็นส่วนตัว", "GitHub"],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-alt">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 text-base font-bold text-ink">
              <span className="flex size-7 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">
                T
              </span>
              Torr
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              แพลตฟอร์มค้นหาและวิเคราะห์
              <br />
              TOR ซอฟต์แวร์ BMA โดย AI
            </p>
          </div>

          {FOOTER_LINKS.map((group) => (
            <div key={group.heading}>
              <h4 className="mb-3 text-sm font-semibold text-ink">
                {group.heading}
              </h4>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-ink-muted transition-colors hover:text-ink"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-sm text-ink-subtle sm:flex-row sm:items-center">
          <span>© 2569 Torr — สงวนลิขสิทธิ์</span>
          <span>Demo · ข้อมูลจำลองเพื่อการศึกษา</span>
        </div>
      </div>
    </footer>
  );
}
