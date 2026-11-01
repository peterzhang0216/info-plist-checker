import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// broken-ios-built.plist is written by hand with one mistake per check; the other fixtures are real files, renamed.
const BIN = fileURLToPath(new URL("../bin/info-plist-check.mjs", import.meta.url));
const fixture = (/** @type {string} */ name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const run = (/** @type {string[]} */ args, /** @type {Buffer | string | undefined} */ input = undefined) =>
  spawnSync(process.execPath, [BIN, ...args], { input, encoding: "utf8" });

test("binary iOS build: exit 0, read as a built app, the iPad note with its Apple link", () => {
  const r = run([fixture("notebook-ios-built.plist")]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Read as: built app, iOS \/ iPadOS, built with SDK 26 \(binary plist\)/);
  assert.match(r.stdout, /Nothing to fix\./);
  assert.match(r.stdout, /\[ipadOrientations\] On iPad the app leaves out/);
  assert.match(r.stdout, /https:\/\/developer\.apple\.com\/documentation\/technotes\/tn3192-/);
  assert.match(r.stdout, /Errors: 0, warnings: 0, notes: 1/);
});

test("broken build: exit 1, errors grouped before warnings and notes", () => {
  const r = run([fixture("broken-ios-built.plist")]);
  assert.equal(r.status, 1);
  const errors = r.stdout.indexOf("Will be refused or is malformed (6)");
  const warnings = r.stdout.indexOf("Fix or check before you submit (1)");
  const info = r.stdout.indexOf("Worth knowing (1)");
  assert.ok(errors > 0 && errors < warnings && warnings < info, r.stdout);
  for (const code of ["unexpandedVariable", "buildFormat", "bundleIdChars", "purposeEmpty", "purposeKeyCase", "noLaunchScreen", "badBackgroundMode"]) {
    assert.match(r.stdout, new RegExp(`\\[${code}\\]`));
  }
});

test("--json: machine-readable result with messages and links", () => {
  const r = run([fixture("broken-ios-built.plist"), "--json"]);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.format, "xml");
  assert.equal(out.kind, "built");
  assert.equal(out.platform, "ios");
  assert.equal(out.sdk, 27);
  assert.deepEqual(out.counts, { error: 6, warning: 1, info: 1 });
  const id = out.issues.find((/** @type {{ code: string }} */ i) => i.code === "bundleIdChars");
  assert.equal(id.severity, "error");
  assert.equal(id.value, "com.example.note_book");
  assert.equal(id.link, "https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleidentifier");
  assert.match(id.message, /may contain only letters/);
});

test("--lang zh and --platform, reading from stdin with -", () => {
  const r = run(["-", "--lang", "zh", "--platform", "ios"], readFileSync(fixture("notebook-mac-built.plist")));
  const out = r.stdout;
  // A Mac build checked as iOS: built with SDK 27 and no launch screen, so an error.
  assert.equal(r.status, 1, r.stderr);
  assert.match(out, /^stdin\n/);
  assert.match(out, /识别为：构建好的应用，iOS \/ iPadOS/);
  assert.match(out, /\[platformMismatch\] 这个文件看起来是 macOS 应用/);
  assert.match(out, /\[noLaunchScreen\] 没有启动屏/);
  const json = JSON.parse(run(["-", "--json", "--platform=macos"], readFileSync(fixture("notebook-ios-project.plist"))).stdout);
  assert.equal(json.platform, "mac");
  assert.equal(json.kind, "project");
});

test("not a plist: exit 1; usage and read problems: exit 2", () => {
  const bad = run(["-"], "<plist><dict><key>a</key></dict></plist>");
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /not a valid property list/);
  assert.equal(JSON.parse(run(["-", "--json"], "not a plist").stdout).ok, false);
  assert.equal(run([]).status, 2);
  assert.equal(run(["--lang", "fr", fixture("notebook-mac-built.plist")]).status, 2);
  assert.equal(run(["--platform", "tvos", fixture("notebook-mac-built.plist")]).status, 2);
  assert.equal(run(["--nope", fixture("notebook-mac-built.plist")]).status, 2);
  assert.equal(run([fixture("does-not-exist.plist")]).status, 2);
  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: info-plist-check/);
});
