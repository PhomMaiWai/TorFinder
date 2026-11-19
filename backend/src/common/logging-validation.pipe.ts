import { HttpException, ValidationError, ValidationPipe } from "@nestjs/common";

/** At most this many field names per event: enough to see what was probed, too few to flood a log line. */
const MAX_FIELDS = 10;

/** The rejected request's field names (never their values), nested ones as `parent.child`. */
function fieldNames(errors: ValidationError[], parent = ""): string[] {
  return errors.flatMap((error) => {
    const name = parent ? `${parent}.${error.property}` : error.property;
    return error.children?.length ? fieldNames(error.children, name) : [name];
  });
}

/** Marks a validation failure so AllExceptionsFilter can log it as a security event. */
export type RejectedInput = HttpException & { rejectedFields: string[] };

export const isRejectedInput = (exception: unknown): exception is RejectedInput =>
  exception instanceof HttpException && Array.isArray((exception as Partial<RejectedInput>).rejectedFields);

/**
 * The global ValidationPipe, unchanged for the client (same 400 body), but the
 * failure carries the names of the fields that were refused. AllExceptionsFilter
 * logs it as `input.rejected` (ASVS 16.3.3: attempts to get past input
 * validation are logged, not only rate limits and lockouts).
 */
export class LoggingValidationPipe extends ValidationPipe {
  createExceptionFactory() {
    const build = super.createExceptionFactory();
    return (errors: ValidationError[] = []) => {
      const exception = build(errors) as HttpException;
      return Object.assign(exception, { rejectedFields: fieldNames(errors).slice(0, MAX_FIELDS) });
    };
  }
}
