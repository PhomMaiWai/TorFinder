export type PublicNotice = {
  id: number;
  message: string;
  time: string;
};

export const PUBLIC_NOTICES: PublicNotice[] = [
  {
    id: 1,
    message: "มี TOR ใหม่ 4 รายการประกาศวันนี้ จากหน่วยงาน กทม.",
    time: "5 นาทีที่แล้ว",
  },
  {
    id: 2,
    message: "TOR \"พัฒนาระบบบริหารจัดการศูนย์ข้อมูลเมืองอัจฉริยะ\" ปิดรับความคิดเห็นในอีก 2 วัน",
    time: "2 ชั่วโมงที่แล้ว",
  },
  {
    id: 3,
    message: "ประกาศผลผู้ชนะโครงการใหม่ 2 รายการ",
    time: "เมื่อวาน",
  },
];
