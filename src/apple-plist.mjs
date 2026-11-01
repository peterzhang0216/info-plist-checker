// Apple property lists (plists), parsed with no dependencies; runs in Node and in browsers. Two formats:
// - XML ("<?xml ... <plist>"): a small hand-written parser, so the same code runs without DOMParser.
// - Binary ("bplist00"): written from the format as described in Apple's CFBinaryPList.c comments: a header, the
//   objects, an offset table, and a 32-byte trailer that says how big the offsets and object references are.
// Values come back as plain JS: string, number (or BigInt when an integer does not fit a double), boolean, Date,
// Uint8Array (data), array, object (dict, keys set without touching the prototype), and { $uid: n } for keyed-archive
// UIDs (binary only). Nothing here throws to the caller of parsePlist(); the lower-level parsers throw PlistError.

export class PlistError extends Error {}

/** A <real> value, returned instead of a plain number when a parser is called with { typedReals: true }, so that
 * a converter can tell <real>2</real> from <integer>2</integer>. */
export class PlistReal {
  /** @param {number} value */
  constructor(value) {
    this.value = value;
  }
}

const MAX_DEPTH = 200;

/** A dict object whose keys never hit Object.prototype setters (a key named "__proto__" stays an ordinary key). */
function setKey(obj, key, value) {
  Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });
}

/* ------------------------------------------------------------------ XML */

const ENTITIES = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decodeEntities(s) {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[body] ?? m;
  });
}

function base64ToBytes(text) {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  const map = (c) => {
    if (c >= 65 && c <= 90) return c - 65;
    if (c >= 97 && c <= 122) return c - 71;
    if (c >= 48 && c <= 57) return c + 4;
    return c === 43 ? 62 : 63;
  };
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    acc = (acc << 6) | map(clean.charCodeAt(i));
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

/** Base64 of bytes (for showing data values and for tests). */
export function bytesToBase64(bytes) {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += abc[n >> 18] + abc[(n >> 12) & 63] + abc[(n >> 6) & 63] + abc[n & 63];
  }
  if (i < bytes.length) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8);
    out += abc[n >> 18] + abc[(n >> 12) & 63] + (i + 1 < bytes.length ? abc[(n >> 6) & 63] : "=") + "=";
  }
  return out;
}

function parseInteger(text) {
  const t = text.trim();
  if (!/^[+-]?(0x[0-9a-fA-F]+|\d+)$/.test(t)) throw new PlistError(`bad integer "${t}"`);
  const neg = t.startsWith("-");
  const body = t.replace(/^[+-]/, "");
  const big = BigInt(body);
  const v = neg ? -big : big;
  return v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v;
}

function parseReal(text) {
  const t = text.trim().toLowerCase();
  if (t === "nan") return NaN;
  if (t === "inf" || t === "+inf" || t === "infinity" || t === "+infinity") return Infinity;
  if (t === "-inf" || t === "-infinity") return -Infinity;
  const n = Number(t);
  if (t === "" || !Number.isFinite(n)) throw new PlistError(`bad real "${text}"`);
  return n;
}

function parseDate(text) {
  const t = text.trim();
  // Apple writes "2026-03-07T17:50:56Z"; be lenient about a missing Z.
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?Z?$/.exec(t);
  if (!m) throw new PlistError(`bad date "${t}"`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], m[7] ? Math.round(Number(m[7]) * 1000) : 0));
}

/**
 * Parse an XML plist document (or just its root value without the <plist> wrapper).
 * A PlistError thrown from here carries `pos`, the character offset the parser had reached.
 * @param {string} text
 * @param {{ typedReals?: boolean }} [opts] typedReals: return reals as PlistReal
 * @returns {PlistValue}
 * @typedef {string | number | bigint | boolean | Date | Uint8Array | PlistReal | PlistValue[] | { [key: string]: PlistValue } | { $uid: number }} PlistValue
 */
export function parseXmlPlist(text, opts = {}) {
  if (typeof text !== "string") throw new PlistError("not text");
  let pos = 0;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  /** Next tag, skipping text, the XML declaration, DOCTYPE, comments and processing instructions. Returns null at the end. */
  const nextTag = () => {
    for (;;) {
      const lt = src.indexOf("<", pos);
      if (lt < 0) { pos = src.length; return null; }
      if (src.startsWith("<!--", lt)) {
        const end = src.indexOf("-->", lt + 4);
        if (end < 0) throw new PlistError("unclosed comment");
        pos = end + 3;
        continue;
      }
      if (src.startsWith("<?", lt)) {
        const end = src.indexOf("?>", lt + 2);
        if (end < 0) throw new PlistError("unclosed declaration");
        pos = end + 2;
        continue;
      }
      if (src.startsWith("<!", lt)) {
        // DOCTYPE, possibly with an internal subset in [...]
        let depth = 0;
        let i = lt + 2;
        for (; i < src.length; i++) {
          const c = src[i];
          if (c === "[") depth++;
          else if (c === "]") depth--;
          else if (c === ">" && depth <= 0) break;
        }
        if (i >= src.length) throw new PlistError("unclosed doctype");
        pos = i + 1;
        continue;
      }
      const gt = src.indexOf(">", lt + 1);
      if (gt < 0) throw new PlistError("unclosed tag");
      let inner = src.slice(lt + 1, gt).trim();
      pos = gt + 1;
      const closing = inner.startsWith("/");
      if (closing) inner = inner.slice(1).trim();
      const selfClosing = !closing && inner.endsWith("/");
      if (selfClosing) inner = inner.slice(0, -1).trim();
      const name = inner.split(/\s/)[0];
      if (!name) throw new PlistError("empty tag");
      return { name, closing, selfClosing, start: lt };
    }
  };

  /** Raw text up to the closing tag of `name` (CDATA sections are unwrapped, entities decoded). */
  const textUntilClose = (name) => {
    let out = "";
    for (;;) {
      const lt = src.indexOf("<", pos);
      if (lt < 0) throw new PlistError(`unclosed <${name}>`);
      out += decodeEntities(src.slice(pos, lt));
      if (src.startsWith("<![CDATA[", lt)) {
        const end = src.indexOf("]]>", lt + 9);
        if (end < 0) throw new PlistError("unclosed CDATA");
        out += src.slice(lt + 9, end);
        pos = end + 3;
        continue;
      }
      if (src.startsWith("<!--", lt)) {
        const end = src.indexOf("-->", lt + 4);
        if (end < 0) throw new PlistError("unclosed comment");
        pos = end + 3;
        continue;
      }
      const gt = src.indexOf(">", lt);
      if (gt < 0) throw new PlistError("unclosed tag");
      const inner = src.slice(lt + 1, gt).trim();
      if (inner !== `/${name}` && !inner.startsWith(`/${name} `)) throw new PlistError(`unexpected <${inner}> inside <${name}>`);
      pos = gt + 1;
      return out;
    }
  };

  const expectClose = (name) => {
    const t = nextTag();
    if (!t || !t.closing || t.name !== name) throw new PlistError(`expected </${name}>`);
  };

  /** @returns {PlistValue | typeof END} */
  const END = Symbol("end");
  const value = (tag, depth) => {
    if (depth > MAX_DEPTH) throw new PlistError("nested too deeply");
    if (tag.closing) return END;
    const empty = tag.selfClosing;
    switch (tag.name) {
      case "dict": {
        const obj = {};
        if (empty) return obj;
        for (;;) {
          const k = nextTag();
          if (!k) throw new PlistError("unclosed <dict>");
          if (k.closing) {
            if (k.name !== "dict") throw new PlistError(`unexpected </${k.name}>`);
            return obj;
          }
          if (k.name !== "key") throw new PlistError(`expected <key>, got <${k.name}>`);
          const key = k.selfClosing ? "" : textUntilClose("key");
          const vt = nextTag();
          if (!vt) throw new PlistError("missing value");
          const v = value(vt, depth + 1);
          if (v === END) throw new PlistError(`key "${key}" has no value`);
          setKey(obj, key, v);
        }
      }
      case "array": {
        const arr = [];
        if (empty) return arr;
        for (;;) {
          const t = nextTag();
          if (!t) throw new PlistError("unclosed <array>");
          if (t.closing) {
            if (t.name !== "array") throw new PlistError(`unexpected </${t.name}>`);
            return arr;
          }
          arr.push(value(t, depth + 1));
        }
      }
      case "string":
        return empty ? "" : textUntilClose("string");
      case "key":
        throw new PlistError("<key> outside a dict");
      case "integer":
        if (empty) throw new PlistError("empty <integer>");
        return parseInteger(textUntilClose("integer"));
      case "real": {
        if (empty) throw new PlistError("empty <real>");
        const r = parseReal(textUntilClose("real"));
        return opts.typedReals ? new PlistReal(r) : r;
      }
      case "true":
        if (!empty) expectClose("true");
        return true;
      case "false":
        if (!empty) expectClose("false");
        return false;
      case "date":
        if (empty) throw new PlistError("empty <date>");
        return parseDate(textUntilClose("date"));
      case "data":
        return empty ? new Uint8Array(0) : base64ToBytes(textUntilClose("data"));
      default:
        throw new PlistError(`unknown element <${tag.name}>`);
    }
  };

  try {
    let first = nextTag();
    if (!first) throw new PlistError("no plist content");
    let wrapped = false;
    if (first.name === "plist" && !first.closing) {
      wrapped = true;
      if (first.selfClosing) throw new PlistError("empty plist");
      first = nextTag();
      if (!first) throw new PlistError("empty plist");
    }
    const root = value(first, 0);
    if (root === END) throw new PlistError("empty plist");
    if (wrapped) expectClose("plist");
    return root;
  } catch (e) {
    if (e instanceof PlistError) Object.assign(e, { pos: Math.min(pos, src.length) + (src === text ? 0 : 1) });
    throw e;
  }
}

/* ------------------------------------------------------------------ binary */

const APPLE_EPOCH_MS = Date.UTC(2001, 0, 1);

/** True when the bytes start with "bplist" (version 00 is the one in use). */
export function isBinaryPlist(bytes) {
  return bytes.length >= 8 && bytes[0] === 0x62 && bytes[1] === 0x70 && bytes[2] === 0x6c && bytes[3] === 0x69 && bytes[4] === 0x73 && bytes[5] === 0x74;
}

/**
 * Parse a binary plist ("bplist00").
 * @param {Uint8Array} bytes
 * @param {{ typedReals?: boolean }} [opts] typedReals: return reals as PlistReal
 * @returns {PlistValue}
 */
export function parseBinaryPlist(bytes, opts = {}) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 8 + 32 + 1) throw new PlistError("too short");
  if (!isBinaryPlist(bytes) || bytes[6] !== 0x30 || bytes[7] !== 0x30) throw new PlistError("not bplist00");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const t = bytes.length - 32;
  const offsetSize = bytes[t + 6];
  const refSize = bytes[t + 7];
  const big = (p) => {
    const v = dv.getBigUint64(p, false);
    if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new PlistError("trailer value too large");
    return Number(v);
  };
  const numObjects = big(t + 8);
  const topObject = big(t + 16);
  const tableOffset = big(t + 24);
  if (offsetSize < 1 || offsetSize > 8 || refSize < 1 || refSize > 8) throw new PlistError("bad trailer sizes");
  if (numObjects < 1 || topObject >= numObjects) throw new PlistError("bad object count");
  if (tableOffset < 9 || tableOffset + numObjects * offsetSize > t) throw new PlistError("offset table out of range");

  /** Unsigned big-endian integer of n bytes (n <= 8) at p. */
  const uint = (p, n) => {
    if (p + n > t) throw new PlistError("read past the end");
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 256 + bytes[p + i];
    if (!Number.isSafeInteger(v)) throw new PlistError("number too large");
    return v;
  };
  const offsetOf = (ref) => {
    if (ref >= numObjects) throw new PlistError("object reference out of range");
    const off = uint(tableOffset + ref * offsetSize, offsetSize);
    if (off < 8 || off >= tableOffset) throw new PlistError("object offset out of range");
    return off;
  };

  /** Length in the low nibble, or 0xF followed by an int object. Returns [length, position after]. */
  const lengthAt = (p, nibble) => {
    if (nibble !== 0xf) return [nibble, p + 1];
    const m = bytes[p + 1];
    if (m === undefined || (m & 0xf0) !== 0x10) throw new PlistError("bad length marker");
    const n = 1 << (m & 0x0f);
    if (n > 8) throw new PlistError("length too large");
    return [uint(p + 2, n), p + 2 + n];
  };

  const stack = new Set();
  // Objects may be shared by reference, so a tiny file can describe an exponentially large value.
  // Cap the number of objects produced; real Info.plists stay far below this.
  let budget = Math.max(numObjects * 16, 100_000);
  const read = (ref, depth) => {
    if (--budget < 0) throw new PlistError("plist expands to too many objects");
    if (depth > MAX_DEPTH) throw new PlistError("nested too deeply");
    if (stack.has(ref)) throw new PlistError("object refers to itself");
    const p = offsetOf(ref);
    const marker = bytes[p];
    const type = marker >> 4;
    const info = marker & 0x0f;
    switch (type) {
      case 0x0:
        if (info === 0x8) return false;
        if (info === 0x9) return true;
        throw new PlistError(`unsupported marker 0x${marker.toString(16)}`);
      case 0x1: {
        const n = 1 << info;
        if (p + 1 + n > t) throw new PlistError("read past the end");
        if (n <= 4) return uint(p + 1, n);
        if (n === 8) {
          const v = dv.getBigInt64(p + 1, false);
          return v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v;
        }
        if (n === 16) {
          // 128-bit: written by CoreFoundation for unsigned values above 2^63
          const hi = dv.getBigUint64(p + 1, false);
          const lo = dv.getBigUint64(p + 9, false);
          const v = (hi << 64n) | lo;
          return v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v;
        }
        throw new PlistError("bad integer size");
      }
      case 0x2: {
        const real = (/** @type {number} */ r) => (opts.typedReals ? new PlistReal(r) : r);
        if (info === 2) { if (p + 5 > t) throw new PlistError("read past the end"); return real(dv.getFloat32(p + 1, false)); }
        if (info === 3) { if (p + 9 > t) throw new PlistError("read past the end"); return real(dv.getFloat64(p + 1, false)); }
        throw new PlistError("bad real size");
      }
      case 0x3: {
        if (marker !== 0x33 || p + 9 > t) throw new PlistError("bad date");
        return new Date(APPLE_EPOCH_MS + dv.getFloat64(p + 1, false) * 1000);
      }
      case 0x4: {
        const [len, start] = lengthAt(p, info);
        if (start + len > t) throw new PlistError("data past the end");
        return bytes.slice(start, start + len);
      }
      case 0x5: {
        const [len, start] = lengthAt(p, info);
        if (start + len > t) throw new PlistError("string past the end");
        let s = "";
        for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[start + i]);
        return s;
      }
      case 0x6: {
        const [len, start] = lengthAt(p, info);
        if (start + len * 2 > t) throw new PlistError("string past the end");
        let s = "";
        for (let i = 0; i < len; i++) s += String.fromCharCode(dv.getUint16(start + i * 2, false));
        return s;
      }
      case 0x7: {
        const [len, start] = lengthAt(p, info);
        if (start + len > t) throw new PlistError("string past the end");
        return new TextDecoder("utf-8").decode(bytes.subarray(start, start + len));
      }
      case 0x8:
        return { $uid: uint(p + 1, info + 1) };
      case 0xa:
      case 0xc: {
        const [count, start] = lengthAt(p, info);
        if (start + count * refSize > t) throw new PlistError("array past the end");
        stack.add(ref);
        const arr = [];
        for (let i = 0; i < count; i++) arr.push(read(uint(start + i * refSize, refSize), depth + 1));
        stack.delete(ref);
        return arr;
      }
      case 0xd: {
        const [count, start] = lengthAt(p, info);
        if (start + count * 2 * refSize > t) throw new PlistError("dict past the end");
        stack.add(ref);
        const obj = {};
        for (let i = 0; i < count; i++) {
          const key = read(uint(start + i * refSize, refSize), depth + 1);
          if (typeof key !== "string") throw new PlistError("dict key is not a string");
          setKey(obj, key, read(uint(start + (count + i) * refSize, refSize), depth + 1));
        }
        stack.delete(ref);
        return obj;
      }
      default:
        throw new PlistError(`unsupported marker 0x${marker.toString(16)}`);
    }
  };
  return read(topObject, 0);
}

/* ------------------------------------------------------------------ either */

/**
 * Parse a plist in either format.
 * @param {Uint8Array | string} input
 * @param {{ typedReals?: boolean }} [opts]
 * @returns {{ ok: true, value: PlistValue, format: "xml" | "binary" } | { ok: false, error: string }}
 */
export function parsePlist(input, opts = {}) {
  try {
    if (typeof input === "string") return { ok: true, value: parseXmlPlist(input, opts), format: "xml" };
    if (isBinaryPlist(input)) return { ok: true, value: parseBinaryPlist(input, opts), format: "binary" };
    let text;
    if (input.length >= 2 && ((input[0] === 0xfe && input[1] === 0xff) || (input[0] === 0xff && input[1] === 0xfe))) {
      text = new TextDecoder(input[0] === 0xfe ? "utf-16be" : "utf-16le").decode(input.subarray(2));
    } else {
      text = new TextDecoder("utf-8").decode(input);
    }
    return { ok: true, value: parseXmlPlist(text, opts), format: "xml" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Whether a parsed value is a dict (plain object that is not data, a date, an array or a UID). */
export function isDict(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array) && !(v instanceof Date) && !(v instanceof PlistReal) && !("$uid" in v && Object.keys(v).length === 1);
}

/** Short readable text for a single value. */
export function plistToText(v, indent = "") {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "(invalid date)" : v.toISOString().replace(".000Z", "Z");
  if (v instanceof Uint8Array) return `<data ${v.length} bytes>`;
  if (v instanceof PlistReal) return String(v.value);
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    const inner = indent + "  ";
    return `[\n${v.map((x) => inner + plistToText(x, inner)).join(",\n")}\n${indent}]`;
  }
  if (v && typeof v === "object") {
    if ("$uid" in v && Object.keys(v).length === 1) return `UID(${v.$uid})`;
    const keys = Object.keys(v);
    if (!keys.length) return "{}";
    const inner = indent + "  ";
    return `{\n${keys.map((k) => `${inner}${JSON.stringify(k)}: ${plistToText(v[k], inner)}`).join(",\n")}\n${indent}}`;
  }
  return String(v);
}
