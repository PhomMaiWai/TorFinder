import { HttpException } from "@nestjs/common";
import { parentPort, workerData } from "node:worker_threads";
import { inflateRawSync } from "node:zlib";

import { cleanUpload } from "./image-uploads";
import type { ParseOutcome, ParseTask } from "./parse-worker";

/** The worker side of parse-worker.ts: run one task, answer once, exit. */
function run(task: ParseTask): Buffer {
  switch (task.kind) {
    case "cleanUpload":
      return cleanUpload(Buffer.from(task.buffer), task.contentType);
    case "inflateRaw":
      return inflateRawSync(Buffer.from(task.data), { maxOutputLength: task.maxOutputLength });
  }
}

let outcome: ParseOutcome;
try {
  const buffer = run(workerData as ParseTask);
  outcome = { ok: true, buffer };
} catch (error) {
  outcome =
    error instanceof HttpException
      ? { ok: false, status: error.getStatus(), message: String((error.getResponse() as { message?: unknown }).message ?? error.message) }
      : { ok: false, status: 400, message: "อ่านไฟล์นี้ไม่ได้" };
}
// Copied, not transferred: a small Buffer shares Node's allocation pool,
// which can't be handed to another thread.
parentPort?.postMessage(outcome);
