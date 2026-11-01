#!/usr/bin/env node
// info-plist-check <Info.plist | -> [--platform ios|mac] [--lang en|zh] [--json]
// Exit codes: 0 no errors, 1 the file has at least one error (or is not a valid plist), 2 usage or read problem.

import { readFileSync } from "node:fs";
import { checkInput, specsCheckedOn } from "../src/info-plist-checker.mjs";
import { messages, formatIssue, fill } from "../src/messages.mjs";

/** Values come from the file being checked: show control characters as \\xNN so they can't drive the terminal. */
const safe = (s) => String(s).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`);

const USAGE = `Usage: info-plist-check <Info.plist | -> [options]

Checks an iOS or Mac app's Info.plist (XML or binary) against App Store Connect upload rules.
Pass - to read the file from stdin.

Options:
  --platform ios|mac  Run the checks for this platform (default: read it from the file)
  --lang en|zh        Message language (default: en)
  --json              Print machine-readable JSON
  -h, --help          Show this help
  -v, --version       Show the version

Exit codes: 0 no errors, 1 errors found or not a valid plist, 2 usage or read problem.
Rules checked on ${specsCheckedOn}.`;

function usageError(/** @type {string} */ msg) {
  process.stderr.write(`info-plist-check: ${msg}\n\n${USAGE}\n`);
  process.exit(2);
}

/** @type {{ file?: string, platform?: "ios" | "mac", lang: "en" | "zh", json: boolean }} */
const opts = { lang: "en", json: false };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const [flag, inline] = a.startsWith("--") && a.includes("=") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, undefined];
  const value = () => {
    const v = inline ?? args[++i];
    if (v === undefined) usageError(`${flag} needs a value`);
    return /** @type {string} */ (v);
  };
  if (flag === "-h" || flag === "--help") {
    process.stdout.write(USAGE + "\n");
    process.exit(0);
  } else if (flag === "-v" || flag === "--version") {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    process.stdout.write(pkg.version + "\n");
    process.exit(0);
  } else if (flag === "--json") opts.json = true;
  else if (flag === "--lang") {
    const v = value();
    if (v !== "en" && v !== "zh") usageError(`--lang must be en or zh, not "${v}"`);
    opts.lang = /** @type {"en" | "zh"} */ (v);
  } else if (flag === "--platform") {
    const v = value().toLowerCase();
    if (v === "ios") opts.platform = "ios";
    else if (v === "mac" || v === "macos") opts.platform = "mac";
    else usageError(`--platform must be ios or mac, not "${v}"`);
  } else if (a !== "-" && a.startsWith("-")) usageError(`unknown option ${a}`);
  else if (opts.file !== undefined) usageError("give one Info.plist at a time");
  else opts.file = a;
}
if (opts.file === undefined) usageError("no Info.plist given");

const file = /** @type {string} */ (opts.file);
const copy = messages[opts.lang];
let bytes;
try {
  bytes = new Uint8Array(readFileSync(file === "-" ? 0 : file));
} catch (e) {
  process.stderr.write(fill(copy.readFailed, { file, detail: /** @type {Error} */ (e).message }) + "\n");
  process.exit(2);
}

const result = checkInput(bytes, { platform: opts.platform });
const name = file === "-" ? "stdin" : file;

if (!result.ok) {
  // checkInput with bytes only fails to parse; an empty file is reported by the parser too.
  const detail = "detail" in result ? result.detail : result.error;
  if (opts.json) process.stdout.write(JSON.stringify({ file: name, ok: false, error: result.error, detail, specsCheckedOn }, null, 2) + "\n");
  else process.stderr.write(`${name}: ${fill(copy.parseError, { detail })}\n`);
  process.exitCode = 1;
} else {
  report(result);
}

/** Prints the result and sets the exit code. Uses exitCode, not exit(), so piped output is never cut short. */
function report(/** @type {Extract<ReturnType<typeof checkInput>, { ok: true }>} */ result) {
  const issues = result.issues.map((i) => ({ ...i, ...formatIssue(i, opts.lang) }));
  const count = (/** @type {string} */ s) => issues.filter((i) => i.severity === s).length;
  const counts = { error: count("error"), warning: count("warning"), info: count("info") };

  if (opts.json) {
    const out = {
      file: name, ok: true, format: result.format, kind: result.kind, platform: result.platform ?? null,
      extension: result.extension, sdk: result.sdk ?? null, specsCheckedOn, counts,
      issues: issues.map(({ severity, code, key, value, expected, n, message, link }) => ({ severity, code, key, value, expected, n, message, link })),
    };
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  } else {
    const kind = result.kind === "built" ? copy.kindBuilt : copy.kindProject;
    const platform = result.platform === "ios" ? copy.ios : result.platform === "mac" ? copy.mac : copy.platformUnknownShort;
    const sdk = result.sdk !== undefined ? fill(copy.sdkPart, { sdk: result.sdk }) : "";
    const lines = [name, `${fill(copy.readAs, { kind, platform, sdk })} (${result.format} plist)`];
    if (result.extension) lines.push(copy.extensionNote);
    if (!counts.error && !counts.warning) lines.push("", copy.noIssues);
    for (const [severity, title] of /** @type {const} */ ([["error", copy.errorsTitle], ["warning", copy.warningsTitle], ["info", copy.infoTitle]])) {
      const group = issues.filter((i) => i.severity === severity);
      if (!group.length) continue;
      lines.push("", `${title} (${group.length})`);
      for (const i of group) {
        lines.push(`  - [${i.code}] ${i.message}`);
        if (i.link) lines.push(`    ${i.link}`);
      }
    }
    lines.push("", fill(copy.summary, { errors: counts.error, warnings: counts.warning, info: counts.info }), fill(copy.specsNote, { date: specsCheckedOn }));
    process.stdout.write(lines.map(safe).join("\n") + "\n");
  }
  process.exitCode = counts.error ? 1 : 0;
}
