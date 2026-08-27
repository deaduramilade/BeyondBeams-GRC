const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const patterns = [
  ["private key", /-----BEGIN (?:RSA|OPENSSH|EC|DSA|PRIVATE) KEY-----/],
  ["OpenAI-style API key", /\bsk-[A-Za-z0-9]{20,}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["credentialed PostgreSQL URL", /postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/i],
];
const allowed = new Set([".ts", ".tsx", ".js", ".cjs", ".mjs", ".json", ".yml", ".yaml", ".md", ".sql"]);
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const findings = [];
for (const file of tracked) {
  if (path.basename(file).startsWith(".env") || !allowed.has(path.extname(file).toLowerCase())) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [label, pattern] of patterns) {
      if (pattern.test(line)) findings.push(`${file}:${index + 1}: ${label}`);
    }
  });
}
if (findings.length) {
  console.error("Potential secrets found in tracked files:");
  findings.forEach((finding) => console.error(finding));
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed for ${tracked.length} tracked files.`);
}
