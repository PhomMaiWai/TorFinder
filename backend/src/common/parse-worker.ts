import { BadRequestException, HttpException, PayloadTooLargeException } from "@nestjs/common";
import { join } from "node:path";
import { Worker } from "node:worker_threads";

/**
 * ASVS 15.2.5: the code that parses untrusted bytes runs in a separate worker
 * thread with its own memory limits and a deadline, not in the thread that
 * serves every other request. What runs there (parse-worker.task.ts):
 *
 * - cleaning uploads: checking and stripping images, PDFs and Word files
 *   (image-uploads.ts, document-metadata.ts);
 * - inflating one entry of a zip bundle from a procurement portal (zip.ts).
 *
 * A file built to exhaust memory or loop for a long time costs one worker,
 * which is killed (the out-of-memory error, or terminate() at the deadline),
 * and the request gets a 4xx; the server and its other requests carry on.
 * A worker is started per task: uploads and bundle downloads are rare and
 * rate-limited, and a fresh worker can't carry state from one file to the next.
 */

export type ParseTask =
  | { kind: "cleanUpload"; buffer: Buffer; contentType: string }
  | { kind: "inflateRaw"; data: Buffer; maxOutputLength: number };

/** What a worker answers: the bytes, or the HTTP error its parser threw. */
export type ParseOutcome = { ok: true; buffer: Uint8Array } | { ok: false; status: number; message: string };

/** Per task. A 5 MB upload or a 40 MB entry takes well under a second. */
export const PARSE_TIMEOUT_MS = 15_000;

/** The worker's own V8 heap; inflated output is also capped by maxOutputLength. */
const RESOURCE_LIMITS = { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 };

const TOO_SLOW = "ประมวลผลไฟล์นี้นานเกินไป กรุณาตรวจสอบไฟล์แล้วลองอีกครั้ง";
const TOO_BIG = "ไฟล์นี้ใช้หน่วยความจำมากเกินกว่าจะประมวลผลได้";
const BROKEN = "อ่านไฟล์นี้ไม่ได้";

const TASK_FILE = join(__dirname, "parse-worker.task.js");

export function runParseTask(task: ParseTask): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(TASK_FILE, { workerData: task, resourceLimits: RESOURCE_LIMITS });
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      void worker.terminate();
      fn();
    };
    const deadline = setTimeout(() => settle(() => reject(new BadRequestException(TOO_SLOW))), PARSE_TIMEOUT_MS);

    worker.once("message", (outcome: ParseOutcome) =>
      settle(() =>
        outcome.ok
          ? resolve(Buffer.from(outcome.buffer.buffer, outcome.buffer.byteOffset, outcome.buffer.byteLength))
          : reject(new HttpException(outcome.message, outcome.status)),
      ),
    );
    worker.once("error", (error: Error & { code?: string }) =>
      settle(() =>
        reject(error.code === "ERR_WORKER_OUT_OF_MEMORY" ? new PayloadTooLargeException(TOO_BIG) : new BadRequestException(BROKEN)),
      ),
    );
    worker.once("exit", () => settle(() => reject(new BadRequestException(BROKEN))));
  });
}

/** cleanUpload (image-uploads.ts), in a worker. */
export const cleanUploadIsolated = (buffer: Buffer, contentType: string) =>
  runParseTask({ kind: "cleanUpload", buffer, contentType });
