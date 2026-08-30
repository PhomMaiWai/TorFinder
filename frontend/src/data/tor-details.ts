export type TorDetailData = {
  id: number;
  scope: string;
  qualifications: string[];
  deliverables: string[];
  contractPeriod: string;
  priceBenchmark: string;
  budgetStatus?: "สูงกว่าปกติ" | "ต่ำกว่าปกติ" | "ปกติ";
  feedbackDeadline: string | null;
  feedbackCount: number;
  matchedCompaniesCount: number;
  sourceUrl: string;
  publishedAt: string;
  awardedVendor?: {
    name: string;
    matchScore: number;
    mismatchReasons: string[];
    status: "normal" | "warning";
  };
};

export const TOR_DETAILS: TorDetailData[] = [
  {
    id: 1,
    scope:
      "พัฒนาและติดตั้งแพลตฟอร์มศูนย์ข้อมูลเมืองอัจฉริยะ (Smart City Data Platform) ครอบคลุมการรวบรวมข้อมูลจากเซ็นเซอร์ IoT ไม่น้อยกว่า 500 จุด เชื่อมต่อ API จากระบบสารสนเทศที่มีอยู่เดิมของ กทม. และแสดงผลผ่านแดชบอร์ดสำหรับผู้บริหารและประชาชน รองรับผู้ใช้งานพร้อมกันไม่น้อยกว่า 5,000 คน โดยระบบต้องรองรับ Uptime ≥ 99.5% และปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562",
    qualifications: [
      "นิติบุคคลที่จดทะเบียนถูกต้องตามกฎหมายไทย ทุนจดทะเบียนไม่น้อยกว่า 5 ล้านบาท",
      "ประสบการณ์พัฒนาระบบ Data Platform หรือ Cloud Architecture ไม่น้อยกว่า 3 ปี",
      "มีผลงานที่ผ่านมาด้าน Cloud / Kubernetes มูลค่าสัญญาไม่น้อยกว่า 5 ล้านบาท",
      "ทีมงานมีผู้เชี่ยวชาญ Cloud Infrastructure และ DevOps อย่างน้อย 2 คน",
    ],
    deliverables: [
      "แพลตฟอร์มหลักพร้อมระบบ ETL และ Data Lake",
      "แดชบอร์ดผู้บริหาร 3 ระดับ (เมือง / เขต / หน่วยงาน)",
      "API Gateway สำหรับนักพัฒนาภายนอก",
      "คู่มือการใช้งานและคู่มือดูแลระบบ",
      "การอบรมผู้ดูแลระบบ 20 ชั่วโมง",
    ],
    contractPeriod: "12 เดือน",
    priceBenchmark:
      "ราคากลาง ฿11,800,000 อ้างอิงจาก 3 บริษัทที่สอบถามราคา AI ประเมินว่าราคาอยู่ในช่วงปกติสำหรับโครงการ Platform ขนาดนี้",
    budgetStatus: "ปกติ",
    feedbackDeadline: "18 ส.ค. 2569",
    feedbackCount: 3,
    matchedCompaniesCount: 14,
    sourceUrl: "https://www.egp.cgd.go.th/",
    publishedAt: "5 ส.ค. 2569",
  },
  {
    id: 2,
    scope:
      "พัฒนาระบบรับเรื่องร้องเรียนแบบ Omnichannel รองรับช่องทาง LINE OA เว็บไซต์ และแอปพลิเคชันมือถือ พร้อมระบบ Workflow การส่งต่อเรื่องระหว่างหน่วยงานภายใน และแดชบอร์ดติดตามสถานะสำหรับผู้ร้องเรียนแบบเรียลไทม์ ระบบต้องรองรับภาษาไทยและอังกฤษ",
    qualifications: [
      "นิติบุคคลที่จดทะเบียนถูกต้องตามกฎหมาย",
      "ประสบการณ์พัฒนา Web Application ไม่น้อยกว่า 2 ปี",
      "เคยพัฒนาระบบที่เชื่อมต่อ LINE Official Account มาแล้ว",
      "ทีมงานมี UX/UI Designer อย่างน้อย 1 คน",
    ],
    deliverables: [
      "ระบบรับเรื่องร้องเรียน 3 ช่องทาง",
      "Admin Panel สำหรับเจ้าหน้าที่",
      "แดชบอร์ดรายงานสำหรับผู้บริหาร",
      "API เชื่อมต่อระบบเดิมของสำนักงานเขต",
    ],
    contractPeriod: "8 เดือน",
    priceBenchmark:
      "ราคากลาง ฿7,500,000 AI ประเมินว่าอยู่ในช่วงเหมาะสมสำหรับระบบ Omnichannel ขนาดกลาง",
    budgetStatus: "ปกติ",
    feedbackDeadline: null,
    feedbackCount: 0,
    matchedCompaniesCount: 22,
    sourceUrl: "https://www.egp.cgd.go.th/",
    publishedAt: "8 ส.ค. 2569",
  },
  {
    id: 3,
    scope:
      "จัดหาและติดตั้งระบบสารสนเทศโรงพยาบาล (HIS) ครอบคลุมการบริหารเวชระเบียน การนัดหมาย การจ่ายยา และการเรียกเก็บเงิน รองรับโรงพยาบาลในสังกัด กทม. ทั้ง 11 แห่ง พร้อมระบบแลกเปลี่ยนข้อมูลสุขภาพตามมาตรฐาน HL7 FHIR และมาตรฐานความปลอดภัย ISO 27001",
    qualifications: [
      "ผู้รับจ้างต้องมีใบอนุญาตผู้ค้าซอฟต์แวร์จากกระทรวงพาณิชย์",
      "ประสบการณ์พัฒนา HIS หรือ EMR ไม่น้อยกว่า 5 ปี",
      "มีผลงานในโรงพยาบาลรัฐบาลมูลค่าไม่น้อยกว่า 10 ล้านบาท",
      "ทีมงานมี Healthcare IT Security ที่มีใบรับรอง CISSP หรือเทียบเท่า",
    ],
    deliverables: [
      "ระบบ HIS ครบทั้ง 11 โรงพยาบาล",
      "ระบบแลกเปลี่ยนข้อมูล HL7 FHIR",
      "การฝึกอบรมบุคลากร 200 คน",
      "การสนับสนุนระบบ 3 ปีหลังติดตั้ง",
    ],
    contractPeriod: "18 เดือน",
    priceBenchmark:
      "ราคากลาง ฿23,500,000 AI ตรวจพบว่าราคาต่ำกว่ามาตรฐานตลาด HIS ระดับ Enterprise ประมาณ 15% — แนะนำให้ตรวจสอบขอบเขตงาน",
    budgetStatus: "ต่ำกว่าปกติ",
    feedbackDeadline: null,
    feedbackCount: 1,
    matchedCompaniesCount: 8,
    sourceUrl: "https://www.egp.cgd.go.th/",
    publishedAt: "3 ส.ค. 2569",
    awardedVendor: {
      name: "บริษัท เว็บดีไซน์ แอนด์ เดฟ จำกัด",
      matchScore: 45,
      mismatchReasons: [
        "ไม่มีประวัติผลงานด้าน Healthcare IT และมาตรฐาน HL7 FHIR",
        "ทีมงานไม่มีผู้เชี่ยวชาญด้าน Security (CISSP) ตามที่ระบุในคุณสมบัติ",
      ],
      status: "warning",
    },
  },
  {
    id: 4,
    scope:
      "พัฒนาแอปพลิเคชันมือถือ (iOS และ Android) สำหรับบริการประชาชนในเขตพื้นที่ กทม. ให้ยื่นคำร้อง ขอใบอนุญาต นัดหมายเจ้าหน้าที่ และตรวจสอบสถานะคำร้องได้ พร้อมระบบแจ้งเตือน Push Notification และ Deep Link",
    qualifications: [
      "ประสบการณ์พัฒนา Mobile Application ไม่น้อยกว่า 2 ปี",
      "เคยพัฒนาแอปพลิเคชันที่มีผู้ใช้งานมากกว่า 10,000 คน",
      "ทีมงาน iOS และ Android Developer อย่างน้อยทีมละ 1 คน",
    ],
    deliverables: [
      "แอปพลิเคชัน iOS และ Android",
      "Admin Portal สำหรับเจ้าหน้าที่เขต",
      "API Backend พร้อม Documentation",
      "คู่มือผู้ใช้งาน",
    ],
    contractPeriod: "10 เดือน",
    priceBenchmark:
      "ราคากลาง ฿5,750,000 AI ประเมินว่าอยู่ในช่วงเหมาะสมสำหรับแอปพลิเคชันสองแพลตฟอร์ม",
    budgetStatus: "ปกติ",
    feedbackDeadline: "2 ก.ย. 2569",
    feedbackCount: 5,
    matchedCompaniesCount: 18,
    sourceUrl: "https://www.egp.cgd.go.th/",
    publishedAt: "9 ส.ค. 2569",
  },
  {
    id: 5,
    scope: "พัฒนาระบบ Dashboard แสดงผลข้อมูลการทำงานของพนักงานกวาดถนน และบันทึกเวลาเข้าออก พร้อมระบบจัดการข้อมูลพื้นฐาน (CRUD)",
    qualifications: [
      "ประสบการณ์พัฒนาระบบ Web Application ไม่น้อยกว่า 3 ปี",
      "มีผลงานพัฒนาระบบ Dashboard ให้กับหน่วยงานรัฐ",
    ],
    deliverables: [
      "Web Application สำหรับบันทึกและแสดงผล",
      "Source Code และ Database Schema",
      "คู่มือการใช้งาน",
    ],
    contractPeriod: "6 เดือน",
    priceBenchmark: "ราคากลาง ฿5,000,000 AI ประเมินว่าราคาสูงกว่าโครงการลักษณะใกล้เคียง (Dashboard + CRUD) อย่างมีนัยสำคัญ แนะนำให้ตรวจสอบเพิ่มเติม",
    budgetStatus: "สูงกว่าปกติ",
    feedbackDeadline: null,
    feedbackCount: 0,
    matchedCompaniesCount: 5,
    sourceUrl: "https://www.egp.cgd.go.th/",
    publishedAt: "1 ส.ค. 2569",
    awardedVendor: {
      name: "บริษัท เอ บี ซี คอนสตรัคชั่น จำกัด",
      matchScore: 20,
      mismatchReasons: [
        "บริษัทจดทะเบียนในหมวดรับเหมาก่อสร้าง ไม่มีประวัติรับงานซอฟต์แวร์",
        "ไม่มีบุคลากรด้าน IT ในระบบประกันสังคม",
      ],
      status: "warning",
    },
  },
  {
    id: 6,
    scope:
      "พัฒนาแอปพลิเคชันมือถือแจ้งเตือนภัยพิบัติและสภาพอากาศแบบเรียลไทม์ เชื่อมต่อข้อมูลจากกรมอุตุนิยมวิทยาและศูนย์เตือนภัยพิบัติแห่งชาติ พร้อมระบบให้ประชาชนแจ้งเหตุฉุกเฉินพร้อมพิกัดตำแหน่งและรูปภาพ",
    qualifications: [
      "ประสบการณ์พัฒนา Mobile Application ไม่น้อยกว่า 2 ปี",
      "เคยเชื่อมต่อ API หน่วยงานภาครัฐมาก่อน",
      "ทีมงานมี iOS และ Android Developer อย่างน้อยทีมละ 1 คน",
    ],
    deliverables: [
      "แอปพลิเคชัน iOS และ Android",
      "ระบบแจ้งเหตุฉุกเฉินพร้อมพิกัด GPS",
      "Admin Portal สำหรับศูนย์เฝ้าระวัง",
      "คู่มือผู้ใช้งาน",
    ],
    contractPeriod: "6 เดือน",
    priceBenchmark:
      "ราคากลาง ฿2,200,000 AI ประเมินว่าอยู่ในช่วงเหมาะสมสำหรับแอปพลิเคชันแจ้งเตือนขนาดเล็กถึงกลาง",
    budgetStatus: "ปกติ",
    feedbackDeadline: "25 ส.ค. 2569",
    feedbackCount: 2,
    matchedCompaniesCount: 11,
    sourceUrl: "https://www.egp.cgd.go.th/",
    publishedAt: "13 ส.ค. 2569",
  },
  {
    id: 7,
    scope:
      "ปรับปรุงระบบสารบรรณอิเล็กทรอนิกส์ให้รองรับลายเซ็นดิจิทัลตามมาตรฐาน ETDA การรับ-ส่งหนังสือราชการระหว่างหน่วยงาน และระบบติดตามสถานะเอกสารแบบเรียลไทม์",
    qualifications: [
      "นิติบุคคลที่จดทะเบียนถูกต้องตามกฎหมาย",
      "ประสบการณ์พัฒนาระบบสารบรรณหรือ Document Workflow ไม่น้อยกว่า 2 ปี",
      "เคยพัฒนาระบบที่รองรับลายเซ็นดิจิทัลตามมาตรฐาน ETDA",
    ],
    deliverables: [
      "ระบบสารบรรณอิเล็กทรอนิกส์ที่ปรับปรุงแล้ว",
      "โมดูลลายเซ็นดิจิทัล",
      "คู่มือการใช้งานและคู่มือดูแลระบบ",
    ],
    contractPeriod: "5 เดือน",
    priceBenchmark:
      "ราคากลาง ฿3,400,000 AI ประเมินว่าอยู่ในช่วงเหมาะสมสำหรับการปรับปรุงระบบสารบรรณขนาดกลาง",
    budgetStatus: "ปกติ",
    feedbackDeadline: null,
    feedbackCount: 0,
    matchedCompaniesCount: 9,
    sourceUrl: "https://www.egp.cgd.go.th/",
    publishedAt: "10 ส.ค. 2569",
  },
  {
    id: 8,
    scope:
      "ขยายระบบเวชระเบียนอิเล็กทรอนิกส์ (EMR) ระยะที่ 2 ให้ครอบคลุมโรงพยาบาลในสังกัด กทม. ทุกแห่ง พร้อมเชื่อมโยงข้อมูลระหว่างสถานพยาบาลตามมาตรฐาน HL7 FHIR และระบบความปลอดภัยข้อมูลผู้ป่วยตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล",
    qualifications: [
      "ประสบการณ์พัฒนาระบบ EMR หรือ HIS ไม่น้อยกว่า 3 ปี",
      "มีผลงานในโรงพยาบาลรัฐบาลมูลค่าไม่น้อยกว่า 5 ล้านบาท",
      "ทีมงานมีผู้เชี่ยวชาญด้าน Healthcare Data Security",
    ],
    deliverables: [
      "ระบบ EMR ระยะที่ 2 ครอบคลุมโรงพยาบาลทุกแห่ง",
      "ระบบเชื่อมโยงข้อมูล HL7 FHIR ระหว่างสถานพยาบาล",
      "การฝึกอบรมบุคลากร 150 คน",
      "การสนับสนุนระบบ 2 ปีหลังติดตั้ง",
    ],
    contractPeriod: "14 เดือน",
    priceBenchmark:
      "ราคากลาง ฿18,000,000 AI ประเมินว่าอยู่ในช่วงเหมาะสมสำหรับโครงการขยายระบบ EMR ระดับเครือข่ายโรงพยาบาล",
    budgetStatus: "ปกติ",
    feedbackDeadline: "5 ก.ย. 2569",
    feedbackCount: 1,
    matchedCompaniesCount: 7,
    sourceUrl: "https://www.egp.cgd.go.th/",
    publishedAt: "12 ส.ค. 2569",
  },
  {
    id: 9,
    scope:
      "พัฒนาเว็บไซต์ประชาสัมพันธ์แสดงผลข้อมูลคุณภาพอากาศ (PM2.5) และสภาพแวดล้อมของกรุงเทพมหานครแบบเรียลไทม์ เชื่อมต่อข้อมูลจากสถานีตรวจวัดคุณภาพอากาศทั่วกรุงเทพฯ พร้อมระบบแจ้งเตือนประชาชนเมื่อค่าฝุ่นเกินมาตรฐาน",
    qualifications: [
      "ประสบการณ์พัฒนา Web Application ไม่น้อยกว่า 1 ปี",
      "มีผลงานด้านการแสดงผลข้อมูล Dashboard แบบเรียลไทม์",
    ],
    deliverables: [
      "เว็บไซต์แสดงผลคุณภาพอากาศแบบเรียลไทม์",
      "ระบบแจ้งเตือนประชาชนผ่านเว็บและอีเมล",
      "คู่มือการใช้งาน",
    ],
    contractPeriod: "4 เดือน",
    priceBenchmark:
      "ราคากลาง ฿900,000 AI ประเมินว่าอยู่ในช่วงเหมาะสมสำหรับเว็บไซต์แสดงผลข้อมูลขนาดเล็ก",
    budgetStatus: "ปกติ",
    feedbackDeadline: null,
    feedbackCount: 0,
    matchedCompaniesCount: 6,
    sourceUrl: "https://www.egp.cgd.go.th/",
    publishedAt: "2 ส.ค. 2569",
    awardedVendor: {
      name: "บริษัท กรีน เว็บ สตูดิโอ จำกัด",
      matchScore: 88,
      mismatchReasons: [],
      status: "normal",
    },
  },
];

/** Mock feedback submissions for the owner/public views */
export type FeedbackEntry = {
  id: number;
  torId: number;
  author: string;
  text: string;
  submittedAt: string;
  status: "รอตรวจสอบ" | "อนุมัติ" | "ปฏิเสธ";
};

export const FEEDBACK_ENTRIES: FeedbackEntry[] = [
  {
    id: 1,
    torId: 1,
    author: "บริษัท เทค เวิร์คส์ จำกัด",
    text: "คุณสมบัติด้านประสบการณ์ Cloud 3 ปีอาจจำกัดผู้เสนอมากเกินไป แนะนำให้ปรับเป็น 2 ปีและเพิ่มเกณฑ์จำนวนโครงการแทน",
    submittedAt: "10 ส.ค. 2569",
    status: "อนุมัติ",
  },
  {
    id: 2,
    torId: 1,
    author: "ประชาชนทั่วไป",
    text: "ขอให้ระบุแผนการดูแลความปลอดภัยข้อมูลส่วนบุคคลให้ชัดเจนขึ้น",
    submittedAt: "11 ส.ค. 2569",
    status: "รอตรวจสอบ",
  },
  {
    id: 3,
    torId: 1,
    author: "สมาคมผู้ประกอบการซอฟต์แวร์ไทย",
    text: "งบประมาณ 11.8 ล้านบาทอาจไม่ครอบคลุม License ระบบ Cloud ระยะยาว ควรระบุ OPEX แยกออกมาด้วย",
    submittedAt: "11 ส.ค. 2569",
    status: "รอตรวจสอบ",
  },
  {
    id: 4,
    torId: 4,
    author: "บริษัท โมบาย โซลูชัน จำกัด",
    text: "ขอให้เพิ่มเกณฑ์ด้าน Accessibility (WCAG 2.1) ในขอบเขตงาน เพื่อรองรับผู้ใช้งานที่มีความพิการ",
    submittedAt: "12 ส.ค. 2569",
    status: "อนุมัติ",
  },
  {
    id: 5,
    torId: 4,
    author: "ดร. วิชัย ประชาสรรค์",
    text: "ควรกำหนด SLA ของ Push Notification ให้ชัดเจน เช่น ส่งภายในกี่วินาทีหลังเกิดเหตุการณ์",
    submittedAt: "12 ส.ค. 2569",
    status: "รอตรวจสอบ",
  },
];

/** Mock matched companies for the owner view */
export type MatchedCompany = {
  name: string;
  score: number;
  size: string;
  specialty: string;
};

export const MATCHED_COMPANIES: Record<number, MatchedCompany[]> = {
  1: [
    { name: "บริษัท เทค เวิร์คส์ จำกัด", score: 96, size: "กลาง", specialty: "Cloud / Data Platform" },
    { name: "บริษัท โซลูชัน ดิจิทัล จำกัด", score: 91, size: "ใหญ่", specialty: "Enterprise Software" },
    { name: "บริษัท อินโน่ซอฟต์ จำกัด", score: 88, size: "เล็ก", specialty: "Next.js / DevOps" },
    { name: "บริษัท ดาต้า อีสต์ จำกัด", score: 83, size: "กลาง", specialty: "Data Engineering" },
  ],
  2: [
    { name: "บริษัท โมบาย โซลูชัน จำกัด", score: 94, size: "กลาง", specialty: "UX/UI / LINE API" },
    { name: "บริษัท เน็กซ์เวฟ จำกัด", score: 89, size: "เล็ก", specialty: "Web Application" },
    { name: "บริษัท ไทย เทค จำกัด", score: 84, size: "ใหญ่", specialty: "Workflow Systems" },
  ],
  3: [
    { name: "บริษัท เฮลท์ ซิส จำกัด", score: 92, size: "ใหญ่", specialty: "Healthcare IT / HL7" },
    { name: "บริษัท เมดิคัล ไอที จำกัด", score: 86, size: "กลาง", specialty: "HIS / EMR" },
  ],
  4: [
    { name: "บริษัท แอพ สตูดิโอ จำกัด", score: 95, size: "เล็ก", specialty: "React Native / Flutter" },
    { name: "บริษัท ซิตี้ ดิจิทัล จำกัด", score: 87, size: "กลาง", specialty: "Citizen Services" },
    { name: "บริษัท โมบาย โซลูชัน จำกัด", score: 82, size: "กลาง", specialty: "iOS / Android" },
  ],
};
