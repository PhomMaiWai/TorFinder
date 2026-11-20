// Scans an ordinary PDF and the standard EICAR test file (harmless; every
// scanner flags it) with the backend's own scanner, inside the backend
// container. Used by the `hardening` shot in capture-screenshots.js:
//   docker compose ... exec -T backend sh -c '. /run/app-secrets/app.env ... && node -' < virus-probe.js
const { scanForViruses } = require("/app/dist/common/virus-scan.js");

// Built from parts, so this file itself isn't flagged by a scanner on disk.
const eicar = Buffer.from(["X5O!P%@AP[4\\PZX54(P^)7CC)7}", "$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join(""));

async function run(label, data) {
  try {
    await scanForViruses(data, { source: "evidence" });
    console.log(`${label} -> passed the scan`);
  } catch (error) {
    console.log(`${label} -> ${error.getStatus()} refused: ${error.message}`);
  }
}

(async () => {
  await run("an ordinary PDF", Buffer.from("%PDF-1.7 an ordinary document"));
  await run("the EICAR test file", eicar);
})();
