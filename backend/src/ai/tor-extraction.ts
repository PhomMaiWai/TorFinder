import { TorExtraction } from "./ai.types";

/** Longest field the UI will ever show; anything beyond is the model rambling. */
const MAX_TEXT = 5_000;
const MAX_LIST_ITEMS = 30;

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_TEXT) : null;
}

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item))
    .filter((item): item is string => item !== null)
    .slice(0, MAX_LIST_ITEMS);
}

/** ISO date only, and only one the calendar actually has. */
function isoDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : raw;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Second gate after Vertex's own schema check. The schema guarantees the shape,
 * not the content: a model can still answer with an empty string, a 90 that
 * meant 0.9, or a Buddhist year it forgot to convert. Nothing reaches the
 * database until it has passed through here.
 */
export function parseExtraction(raw: unknown): TorExtraction {
  const value = (raw ?? {}) as Record<string, unknown>;

  const confidence = typeof value.confidence === "number" ? value.confidence : 0;

  return {
    scope: text(value.scope),
    qualifications: list(value.qualifications),
    deliverables: list(value.deliverables),
    budgetAmount: positiveNumber(value.budgetAmount),
    contractPeriod: text(value.contractPeriod),
    // A year past 2100 is a Buddhist year that escaped conversion — dropping it
    // is better than showing a deadline 543 years out.
    deadline: dropImplausibleYear(isoDate(value.deadline)),
    // Models sometimes answer 90 for "90%"; clamped so it stays comparable.
    confidence: Math.min(1, Math.max(0, confidence > 1 ? confidence / 100 : confidence)),
  };
}

function dropImplausibleYear(date: string | null): string | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return year >= 2000 && year <= 2100 ? date : null;
}

/** An extraction with nothing usable in it isn't worth storing. */
export function isUseful(extraction: TorExtraction): boolean {
  return Boolean(
    extraction.scope ||
      extraction.qualifications.length ||
      extraction.deliverables.length ||
      extraction.budgetAmount,
  );
}
