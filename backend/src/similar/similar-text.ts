/**
 * The text side of "find similar": what of an announcement is compared, and a
 * keyword ranking that needs no model. The keyword ranking is what answers when
 * Vertex AI is off, and it is also where the "shared words" shown next to each
 * result come from, whichever method ranked it.
 *
 * Pure functions only, so they are tested without a database or a model.
 */

import { SIMILAR } from "./similar.constants";

/** The fields of a TOR this module reads. */
export type SimilarSource = {
  title: string;
  summary?: string;
  tags?: string[];
  procurementType?: string;
  goodsCategory?: string;
  extraction?: { scope?: string | null; objectives?: string[] | null } | null;
};

/**
 * What the work is, in the order that says it best: the title names the
 * system, the extracted scope describes it, the summary and tags fill in.
 * The agency is deliberately left out — the reader wants the same kind of work
 * from other departments, and an agency name shared by every record from one
 * office would outweigh the work itself.
 */
export function torText(tor: SimilarSource): string {
  const parts = [
    tor.title,
    tor.extraction?.scope ?? "",
    ...(tor.extraction?.objectives ?? []).slice(0, 5),
    tor.summary ?? "",
    (tor.tags ?? []).join(" "),
    tor.procurementType ?? "",
    tor.goodsCategory ?? "",
  ];
  const text = parts
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return text.slice(0, SIMILAR.embedTextChars);
}

/**
 * Words every procurement notice repeats, which say nothing about what is
 * being bought. Thai grammar words are here too: the segmenter returns them as
 * words of their own.
 */
const STOPWORDS = new Set([
  // Thai function words
  "การ", "ความ", "และ", "หรือ", "ของ", "ที่", "ใน", "ให้", "กับ", "เพื่อ", "โดย", "จาก", "แก่", "แห่ง",
  "ได้", "เป็น", "มี", "จะ", "ซึ่ง", "นี้", "นั้น", "ตาม", "ไป", "มา", "อยู่", "แล้ว", "ไม่", "ทั้ง",
  "สำหรับ", "ต่อ", "ด้วย", "ถึง", "อย่าง", "เช่น", "ทุก", "แต่", "หาก", "จึง", "ระหว่าง", "เกี่ยว", "กัน",
  "ราย", "ละ", "ฯ", "ณ", "ปี", "พ.ศ", "บาท", "จำนวน", "รายการ", "ทำ", "เคย", "งาน",
  // Procurement boilerplate
  "จ้าง", "ซื้อ", "จัด", "จัดซื้อ", "จัดจ้าง", "ประกวด", "ราคา", "อิเล็กทรอนิกส์", "วิธี", "ประกาศ",
  "จัดทำ", "บริษัท", "เฉพาะเจาะจง", "โครงการ", "สำนักงาน", "เขต", "กรุงเทพมหานคร", "กทม", "สำนัก", "กอง", "ฝ่าย",
  "e", "bidding", "the", "and", "of", "for", "to", "in", "a", "an", "with", "on",
]);

const WORDS = new Intl.Segmenter("th", { granularity: "word" });

const THAI = /[\u0E00-\u0E7F]/;

const isTerm = (word: string) => word.length >= 2 && !/^[\d.,/-]+$/.test(word) && !STOPWORDS.has(word);

/**
 * Terms, lower-cased, without stopwords, numbers or single characters. Thai is
 * written without spaces, so splitting on whitespace would make a whole
 * sentence one "word"; the ICU segmenter Node ships knows Thai word breaks.
 *
 * It breaks Thai compounds apart, though — "บทเรียน" comes back as "บท" +
 * "เรียน", "อีเลิร์นนิง" as three fragments — and the compound is what
 * carries the meaning. So each pair of neighbouring words is a term too:
 * "บทเรียน" is rare and telling where "เรียน" alone is everywhere.
 */
export function tokenize(text: string): string[] {
  const words = [...WORDS.segment(text.toLowerCase())]
    .filter(({ isWordLike }) => isWordLike)
    .map(({ segment }) => segment.trim());

  const tokens: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (!isTerm(words[i])) continue;
    tokens.push(words[i]);
    // Pairs within one script only: "ระบบ lms" is a compound, "lms บท" is two phrases touching.
    const next = words[i + 1];
    if (next !== undefined && isTerm(next) && THAI.test(words[i]) === THAI.test(next)) {
      tokens.push(THAI.test(next) ? words[i] + next : `${words[i]} ${next}`);
    }
  }
  return tokens;
}

/** A sparse TF-IDF vector: term → weight, already scaled to unit length. */
export type TermVector = Map<string, number>;

/** How rare each term is across the documents, smoothed so no weight is zero or negative. */
export function inverseDocumentFrequency(documents: string[][]): Map<string, number> {
  const seenIn = new Map<string, number>();
  for (const tokens of documents) {
    for (const term of new Set(tokens)) seenIn.set(term, (seenIn.get(term) ?? 0) + 1);
  }
  const n = documents.length;
  const idf = new Map<string, number>();
  for (const [term, count] of seenIn) idf.set(term, Math.log((1 + n) / (1 + count)) + 1);
  return idf;
}

/**
 * Sub-linear term frequency (1 + log tf): a TOR that says "ระบบ" forty times
 * is not forty times more about systems. A term no document has gets the
 * highest weight a term can have, so a pasted word missing from the corpus
 * neither breaks the vector nor matches anything.
 */
export function termVector(tokens: string[], idf: Map<string, number>, unseenIdf: number): TermVector {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);

  const vector: TermVector = new Map();
  let norm = 0;
  for (const [term, count] of counts) {
    const weight = (1 + Math.log(count)) * (idf.get(term) ?? unseenIdf);
    vector.set(term, weight);
    norm += weight * weight;
  }
  norm = Math.sqrt(norm);
  if (norm > 0) for (const [term, weight] of vector) vector.set(term, weight / norm);
  return vector;
}

/** Cosine of two unit-length sparse vectors, with the terms that contributed most. */
export function sparseCosine(a: TermVector, b: TermVector): { score: number; shared: string[] } {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let score = 0;
  const contributions: [string, number][] = [];
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other === undefined) continue;
    score += weight * other;
    contributions.push([term, weight * other]);
  }
  contributions.sort((x, y) => y[1] - x[1]);

  // A word already inside a shared compound adds nothing to read: show
  // "บทเรียน", not "บทเรียน", "บท" and "เรียน".
  let shared: string[] = [];
  for (const [term] of contributions) {
    if (shared.some((picked) => picked.includes(term))) continue;
    const inside = shared.filter((picked) => term.includes(picked));
    if (inside.length > 0) {
      // The compound takes the place of the first word it contains.
      const at = shared.indexOf(inside[0]);
      shared = shared.filter((picked) => !inside.includes(picked));
      shared.splice(at, 0, term);
    } else if (shared.length < SIMILAR.maxSharedTerms) {
      shared.push(term);
    }
  }
  return { score, shared };
}

/** Cosine of two dense vectors (embeddings). 0 when either is empty or zero. */
export function denseCosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

export type KeywordScore = { score: number; shared: string[] };

/**
 * Every candidate's keyword similarity to the query, in candidate order. The
 * IDF is taken over the candidates themselves, so a word every Bangkok TOR
 * uses ("ระบบ", "พัฒนา") counts for little and a word only a few use
 * ("e-learning", "กล้องวงจรปิด") counts for a lot.
 */
export function keywordScores(query: string, candidates: string[]): KeywordScore[] {
  const documents = candidates.map(tokenize);
  const idf = inverseDocumentFrequency(documents);
  const unseenIdf = Math.log(1 + documents.length) + 1;
  const queryVector = termVector(tokenize(query), idf, unseenIdf);
  return documents.map((tokens) => sparseCosine(queryVector, termVector(tokens, idf, unseenIdf)));
}

/**
 * A 0-100 figure to show next to a result. Embedding cosines for related texts
 * sit high (0.7-0.9) and are shown as they are. TF-IDF cosines for texts that
 * are plainly about the same thing sit low (0.2-0.4), so they are spread out
 * with a square root — it keeps the order and reads closer to what a person
 * would call "how similar". Either way the figure is for comparing results of
 * one search, not an absolute measure.
 */
export function displayScore(score: number, method: "ai" | "keyword"): number {
  const clamped = Math.max(0, Math.min(1, score));
  return Math.round((method === "ai" ? clamped : Math.sqrt(clamped)) * 100);
}
