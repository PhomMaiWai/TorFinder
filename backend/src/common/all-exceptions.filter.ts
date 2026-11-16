import { randomUUID } from "node:crypto";

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Request, Response } from "express";

import { env } from "../config/env";

/**
 * Every error the API answers with (ASVS 16.5.1 / 16.5.2):
 * - an HttpException (400, 401, 404, 429…) keeps exactly the body Nest would
 *   send, because those messages are written for the user;
 * - anything else is a bug or an outage: the full error and stack go to the
 *   server log under a fresh errorId, and the client gets a generic message
 *   carrying only that id, never the stack, query or connection details.
 * 5xx answers are logged either way, so a portal outage shows up too.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Error");

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const errorId = randomUUID();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= 500) {
      const error = exception instanceof Error ? exception : new Error(String(exception));
      const record = {
        ts: new Date().toISOString(),
        errorId,
        status,
        method: request.method,
        path: request.path,
        name: error.name,
        message: error.message,
      };
      this.logger.error(env.isProduction ? record : JSON.stringify(record), error.stack);
    }

    // A streamed document already sent its headers: all that's left is to end it.
    if (response.headersSent) {
      response.destroy();
      return;
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      response.status(status).json(typeof body === "string" ? { statusCode: status, message: body } : body);
      return;
    }

    response.status(status).json({
      statusCode: status,
      message: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง",
      errorId,
    });
  }
}
