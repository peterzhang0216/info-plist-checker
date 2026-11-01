import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parsePlist } from "../src/apple-plist.mjs";
import { lintString } from "../src/purpose-strings.mjs";

const BIN = fileURLToPath(new URL("../bin/info-plist-check.mjs", import.meta.url));

/** A binary plist from raw object bytes (1-byte refs, 4-byte offsets, top object 0). */
function bplist(objs) {
  const body = [...Buffer.from("bplist00")];
  const offs = [];
  for (const o of objs) { offs.push(body.length); body.push(...o); }
  const tableOffset = body.length;
  for (const off of offs) body.push((off >>> 24) & 255, (off >>> 16) & 255, (off >>> 8) & 255, off & 255);
  const trailer = new Uint8Array(32);
  trailer[6] = 4;
  trailer[7] = 1;
  const dv = new DataView(trailer.buffer);
  dv.setBigUint64(8, BigInt(objs.length));
  dv.setBigUint64(16, 0n);
  dv.setBigUint64(24, BigInt(tableOffset));
  return new Uint8Array([...body, ...trailer]);
}

test("shared references cannot expand a tiny file into billions of objects", () => {
  // Object i is an array holding two references to object i + 1: 2^30 leaves from about 300 bytes.
  const objs = [];
  for (let i = 0; i < 30; i++) objs.push([0xa2, i + 1, i + 1]);
  objs.push([0x51, 0x78]);
  const file = bplist(objs);
  assert.ok(file.length < 400);
  const started = Date.now();
  const r = parsePlist(file);
  assert.equal(r.ok, false);
  assert.match(r.error, /too many objects/);
  assert.ok(Date.now() - started < 2000, "rejected quickly");
});

test("a shared string used a few times still parses", () => {
  // dict with two keys sharing one value object, the way plutil de-duplicates strings
  const objs = [[0xd2, 1, 2, 3, 3], [0x51, 0x61], [0x51, 0x62], [0x52, 0x6f, 0x6b]];
  const r = parsePlist(bplist(objs));
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { a: "ok", b: "ok" });
});

test("long purpose strings don't make the style checks slow", () => {
  const value = "Without this " + "a ".repeat(50_000) + "x";
  const started = Date.now();
  const issues = lintString("NSCameraUsageDescription", value);
  assert.ok(Date.now() - started < 1000, "checked quickly");
  assert.ok(issues.some((i) => i.code === "tooLong"));
});

test("the coercive check still finds a bounded phrase", () => {
  const issues = lintString("NSCameraUsageDescription", "Without this permission the scanner will not work at all.");
  assert.ok(issues.some((i) => i.code === "coercive"));
});

test("control characters from the file are printed escaped, not sent to the terminal", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>com.example.app</string>
<key>CFBundleVersion</key><string>1\u001b[31m</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
</dict></plist>`;
  const r = spawnSync(process.execPath, [BIN, "-"], { input: xml, encoding: "utf8" });
  assert.ok(!r.stdout.includes("\u001b"), "no raw ESC in output");
  assert.ok(r.stdout.includes("\\x1b"), "ESC shown as \\x1b");
});
