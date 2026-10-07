// Fails when tracked files contain machine paths, private keys or tokens, or any value from the
// PRIVACY_DENYLIST environment variable (one pattern per line, kept as a CI secret so the real
// server address and private hosts never appear in this public repository).
// Usage: bun scripts/check-privacy.ts
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const GENERIC_PATTERNS: Array<[string, RegExp]> = [
  ["macOS home path", /\/Users\/(?!name\/|PC\/|<)[A-Za-z0-9_-]+\//],
  ["Linux home dotfiles", /\/home\/[a-z][a-z0-9_-]*\/\.(ssh|config|npm|codex)\//],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["GitHub token", /\b(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
  ["API key", /\bsk-[A-Za-z0-9]{32,}/],
  ["AWS key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}/]
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const denylist = String(process.env.PRIVACY_DENYLIST ?? "")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line, index): [string, RegExp] => [`denylist entry #${index + 1}`, new RegExp(escapeRegExp(line), "i")]);

const files = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" }).stdout.split("\0").filter(Boolean);
const findings: string[] = [];

for (const file of files) {
  if (file === "scripts/check-privacy.ts") continue;
  let text: string;
  try {
    const buffer = readFileSync(file);
    if (buffer.includes(0)) continue; // binary
    text = buffer.toString("utf8");
  } catch {
    continue;
  }
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    for (const [label, pattern] of [...GENERIC_PATTERNS, ...denylist]) {
      // Report the rule, never the matched value, so CI logs stay clean.
      if (pattern.test(line)) findings.push(`${file}:${index + 1}: ${label}`);
    }
  });
}

if (findings.length) {
  console.error(`Privacy check failed (${findings.length}):\n${findings.join("\n")}`);
  process.exit(1);
}
console.log(`Privacy check passed (${files.length} files, ${denylist.length} denylist entries).`);
