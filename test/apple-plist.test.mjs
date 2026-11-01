import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PlistError, bytesToBase64, isBinaryPlist, isDict, parseBinaryPlist, parsePlist, parseXmlPlist, plistToText } from "../src/apple-plist.mjs";

// The independent second opinion is macOS's own plutil: it converts our XML fixtures to binary1 (so the binary parser
// reads files Apple's code wrote) and to JSON (so the parsed values are compared with what Apple's code read).
// Tests that need plutil are skipped on machines without it.

const hasPlutil = (() => {
  try {
    execFileSync("plutil", ["-help"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "apple-plist-test-"));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function plutil(args, input) {
  return execFileSync("plutil", args, { input, maxBuffer: 64 * 1024 * 1024 });
}

function toBinary(xml, name) {
  const p = path.join(tmp, `${name}.plist`);
  fs.writeFileSync(p, xml);
  plutil(["-convert", "binary1", p]);
  return new Uint8Array(fs.readFileSync(p));
}

const wrap = (body) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
${body}
</plist>
`;

// Values JSON can hold, so plutil -convert json can be the reference. Long and non-ASCII strings make plutil write
// 0xF-length markers and UTF-16 strings; 300 keys push object references past one byte.
const manyKeys = Array.from({ length: 300 }, (_, i) => `<key>k${String(i).padStart(3, "0")}</key><integer>${i * 1000}</integer>`).join("");
const JSON_SAFE = wrap(`<dict>
  <key>ascii</key><string>hello</string>
  <key>long</key><string>a string that is clearly longer than fifteen characters</string>
  <key>entities</key><string>&lt;tag&gt; &amp; &quot;quoted&quot; &apos;single&apos; &#169; &#x4E2D;</string>
  <key>chinese</key><string>中文说明：用于视频通话</string>
  <key>emoji</key><string>camera 📷 ok</string>
  <key>empty</key><string></string>
  <key>emptySelf</key><string/>
  <key>neg</key><integer>-42</integer>
  <key>zero</key><integer>0</integer>
  <key>big</key><integer>4294967296</integer>
  <key>i64</key><integer>9007199254740991</integer>
  <key>real</key><real>3.25</real>
  <key>yes</key><true/>
  <key>no</key><false/>
  <key>arr</key><array><string>one</string><integer>2</integer><array/><dict/></array>
  <key>nested</key><dict><key>inner</key><dict><key>deep</key><array><true/></array></dict></dict>
  <key>many</key><dict>${manyKeys}</dict>
  <!-- a comment between keys -->
  <key>com.apple.developer.team-identifier</key><string>ABCDE12345</string>
</dict>`);

test("XML parser matches plutil -convert json on every JSON-representable type", { skip: !hasPlutil }, () => {
  const p = path.join(tmp, "safe.plist");
  fs.writeFileSync(p, JSON_SAFE);
  const reference = JSON.parse(plutil(["-convert", "json", "-o", "-", p]).toString("utf8"));
  const ours = parseXmlPlist(JSON_SAFE);
  assert.deepEqual(JSON.parse(JSON.stringify(ours)), reference);
  // spot checks worked out by hand
  assert.equal(ours.entities, `<tag> & "quoted" 'single' © 中`);
  assert.equal(ours.big, 4294967296);
  assert.equal(Object.keys(ours.many).length, 300);
});

test("binary parser reads plutil's binary1 output identically to plutil's own JSON", { skip: !hasPlutil }, () => {
  const bin = toBinary(JSON_SAFE, "safe-bin");
  assert.equal(isBinaryPlist(bin), true);
  const reference = JSON.parse(plutil(["-convert", "json", "-o", "-", "-"], bin).toString("utf8"));
  const ours = parseBinaryPlist(bin);
  assert.deepEqual(JSON.parse(JSON.stringify(ours)), reference);
  const r = parsePlist(bin);
  assert.equal(r.ok && r.format, "binary");
});

test("dates and data in both formats match plutil -extract raw", { skip: !hasPlutil }, () => {
  const xml = wrap(`<dict>
  <key>created</key><date>2026-03-07T17:50:56Z</date>
  <key>old</key><date>1999-12-31T23:59:59Z</date>
  <key>blob</key><data>
  MIIBCgKCAQEA
  AAECAwQFBgc=
  </data>
  <key>bigblob</key><data>${Buffer.alloc(70000, 7).toString("base64")}</data>
  <key>emptyData</key><data></data>
  <key>neg64</key><integer>-9000000000</integer>
  <key>half</key><real>-0.5</real>
</dict>`);
  const bin = toBinary(xml, "dates");
  const p = path.join(tmp, "dates-xml.plist");
  fs.writeFileSync(p, xml);
  const raw = (key) => plutil(["-extract", key, "raw", "-o", "-", p]).toString("utf8").trim();
  for (const v of [parseXmlPlist(xml), parseBinaryPlist(bin)]) {
    assert.equal(v.created.toISOString().replace(".000Z", "Z"), raw("created"));
    assert.equal(v.old.toISOString().replace(".000Z", "Z"), raw("old"));
    assert.equal(bytesToBase64(v.blob), raw("blob"));
    assert.equal(bytesToBase64(v.bigblob), raw("bigblob"));
    assert.equal(v.bigblob.length, 70000);
    assert.equal(v.emptyData.length, 0);
    assert.equal(String(v.neg64), raw("neg64"));
    assert.equal(v.half, -0.5);
  }
});

test("a hand-assembled bplist00 decodes to the values worked out by hand", () => {
  // {"a": 1, "b": [true, "xy"]}: objects 0 dict, 1 "a", 2 "b", 3 int 1, 4 array, 5 true, 6 "xy"
  const objects = [
    [0xd2, 1, 2, 3, 4], // dict of 2: keys 1,2 values 3,4
    [0x51, 0x61], // "a"
    [0x51, 0x62], // "b"
    [0x10, 0x01], // int 1
    [0xa2, 5, 6], // array of 2
    [0x09], // true
    [0x52, 0x78, 0x79], // "xy"
  ];
  const header = [...Buffer.from("bplist00")];
  const body = [];
  const offsets = [];
  for (const o of objects) { offsets.push(header.length + body.length); body.push(...o); }
  const tableOffset = header.length + body.length;
  const trailer = [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, objects.length, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, tableOffset];
  const bytes = new Uint8Array([...header, ...body, ...offsets, ...trailer]);
  assert.deepEqual(parseBinaryPlist(bytes), { a: 1, b: [true, "xy"] });
});

test("a self-referencing bplist array is refused instead of looping", () => {
  // object 0 at offset 8: array of 1 pointing at object 0
  const bytes = new Uint8Array([...Buffer.from("bplist00"), 0xa1, 0x00, 8, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10]);
  assert.throws(() => parseBinaryPlist(bytes), PlistError);
});

test("truncated and corrupt inputs fail cleanly", { skip: !hasPlutil }, () => {
  const bin = toBinary(JSON_SAFE, "trunc");
  for (const cut of [10, 40, bin.length - 33, bin.length - 1]) {
    const r = parsePlist(bin.subarray(0, cut));
    assert.equal(r.ok, false, `cut ${cut}`);
  }
  const broken = new Uint8Array(bin);
  broken[broken.length - 32 + 7] = 0; // object reference size 0
  assert.equal(parsePlist(broken).ok, false);
  assert.equal(parsePlist("<plist><dict><key>a</key></dict></plist>").ok, false);
  assert.equal(parsePlist("<plist><dict><string>x</string></dict></plist>").ok, false);
  assert.equal(parsePlist("<plist><integer>12x</integer></plist>").ok, false);
  assert.equal(parsePlist("<plist><dict><key>a</key><string>unclosed</dict></plist>").ok, false);
  assert.equal(parsePlist("not a plist at all").ok, false);
  assert.equal(parsePlist(new Uint8Array(0)).ok, false);
});

test("a key named __proto__ stays an ordinary key", () => {
  const v = parseXmlPlist(wrap("<dict><key>__proto__</key><dict><key>polluted</key><true/></dict></dict>"));
  assert.equal(Object.keys(v).length, 1);
  assert.equal(Object.getPrototypeOf(v), Object.prototype);
  assert.equal({}.polluted, undefined);
  assert.equal(v["__proto__"].polluted, true);
});

test("XML without the <plist> wrapper and with CDATA, UTF-8 bytes and a BOM", () => {
  assert.deepEqual(parseXmlPlist("<dict><key>a</key><string><![CDATA[<b> & c]]></string></dict>"), { a: "<b> & c" });
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...Buffer.from(wrap("<array><string>é</string></array>"))]);
  const r = parsePlist(bytes);
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.value, ["é"]);
});

test("isDict and plistToText", () => {
  assert.equal(isDict({}), true);
  assert.equal(isDict([]), false);
  assert.equal(isDict(new Uint8Array(1)), false);
  assert.equal(isDict(new Date(0)), false);
  assert.equal(isDict({ $uid: 3 }), false);
  assert.equal(plistToText(new Uint8Array(5)), "<data 5 bytes>");
  assert.equal(plistToText(new Date(Date.UTC(2026, 2, 7, 17, 50, 56))), "2026-03-07T17:50:56Z");
  assert.equal(plistToText({ a: [true, "x"] }), '{\n  "a": [\n    true,\n    "x"\n  ]\n}');
});
