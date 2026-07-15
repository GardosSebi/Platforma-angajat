import { execSync } from "node:child_process";

const port = process.argv[2] ?? "5173";

function freePortOnWindows() {
  try {
    const output = execSync(`netstat -ano | findstr ":${port}" | findstr "LISTENING"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });

    const pids = [
      ...new Set(
        output
          .split(/\r?\n/)
          .map((line) => line.trim().split(/\s+/).at(-1))
          .filter((pid) => pid && pid !== "0")
      )
    ];

    for (const pid of pids) {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      console.log(`[web] Freed port ${port} (stopped PID ${pid})`);
    }
  } catch {
    // Port is already free.
  }
}

if (process.platform === "win32") {
  freePortOnWindows();
}
