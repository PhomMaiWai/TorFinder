import { ServiceUnavailableException, UnprocessableEntityException } from "@nestjs/common";
import { connect } from "node:net";

import { env } from "../config/env";
import { logSecurityEvent } from "./security-log";

/** clamd reads a stream in chunks, each led by its length as 4 bytes; a zero length ends it. */
const CHUNK_BYTES = 64 * 1024;

/**
 * Sends a file to a ClamAV daemon (clamd) with its INSTREAM command and
 * returns its one-line answer, e.g. "stream: OK" or
 * "stream: Eicar-Test-Signature FOUND".
 */
function clamdVerdict(data: Buffer): Promise<string> {
  const { host, port, timeoutMs } = env.virusScan;
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    const reply: Buffer[] = [];
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error("clamd timed out")));
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < data.length; offset += CHUNK_BYTES) {
        const chunk = data.subarray(offset, offset + CHUNK_BYTES);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
    socket.on("data", (part) => reply.push(part));
    socket.on("error", reject);
    socket.on("close", () => resolve(Buffer.concat(reply).toString("utf8").replace(/\0/g, "").trim()));
  });
}

/**
 * ASVS 5.4.3: every file from outside — a company's upload, a document taken
 * from a procurement portal — is scanned before it is stored or served. A
 * file with a known signature is refused; so is any file while the scanner,
 * once configured, can't answer, because serving it unscanned would defeat
 * the point. With CLAMAV_HOST unset the file is refused while
 * VIRUS_SCAN_REQUIRED is on (the production default, docs/SECURITY.md G6) and
 * passed unscanned only when an operator has turned it off.
 */
export async function scanForViruses(data: Buffer, context: { source: string; userId?: string }): Promise<void> {
  if (!env.virusScan.host) {
    if (!env.virusScan.required) return;
    logSecurityEvent("file.unscanned", { outcome: "failure", userId: context.userId, reason: `${context.source}:scanner_not_configured` });
    throw new ServiceUnavailableException("ระบบตรวจไวรัสยังไม่พร้อม จึงยังรับไฟล์ไม่ได้ กรุณาติดต่อผู้ดูแลระบบ");
  }
  let verdict: string;
  try {
    verdict = await clamdVerdict(data);
  } catch {
    verdict = "";
  }
  if (verdict.endsWith(" OK")) return;
  if (verdict.endsWith(" FOUND")) {
    logSecurityEvent("file.malware", {
      outcome: "failure",
      userId: context.userId,
      reason: `${context.source}:${verdict.replace(/^stream: /, "").replace(/ FOUND$/, "")}`,
    });
    throw new UnprocessableEntityException("ไฟล์นี้มีมัลแวร์ที่รู้จัก ระบบจึงไม่รับหรือแสดงไฟล์นี้");
  }
  throw new ServiceUnavailableException("ตรวจไวรัสในไฟล์ไม่ได้ในขณะนี้ กรุณาลองใหม่ภายหลัง");
}
