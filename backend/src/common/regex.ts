/** For building a Mongo $regex from literal text: a URL, or what someone typed. */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
