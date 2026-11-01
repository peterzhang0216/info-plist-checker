// Checks an app's Info.plist (XML or binary) and lists what App Store Connect upload validation or App Review would
// refuse, what is malformed, and what is worth knowing. Pure functions, no dependencies.
//
// Every rule cites the Apple page it comes from (checked on specsCheckedOn). Pages were read through Apple's
// documentation JSON (https://developer.apple.com/tutorials/data/documentation/<path>.json):
// - Key pages: https://developer.apple.com/documentation/bundleresources/information-property-list/<key>
// - Project vs built Info.plist, $(VARIABLE) substitution, GENERATE_INFOPLIST_FILE:
//   https://developer.apple.com/documentation/bundleresources/managing-your-app-s-information-property-list
// - Launch screen required for apps built with the iOS 27 SDK (ITMS-90870):
//   https://developer.apple.com/documentation/technotes/tn3208-preparing-your-apps-launch-screen-to-meet-app-store-requirements
// - UIRequiresFullScreen deprecated, resizable apps support all orientations:
//   https://developer.apple.com/documentation/technotes/tn3192-migrating-your-app-from-the-deprecated-uirequiresfullscreen-key
// - LSApplicationQueriesSchemes limits (50 from iOS 15, 25 from iOS 27): https://developer.apple.com/documentation/uikit/uiapplication/canopenurl(_:)
// - Export compliance: https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations
// - LSApplicationCategoryType required for the Mac App Store: the upload error text "The Info.plist must contain a
//   LSApplicationCategoryType key, whose value is the UTI for a valid category" quoted in
//   https://developer.apple.com/forums/thread/737134 and Apple DTS in https://developer.apple.com/forums/thread/785798.
//   Valid values: Apple's key page plus the values Xcode 27.1 offers for the App Category build setting
//   (INFOPLIST_KEY_LSApplicationCategoryType); Xcode lists a few the key page does not (books, food-and-drink, ...).
// - iPad orientations: the old upload error ITMS-90474 ("iPad Multitasking support requires these orientations",
//   https://developer.apple.com/forums/thread/19215) is no longer raised: iPhone+iPad apps built with the iOS 26 SDK,
//   portrait only, without UIRequiresFullScreen, are live on the App Store. So fewer than four iPad orientations is
//   only a note, citing TN3192.
// Purpose strings use the key table and text checks in ./purpose-strings.mjs.

import { parsePlist, isDict, PlistReal } from "./apple-plist.mjs";
import { KEY_INFO as PURPOSE_KEYS, KEYS as PURPOSE_LIST, lintString } from "./purpose-strings.mjs";

export const specsCheckedOn = "2026-10-31";

const DOC = "https://developer.apple.com/documentation/bundleresources/information-property-list/";
/** Apple pages behind each rule, keyed by the short name an issue carries in `source`. */
export const SOURCES = /** @type {const} */ ({
  managing: "https://developer.apple.com/documentation/bundleresources/managing-your-app-s-information-property-list",
  shortVersion: DOC + "cfbundleshortversionstring",
  version: DOC + "cfbundleversion",
  identifier: DOC + "cfbundleidentifier",
  executable: DOC + "cfbundleexecutable",
  packageType: DOC + "cfbundlepackagetype",
  bundleName: DOC + "cfbundlename",
  purpose: "https://developer.apple.com/documentation/uikit/requesting-access-to-protected-resources",
  launch: "https://developer.apple.com/documentation/technotes/tn3208-preparing-your-apps-launch-screen-to-meet-app-store-requirements",
  capabilities: DOC + "uirequireddevicecapabilities",
  orientations: DOC + "uisupportedinterfaceorientations",
  fullScreen: "https://developer.apple.com/documentation/technotes/tn3192-migrating-your-app-from-the-deprecated-uirequiresfullscreen-key",
  encryption: "https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations",
  queries: "https://developer.apple.com/documentation/uikit/uiapplication/canopenurl(_:)",
  background: DOC + "uibackgroundmodes",
  minimumOS: DOC + "minimumosversion",
  category: DOC + "lsapplicationcategorytype",
  categoryRequired: "https://developer.apple.com/forums/thread/737134",
  minimumSystem: DOC + "lsminimumsystemversion",
});

/** @typedef {"ios" | "mac"} Platform */
/** @typedef {"error" | "warning" | "info"} Severity */
/** @typedef {{ severity: Severity, code: string, key?: string, value?: string, expected?: string, n?: number, source?: keyof typeof SOURCES }} Issue */

/** Value types Apple documents for the keys this checker reads. "list" = array, "dict" = dictionary. */
const TYPES = /** @type {Record<string, "string" | "boolean" | "array" | "dict" | "array|dict">} */ ({
  CFBundleIdentifier: "string",
  CFBundleExecutable: "string",
  CFBundlePackageType: "string",
  CFBundleShortVersionString: "string",
  CFBundleVersion: "string",
  CFBundleName: "string",
  CFBundleDisplayName: "string",
  CFBundleDevelopmentRegion: "string",
  CFBundleInfoDictionaryVersion: "string",
  CFBundleIconName: "string",
  CFBundleIcons: "dict",
  MinimumOSVersion: "string",
  LSMinimumSystemVersion: "string",
  LSApplicationCategoryType: "string",
  LSRequiresIPhoneOS: "boolean",
  UILaunchStoryboardName: "string",
  UILaunchScreen: "dict",
  UIApplicationSceneManifest: "dict",
  UIRequiredDeviceCapabilities: "array|dict",
  UISupportedInterfaceOrientations: "array",
  "UISupportedInterfaceOrientations~ipad": "array",
  "UISupportedInterfaceOrientations~iphone": "array",
  UIRequiresFullScreen: "boolean",
  UIRequiresFullScreenIgnoredStartingWithVersion: "string",
  UIBackgroundModes: "array",
  LSApplicationQueriesSchemes: "array",
  ITSAppUsesNonExemptEncryption: "boolean",
  ITSEncryptionExportComplianceCode: "string",
});

/** Possible values on Apple's UIRequiredDeviceCapabilities page. */
export const DEVICE_CAPABILITIES = [
  "accelerometer", "arkit", "armv7", "arm64", "auto-focus-camera", "bluetooth-le", "camera-flash", "driverkit",
  "front-facing-camera", "gamekit", "gps", "gyroscope", "healthkit", "iphone-performance-gaming-tier",
  "iphone-ipad-minimum-performance-a12", "location-services", "magnetometer", "metal", "microphone", "nfc",
  "opengles-1", "opengles-2", "opengles-3", "peer-peer", "sms", "still-camera", "telephony", "video-camera", "wifi",
];

/** The four values on Apple's UISupportedInterfaceOrientations page. */
export const ORIENTATIONS = [
  "UIInterfaceOrientationPortrait", "UIInterfaceOrientationPortraitUpsideDown",
  "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight",
];

/** Possible values on Apple's UIBackgroundModes page. */
export const BACKGROUND_MODES = [
  "audio", "bluetooth-central", "bluetooth-peripheral", "external-accessory", "fetch", "location", "nearby-interaction",
  "network-authentication", "newsstand-content", "processing", "push-to-talk", "remote-notification", "screen-capture", "voip",
];

/** LSApplicationCategoryType values: Apple's key page and Xcode 27.1's App Category list together. */
export const CATEGORIES = [
  "business", "developer-tools", "education", "entertainment", "finance", "games", "action-games", "adventure-games",
  "arcade-games", "board-games", "card-games", "casino-games", "dice-games", "educational-games", "family-games",
  "kids-games", "music-games", "puzzle-games", "racing-games", "role-playing-games", "simulation-games", "sports-games",
  "strategy-games", "trivia-games", "word-games", "graphics-design", "healthcare-fitness", "lifestyle", "medical", "music",
  "news", "photography", "productivity", "reference", "social-networking", "sports", "travel", "utilities", "video",
  "weather", "books", "food-and-drink", "magazines-and-newspapers", "navigation", "shopping",
].map((c) => `public.app-category.${c}`);

/** Keys that give an iOS app a launch screen (TN3208). */
export const LAUNCH_KEYS = ["UILaunchStoryboardName", "UILaunchStoryboards", "UILaunchScreen", "UILaunchScreens"];

/** Keys every built app carries; Xcode fills them from build settings when the project file leaves them out. */
const CORE_KEYS = ["CFBundleIdentifier", "CFBundleExecutable", "CFBundlePackageType", "CFBundleShortVersionString", "CFBundleVersion"];
/** Of those, the ones whose absence App Store Connect refuses (Apple: CFBundleVersion "is required by the App Store";
 * the version and bundle ID are matched against App Store Connect). The other two are warnings. */
const CORE_REQUIRED = new Set(["CFBundleIdentifier", "CFBundleShortVersionString", "CFBundleVersion"]);

/** Keys Xcode writes into a built product only (DT… = Xcode and SDK used for the build). */
const BUILT_KEYS = ["DTSDKName", "DTXcode", "DTPlatformName", "DTCompiler", "BuildMachineOSBuild"];

const VARIABLE = /\$\(([A-Za-z0-9_:]+)\)|\$\{([A-Za-z0-9_:]+)\}/;
const VERSION_CHARS = /^[0-9.]+$/;
const BUNDLE_ID = /^[A-Za-z0-9.-]+$/;
const OS_VERSION = /^\d+(\.\d+){0,2}$/;

/** Short type name of a plist value, for messages. @param {unknown} v */
export function typeName(v) {
  if (typeof v === "string") return "string";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number" || typeof v === "bigint") return Number.isInteger(Number(v)) ? "integer" : "real";
  if (v instanceof PlistReal) return "real";
  if (v instanceof Date) return "date";
  if (v instanceof Uint8Array) return "data";
  if (Array.isArray(v)) return "array";
  if (isDict(v)) return "dict";
  return "unknown";
}

/** Every string inside a value, with the path to it ("UIApplicationSceneManifest.UISceneConfigurations…"). */
function* strings(/** @type {unknown} */ v, /** @type {string} */ path) {
  if (typeof v === "string") yield [path, v];
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* strings(v[i], `${path}[${i}]`);
  else if (isDict(v)) for (const k of Object.keys(/** @type {object} */ (v))) yield* strings(/** @type {Record<string, unknown>} */ (v)[k], path ? `${path}.${k}` : k);
}

/** SDK major version from DTSDKName ("iphoneos27.0" -> 27) or DTPlatformVersion. @param {Record<string, unknown>} r */
export function sdkMajor(r) {
  const name = typeof r.DTSDKName === "string" ? r.DTSDKName : "";
  const m = /(\d+)(?:\.\d+)*$/.exec(name) ?? (typeof r.DTPlatformVersion === "string" ? /^(\d+)/.exec(r.DTPlatformVersion) : null);
  return m ? Number(m[1]) : undefined;
}

/**
 * What kind of file this is. "built": Xcode's processed copy inside an .app (has DT… keys). "project": the file in a
 * project, which Xcode merges with build settings and whose $(VARIABLES) it substitutes at build time.
 * @param {Record<string, unknown>} r
 */
export function fileKind(r) {
  return BUILT_KEYS.some((k) => k in r) ? "built" : "project";
}

/**
 * The platform the file is for, when the file says so. Mac Catalyst builds count as Mac (they run as Mac apps).
 * @param {Record<string, unknown>} r @returns {Platform | undefined}
 */
export function detectPlatform(r) {
  const supported = Array.isArray(r.CFBundleSupportedPlatforms) ? r.CFBundleSupportedPlatforms : [];
  if (supported.includes("MacOSX") || r.DTPlatformName === "macosx") return "mac";
  if (supported.some((p) => p === "iPhoneOS" || p === "iPhoneSimulator") || r.DTPlatformName === "iphoneos" || r.DTPlatformName === "iphonesimulator") return "ios";
  if ("LSMinimumSystemVersion" in r || r.NSPrincipalClass === "NSApplication" || "NSMainNibFile" in r) return "mac";
  if ("MinimumOSVersion" in r || "LSRequiresIPhoneOS" in r || LAUNCH_KEYS.some((k) => k in r) || "UISupportedInterfaceOrientations" in r || "UIRequiredDeviceCapabilities" in r) return "ios";
  if ("LSApplicationCategoryType" in r) return "mac";
  return undefined;
}

/** Whether the plist belongs to an app extension rather than the app itself. @param {Record<string, unknown>} r */
export const isExtension = (r) => "NSExtension" in r || "EXAppExtensionAttributes" in r || r.CFBundlePackageType === "XPC!";

/** Problems in a version string. @returns {"chars" | "empty" | "parts" | undefined} */
function versionProblem(/** @type {string} */ v, /** @type {number} */ maxParts) {
  if (!VERSION_CHARS.test(v)) return "chars";
  const parts = v.split(".");
  if (parts.some((p) => p === "")) return "empty";
  if (parts.length > maxParts) return "parts";
  return undefined;
}

/**
 * Checks a parsed Info.plist.
 * @param {unknown} root
 * @param {{ platform?: Platform | "any" }} [opts]
 * @returns {{ kind: "built" | "project", platform: Platform | undefined, extension: boolean, sdk: number | undefined, issues: Issue[] }}
 */
export function checkInfoPlist(root, opts = {}) {
  /** @type {Issue[]} */
  const out = [];
  if (!isDict(root)) return { kind: "project", platform: undefined, extension: false, sdk: undefined, issues: [{ severity: "error", code: "notDict" }] };
  const r = /** @type {Record<string, unknown>} */ (root);
  const kind = fileKind(r);
  const built = kind === "built";
  const detected = detectPlatform(r);
  const platform = opts.platform && opts.platform !== "any" ? opts.platform : detected;
  const ext = isExtension(r);
  const sdk = built ? sdkMajor(r) : undefined;
  const has = (/** @type {string} */ k) => k in r;
  const str = (/** @type {string} */ k) => (typeof r[k] === "string" ? /** @type {string} */ (r[k]) : undefined);

  if (Object.keys(r).length === 0) return { kind, platform, extension: ext, sdk, issues: [{ severity: "error", code: "empty" }] };
  if (opts.platform && opts.platform !== "any" && detected && detected !== opts.platform) out.push({ severity: "warning", code: "platformMismatch", value: detected === "mac" ? "macOS" : "iOS" });

  // $(VARIABLES): normal in a project file, wrong in a built one.
  const vars = [];
  for (const [path, v] of strings(r, "")) {
    const m = VARIABLE.exec(v);
    if (m) vars.push([path, v]);
  }
  if (built) for (const [path, v] of vars) out.push({ severity: "error", code: "unexpandedVariable", key: path, value: v, source: "managing" });
  else if (vars.length) out.push({ severity: "info", code: "projectVariables", n: vars.length, source: "managing" });
  const isVar = (/** @type {string | undefined} */ v) => v !== undefined && VARIABLE.test(v);

  // Value types.
  for (const [key, want] of Object.entries(TYPES)) {
    if (!has(key)) continue;
    const got = typeName(r[key]);
    if (want === "array|dict" ? got !== "array" && got !== "dict" : got !== want) out.push({ severity: "error", code: "wrongType", key, value: got, expected: want === "array|dict" ? "array" : want });
  }

  // Keys every app has.
  const missing = CORE_KEYS.filter((k) => !has(k));
  if (built) for (const k of missing) out.push({ severity: CORE_REQUIRED.has(k) ? "error" : "warning", code: "missingKey", key: k, source: k === "CFBundleVersion" ? "version" : k === "CFBundleIdentifier" ? "identifier" : k === "CFBundleShortVersionString" ? "shortVersion" : k === "CFBundleExecutable" ? "executable" : "packageType" });
  else if (missing.length) out.push({ severity: "info", code: "projectMissing", value: missing.join(", "), source: "managing" });

  // Versions and identifier.
  const short = str("CFBundleShortVersionString");
  if (short !== undefined && !isVar(short)) {
    const p = versionProblem(short.trim(), 3);
    if (short.trim() === "") out.push({ severity: "error", code: "emptyValue", key: "CFBundleShortVersionString", source: "shortVersion" });
    else if (p) out.push({ severity: "error", code: p === "parts" ? "shortVersionParts" : "shortVersionFormat", value: short, source: "shortVersion" });
    else if (short !== short.trim()) out.push({ severity: "error", code: "shortVersionFormat", value: short, source: "shortVersion" });
  }
  const build = str("CFBundleVersion");
  if (build !== undefined && !isVar(build)) {
    if (build.trim() === "") out.push({ severity: "error", code: "emptyValue", key: "CFBundleVersion", source: "version" });
    else {
      const p = versionProblem(build, 99);
      if (p) out.push({ severity: "error", code: "buildFormat", value: build, source: "version" });
      else if (build.split(".").length > 3) out.push({ severity: "warning", code: "buildParts", value: build, source: "version" });
    }
  }
  const id = str("CFBundleIdentifier");
  if (id !== undefined && !isVar(id)) {
    if (id === "") out.push({ severity: "error", code: "emptyValue", key: "CFBundleIdentifier", source: "identifier" });
    else if (!BUNDLE_ID.test(id)) out.push({ severity: "error", code: "bundleIdChars", value: id, source: "identifier" });
  }
  const exe = str("CFBundleExecutable");
  if (exe === "") out.push({ severity: "error", code: "emptyValue", key: "CFBundleExecutable", source: "executable" });
  const pkg = str("CFBundlePackageType");
  if (pkg !== undefined && !isVar(pkg) && !ext && pkg !== "APPL") out.push({ severity: "warning", code: "packageType", value: pkg, source: "packageType" });
  const name = str("CFBundleName");
  if (name !== undefined && !isVar(name) && [...name].length > 15) out.push({ severity: "info", code: "bundleNameLong", value: name, source: "bundleName" });

  // Purpose strings (NS…UsageDescription).
  const lower = new Map(PURPOSE_LIST.map((k) => [k.key.toLowerCase(), k.key]));
  for (const key of Object.keys(r)) {
    if (!PURPOSE_KEYS.has(key)) {
      const fix = lower.get(key.toLowerCase());
      if (fix) out.push({ severity: "error", code: "purposeKeyCase", key, expected: fix, source: "purpose" });
      continue;
    }
    const v = r[key];
    if (typeof v !== "string") {
      out.push({ severity: "error", code: "wrongType", key, value: typeName(v), expected: "string" });
      continue;
    }
    if (isVar(v.trim()) && !built) continue;
    for (const i of lintString(key, v)) {
      if (i.code === "empty") out.push({ severity: "error", code: "purposeEmpty", key, source: "purpose" });
      else if (i.code === "placeholder") out.push({ severity: "error", code: "purposePlaceholder", key, value: v.trim(), source: "purpose" });
      else if (i.code === "tooLong") out.push({ severity: "error", code: "purposeTooLong", key, n: i.bytes, source: "purpose" });
    }
  }

  // Export compliance (App Store Connect, iOS and Mac apps).
  if (!ext) {
    if (!has("ITSAppUsesNonExemptEncryption")) out.push({ severity: "info", code: "noEncryptionKey", source: "encryption" });
    else if (r.ITSAppUsesNonExemptEncryption === true && !has("ITSEncryptionExportComplianceCode")) out.push({ severity: "info", code: "encryptionNoCode", source: "encryption" });
  }

  if (platform === "ios") checkIos(r, { built, sdk, ext, out });
  if (platform === "mac") checkMac(r, { built, ext, out });
  if (!platform) out.push({ severity: "info", code: "platformUnknown" });
  return { kind, platform, extension: ext, sdk, issues: out };
}

/** @param {Record<string, unknown>} r @param {{ built: boolean, sdk: number | undefined, ext: boolean, out: Issue[] }} ctx */
function checkIos(r, { built, sdk, ext, out }) {
  const has = (/** @type {string} */ k) => k in r;
  const arr = (/** @type {string} */ k) => (Array.isArray(r[k]) ? /** @type {unknown[]} */ (r[k]) : undefined);

  if (!ext) {
    // Launch screen (TN3208): App Store Connect refuses builds made with the iOS 27 SDK or later without one.
    if (!LAUNCH_KEYS.some(has)) {
      if (built && sdk !== undefined && sdk >= 27) out.push({ severity: "error", code: "noLaunchScreen", source: "launch" });
      else out.push({ severity: "warning", code: built ? "noLaunchScreenOldSdk" : "noLaunchScreenProject", source: "launch" });
    } else if (r.UILaunchStoryboardName === "" && !LAUNCH_KEYS.some((k) => k !== "UILaunchStoryboardName" && has(k))) {
      out.push({ severity: "warning", code: "emptyStoryboardName", source: "launch" });
    }

    // Orientations.
    for (const key of ["UISupportedInterfaceOrientations", "UISupportedInterfaceOrientations~ipad", "UISupportedInterfaceOrientations~iphone"]) {
      for (const v of arr(key) ?? []) if (typeof v === "string" && !ORIENTATIONS.includes(v) && !VARIABLE.test(v)) out.push({ severity: "warning", code: "badOrientation", key, value: v, source: "orientations" });
    }
    const family = arr("UIDeviceFamily");
    const ipad = has("UISupportedInterfaceOrientations~ipad") || (family ? family.includes(2) : false);
    const fullScreen = r.UIRequiresFullScreen === true;
    const ipadList = arr("UISupportedInterfaceOrientations~ipad") ?? arr("UISupportedInterfaceOrientations");
    if (ipad && !fullScreen && ipadList) {
      const miss = ORIENTATIONS.filter((o) => !ipadList.includes(o));
      if (miss.length) out.push({ severity: "info", code: "ipadOrientations", value: miss.join(", "), source: "fullScreen" });
    }
    if (fullScreen && !has("UIRequiresFullScreenIgnoredStartingWithVersion")) out.push({ severity: "info", code: "requiresFullScreen", source: "fullScreen" });

    // MinimumOSVersion in a project file (Xcode takes it from the deployment target).
    if (!built && has("MinimumOSVersion")) out.push({ severity: "info", code: "minimumOSInProject", source: "minimumOS" });
  }

  // Required device capabilities.
  const caps = r.UIRequiredDeviceCapabilities;
  const capNames = Array.isArray(caps) ? caps : isDict(caps) ? Object.keys(/** @type {object} */ (caps)) : [];
  for (const c of capNames) {
    if (typeof c !== "string") continue;
    if (!DEVICE_CAPABILITIES.includes(c) && !VARIABLE.test(c)) out.push({ severity: "warning", code: "badCapability", value: c, source: "capabilities" });
  }
  const requires = (/** @type {string} */ c) => (Array.isArray(caps) ? caps.includes(c) : isDict(caps) ? /** @type {Record<string, unknown>} */ (caps)[c] === true : false);
  if (!ext && requires("healthkit")) out.push({ severity: "info", code: "healthkitCapability", source: "capabilities" });
  const hardware = capNames.filter((c) => typeof c === "string" && c !== "arm64" && c !== "armv7");
  if (!ext && hardware.length) out.push({ severity: "info", code: "capabilitiesUpdates", value: hardware.join(", "), source: "capabilities" });

  // Background modes.
  for (const m of arr("UIBackgroundModes") ?? []) {
    if (typeof m === "string" && !BACKGROUND_MODES.includes(m) && !VARIABLE.test(m)) out.push({ severity: "warning", code: "badBackgroundMode", value: m, source: "background" });
  }

  // URL schemes the app may query with canOpenURL.
  const schemes = arr("LSApplicationQueriesSchemes");
  if (schemes) {
    if (schemes.length > 50) out.push({ severity: "warning", code: "querySchemes50", n: schemes.length, source: "queries" });
    else if (schemes.length > 25) out.push({ severity: "warning", code: "querySchemes25", n: schemes.length, source: "queries" });
  }
}

/** @param {Record<string, unknown>} r @param {{ built: boolean, ext: boolean, out: Issue[] }} ctx */
function checkMac(r, { built, ext, out }) {
  if (!ext) {
    const cat = r.LSApplicationCategoryType;
    if (cat === undefined) out.push({ severity: built ? "error" : "warning", code: built ? "noCategory" : "noCategoryProject", source: "categoryRequired" });
    else if (cat === "") out.push({ severity: built ? "error" : "warning", code: "emptyValue", key: "LSApplicationCategoryType", source: "categoryRequired" });
    else if (typeof cat === "string" && !VARIABLE.test(cat) && !CATEGORIES.includes(cat)) {
      const near = CATEGORIES.find((c) => c.toLowerCase() === cat.toLowerCase().trim());
      out.push(near ? { severity: "error", code: "badCategoryCase", value: cat, expected: near, source: "category" } : { severity: "error", code: "badCategory", value: cat, source: "category" });
    }
  }
  const min = r.LSMinimumSystemVersion;
  if (typeof min === "string" && !VARIABLE.test(min) && !OS_VERSION.test(min)) out.push({ severity: "warning", code: "badMinimumSystem", value: min, source: "minimumSystem" });
}

/**
 * Parses pasted text or file bytes (XML or binary plist) and checks it.
 * A pasted snippet of <key>…</key> lines without the <plist><dict> around it is wrapped first.
 * @param {string | Uint8Array} input @param {{ platform?: Platform | "any" }} [opts]
 */
export function checkInput(input, opts) {
  let src = input;
  if (typeof src === "string") {
    const t = src.trim();
    if (t === "") return /** @type {const} */ ({ ok: false, error: "empty" });
    if (t.startsWith("bplist")) return /** @type {const} */ ({ ok: false, error: "binaryText" });
    if (!/<plist[\s>]/.test(t) && !/^<\?xml/.test(t) && /^<key>/.test(t)) src = `<plist version="1.0"><dict>${t}</dict></plist>`;
  }
  const parsed = parsePlist(src);
  if (!parsed.ok) return /** @type {const} */ ({ ok: false, error: "parse", detail: parsed.error });
  return /** @type {const} */ ({ ok: true, format: parsed.format, ...checkInfoPlist(parsed.value, opts) });
}

/** Every issue code checkInfoPlist can return. Each one has a message in messages.mjs. */
export const ISSUE_CODES = [
  "notDict", "empty", "platformMismatch", "unexpandedVariable", "projectVariables", "wrongType", "missingKey", "projectMissing",
  "emptyValue", "emptyStoryboardName", "shortVersionFormat", "shortVersionParts", "buildFormat", "buildParts", "bundleIdChars", "packageType",
  "bundleNameLong", "purposeKeyCase", "purposeEmpty", "purposePlaceholder", "purposeTooLong", "noEncryptionKey",
  "encryptionNoCode", "platformUnknown", "noLaunchScreen", "noLaunchScreenOldSdk", "noLaunchScreenProject", "badOrientation",
  "ipadOrientations", "requiresFullScreen", "minimumOSInProject", "badCapability", "healthkitCapability", "capabilitiesUpdates",
  "badBackgroundMode", "querySchemes50", "querySchemes25", "noCategory", "noCategoryProject", "badCategory", "badCategoryCase", "badMinimumSystem",
];
