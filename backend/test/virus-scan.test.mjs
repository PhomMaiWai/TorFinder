// ASVS 5.4.3: files from outside go through ClamAV's INSTREAM protocol before
// they are stored or served. A fake clamd on a local port stands in for the
// real one (docker-compose.hardening.yml runs that); logic-only, from dist.

import assert from "node:assert/strict";
import { createServer } from "node:net";
import { after, before, describe, it } from "node:test";

let answer = "stream: OK";
let received = Buffer.alloc(0);
const server = createServer((socket) => {
  const parts = [];
  socket.on("data", (part) => {
    parts.push(part);
    const all = Buffer.concat(parts);
    // The stream ends with a zero length after the command and the chunks.
    if (all.length >= 14 && all.subarray(-4).readUInt32BE() === 0) {
      received = all;
      if (answer === "hang up") socket.destroy();
      else socket.end(`${answer}\0`);
    }
  });
});

let scanForViruses;
before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.CLAMAV_HOST = "127.0.0.1";
  process.env.CLAMAV_PORT = String(server.address().port);
  ({ scanForViruses } = await import("../dist/common/virus-scan.js"));
});
after(() => server.close());

/** The file as clamd got it: the command, then length-prefixed chunks, then a zero length. */
function unframe(buffer) {
  assert.equal(buffer.subarray(0, 10).toString("latin1"), "zINSTREAM\0");
  const chunks = [];
  let offset = 10;
  for (;;) {
    const size = buffer.readUInt32BE(offset);
    offset += 4;
    if (size === 0) break;
    chunks.push(buffer.subarray(offset, offset + size));
    offset += size;
  }
  return Buffer.concat(chunks);
}

describe("virus scanning (ASVS 5.4.3)", () => {
  it("lets a clean file through, after sending all of it", async () => {
    answer = "stream: OK";
    const file = Buffer.from("%PDF-1.7 a clean document");
    await scanForViruses(file, { source: "test" });
    assert.deepEqual(unframe(received), file);
  });

  it("sends a large file in several chunks", async () => {
    answer = "stream: OK";
    const file = Buffer.alloc(200 * 1024, 7);
    await scanForViruses(file, { source: "test" });
    assert.deepEqual(unframe(received), file);
  });

  it("refuses a file with a known signature (422)", async () => {
    answer = "stream: Eicar-Test-Signature FOUND";
    await assert.rejects(scanForViruses(Buffer.from("X5O!P%@AP"), { source: "test" }), (error) => error.getStatus() === 422);
  });

  it("refuses the file when the scanner can't answer (503), rather than serving it unscanned", async () => {
    answer = "hang up";
    await assert.rejects(scanForViruses(Buffer.from("%PDF-1.7"), { source: "test" }), (error) => error.getStatus() === 503);
    answer = "INSTREAM size limit exceeded. ERROR";
    await assert.rejects(scanForViruses(Buffer.from("%PDF-1.7"), { source: "test" }), (error) => error.getStatus() === 503);
  });
});
