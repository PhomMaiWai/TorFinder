/**
 * Where a procurement announcement is for. This product covers Bangkok, and the
 * three sources say so in three different ways: the e-GP feed is the city's own
 * portal, MEA serves the metropolitan area and names the odd site outside it,
 * and the open-data dumps are national. So "is this ours?" is decided here,
 * once, from whatever the record happens to carry.
 */

/**
 * Bangkok as a box. Crude on purpose: a point-in-polygon over the city boundary
 * would need the boundary shipped and maintained, and the box is only ever
 * asked about a project that is already a procurement record with an address
 * somewhere in Thailand. It bleeds a little into Nonthaburi and Samut Prakan,
 * which is the same metropolitan area the electricity authority serves.
 */
export const BANGKOK_BOUNDS = {
  minLat: 13.49,
  maxLat: 13.96,
  minLong: 100.32,
  maxLong: 100.94,
} as const;

export function isPointInBangkok(lat: number, long: number): boolean {
  return (
    lat >= BANGKOK_BOUNDS.minLat &&
    lat <= BANGKOK_BOUNDS.maxLat &&
    long >= BANGKOK_BOUNDS.minLong &&
    long <= BANGKOK_BOUNDS.maxLong
  );
}

/** How an agency or a project title says "Bangkok". */
const BANGKOK_NAMES = ["กรุงเทพ", "กทม", "บางกอก"];

/**
 * The 76 provinces, as they appear inside an agency's name. Four are left out
 * of plain matching because they are ordinary Thai words as well — "เลย",
 * "ตาก", "น่าน" and "แพร่" — and are recognised only when written the long way.
 */
const PROVINCES = [
  "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น", "จันทบุรี", "ฉะเชิงเทรา",
  "ชลบุรี", "ชัยนาท", "ชัยภูมิ", "ชุมพร", "เชียงราย", "เชียงใหม่", "ตรัง", "ตราด",
  "นครนายก", "นครปฐม", "นครพนม", "นครราชสีมา", "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี",
  "นราธิวาส", "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี",
  "พระนครศรีอยุธยา", "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี", "เพชรบูรณ์",
  "ภูเก็ต", "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร", "ยะลา", "ร้อยเอ็ด", "ระนอง",
  "ระยอง", "ราชบุรี", "ลพบุรี", "ลำปาง", "ลำพูน", "ศรีสะเกษ", "สกลนคร", "สงขลา", "สตูล",
  "สมุทรปราการ", "สมุทรสงคราม", "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี",
  "สุโขทัย", "สุพรรณบุรี", "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย", "หนองบัวลำภู",
  "อ่างทอง", "อำนาจเจริญ", "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี", "อุบลราชธานี",
];

/** The four that need the word "จังหวัด" in front to be a province rather than a word. */
const AMBIGUOUS_PROVINCES = ["เลย", "ตาก", "น่าน", "แพร่"];

/**
 * Local government that exists only outside Bangkok: the capital is a special
 * administrative area with districts (เขต), not อำเภอ, and has no municipality
 * or sub-district authority of its own.
 */
const OUTSIDE_MARKERS = ["อำเภอ", "เทศบาล", "องค์การบริหารส่วนตำบล", "อบต."];

const containsAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));

/** Says Bangkok outright — the only way a national source can prove it. */
export function namesBangkok(...texts: (string | null | undefined)[]): boolean {
  return containsAny(texts.filter(Boolean).join(" "), BANGKOK_NAMES);
}

/**
 * Names a place that isn't Bangkok. Used to weed out the announcements a
 * metropolitan source files for the neighbouring provinces it also serves — a
 * site named only by its district still slips through, which is why this is a
 * filter on top of a source that is already local, never a test of its own.
 */
export function namesSomewhereElse(...texts: (string | null | undefined)[]): boolean {
  const text = texts.filter(Boolean).join(" ");
  if (namesBangkok(text)) return false;

  return (
    containsAny(text, PROVINCES) ||
    containsAny(text, OUTSIDE_MARKERS) ||
    AMBIGUOUS_PROVINCES.some((province) => text.includes(`จังหวัด${province}`))
  );
}
