import { registerDecorator, ValidationOptions } from "class-validator";

const TAX_ID_LENGTH = 13;
const PHONE_LENGTH = 10;

function digitsOnly(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

/**
 * Only the length is enforced. Thai tax ids also carry a mod-11 check digit, but
 * rejecting on it turns away numbers people enter correctly, so the form treats
 * that as a warning instead.
 */
export function isValidTaxId(value: unknown): boolean {
  return digitsOnly(value).length === TAX_ID_LENGTH;
}

export function isValidThaiPhone(value: unknown): boolean {
  const digits = digitsOnly(value);
  return digits.length === PHONE_LENGTH && digits.startsWith("0");
}

/**
 * The browser checks these too, but a request can skip the form entirely —
 * so the rules that decide whether a company is reachable live here as well.
 */
export function IsThaiTaxId(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: "isThaiTaxId",
      target: object.constructor,
      propertyName,
      options: {
        message: "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก",
        ...options,
      },
      validator: { validate: isValidTaxId },
    });
}

export function IsThaiPhone(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: "isThaiPhone",
      target: object.constructor,
      propertyName,
      options: { message: "เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก", ...options },
      validator: { validate: isValidThaiPhone },
    });
}
