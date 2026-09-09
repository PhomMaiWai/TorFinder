export const TAX_ID_LENGTH = 13;
export const PHONE_LENGTH = 10;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** The rule the form enforces: a tax id is 13 digits. */
export function isValidTaxId(value: string): boolean {
  return digitsOnly(value).length === TAX_ID_LENGTH;
}

/**
 * Thai tax ids also carry a mod-11 check digit. It catches typos, but plenty of
 * legitimately-entered numbers are rejected by it, so this only ever warns —
 * `isValidTaxId` is what decides whether the form can be submitted.
 */
export function hasValidTaxIdChecksum(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length !== TAX_ID_LENGTH) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (TAX_ID_LENGTH - i);
  }
  return (11 - (sum % 11)) % 10 === Number(digits[12]);
}

/** Thai mobile and landline numbers are 10 digits starting with 0. */
export function isValidPhone(value: string): boolean {
  const digits = digitsOnly(value);
  return digits.length === PHONE_LENGTH && digits.startsWith("0");
}

/** 08X-XXX-XXXX while typing, so the field reads the way people write it. */
export function formatPhone(value: string): string {
  const digits = digitsOnly(value).slice(0, PHONE_LENGTH);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)];
  return parts.filter(Boolean).join("-");
}

export function formatTaxId(value: string): string {
  return digitsOnly(value).slice(0, TAX_ID_LENGTH);
}
