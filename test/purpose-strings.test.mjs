// Key names were checked against Apple's "Protected resources" page and each key's own page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { KEYS, KEY_INFO, MAX_BYTES, lintString } from "../src/purpose-strings.mjs";

const codes = (issues) => issues.map((i) => i.code);

test("Apple's six deprecated keys are marked, and each points to a current key", () => {
  const deprecated = KEYS.filter((k) => k.deprecated).map((k) => k.key).sort();
  // Counted by hand on Apple's Protected resources page (deprecated badge or deprecated platform list).
  assert.deepEqual(deprecated, [
    "NSBluetoothPeripheralUsageDescription", "NSCalendarsUsageDescription", "NSEnterpriseMCAMUsageDescription", "NSLocationAlwaysUsageDescription",
    "NSNearbyInteractionAllowOnceUsageDescription", "NSRemindersUsageDescription",
  ]);
  for (const k of KEYS) for (const r of k.replacedBy ?? []) assert.ok(KEY_INFO.has(r) && !KEY_INFO.get(r)?.deprecated, r);
  assert.equal(new Set(KEYS.map((k) => k.key)).size, KEYS.length);
});

test("string rules: empty, placeholder, short, coercive, vague, too long, build variable", () => {
  const k = "NSCameraUsageDescription";
  assert.deepEqual(codes(lintString(k, "   ")), ["empty"]);
  assert.deepEqual(codes(lintString(k, "TODO")), ["placeholder"]);
  assert.deepEqual(codes(lintString(k, "<#Camera usage#>")), ["placeholder"]);
  assert.deepEqual(codes(lintString(k, k)), ["placeholder"]);
  assert.deepEqual(codes(lintString(k, "待填")), ["placeholder"]);
  assert.deepEqual(codes(lintString(k, "Camera access.")), ["tooShort"]);
  assert.deepEqual(codes(lintString(k, "需要相机")), ["tooShort"]);
  assert.deepEqual(codes(lintString(k, "You must allow camera access or the scanner won't work at all.")), ["coercive"]);
  assert.deepEqual(codes(lintString(k, "Please allow camera access so we can scan your documents.")), ["coercive"]);
  assert.deepEqual(codes(lintString(k, "请允许访问相机，否则无法使用扫描功能。")), ["coercive"]);
  assert.deepEqual(codes(lintString(k, "This app needs access to your camera.")), ["vague"]);
  assert.deepEqual(codes(lintString(k, "We use your camera to provide a better experience.")), ["vague"]);
  assert.deepEqual(codes(lintString(k, "本应用需要访问您的相机权限。")), ["vague"]);
  // Apple: "shorter than 4,000 bytes". 3,999 bytes passes, 4,000 does not.
  const lead = "Scanner uses the camera so you can scan receipts ";
  assert.deepEqual(codes(lintString(k, lead + "x".repeat(MAX_BYTES - 1 - lead.length))), []);
  assert.deepEqual(codes(lintString(k, lead + "x".repeat(MAX_BYTES - lead.length))), ["tooLong"]);
  // 1,334 three-byte characters = 4,002 bytes: over Apple's limit although only 1,334 characters long.
  assert.deepEqual(codes(lintString(k, "扫".repeat(1334))), ["tooLong"]);
  assert.deepEqual(codes(lintString(k, "$(CAMERA_USAGE)")), ["buildVariable"]);
  assert.deepEqual(lintString(k, "Scanner uses the camera so you can scan receipts and keep them with your expenses."), []);
});
