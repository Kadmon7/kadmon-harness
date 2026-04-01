import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export default function globalTeardown(basePath?: string): void {
  const kadmonTmp = basePath ?? path.join(os.tmpdir(), "kadmon");
  if (!fs.existsSync(kadmonTmp)) return;

  for (const entry of fs.readdirSync(kadmonTmp)) {
    if (entry.startsWith("test-")) {
      try {
        const dirPath = path.join(kadmonTmp, entry);
        const stat = fs.statSync(dirPath);
        if (stat.isDirectory()) {
          fs.rmSync(dirPath, { recursive: true, force: true });
        }
      } catch {
        /* skip unreadable entries */
      }
    }
  }
}
