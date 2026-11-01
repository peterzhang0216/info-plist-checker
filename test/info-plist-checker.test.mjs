import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  checkInfoPlist, checkInput, detectPlatform, fileKind, sdkMajor, ISSUE_CODES, SOURCES, CATEGORIES, ORIENTATIONS,
} from "../src/info-plist-checker.mjs";
import { messages, formatIssue } from "../src/messages.mjs";

// Fixtures are real Info.plist files with the app renamed to Notebook: a Release-iphoneos build (binary, as Xcode
// writes it), a project Info.plist with $(…) variables, and a Mac build.
const fixture = (/** @type {string} */ name) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const codes = (/** @type {{ code: string }[]} */ issues) => issues.map((i) => i.code);
const notInfo = (/** @type {{ severity: string }[]} */ issues) => issues.filter((i) => i.severity !== "info");

/** A built iOS app dictionary that passes every check; tests change one thing at a time. */
const iosBuilt = (/** @type {Record<string, unknown>} */ extra = {}) => ({
  CFBundleIdentifier: "com.example.notebook",
  CFBundleExecutable: "Notebook",
  CFBundlePackageType: "APPL",
  CFBundleShortVersionString: "1.4.2",
  CFBundleVersion: "42",
  CFBundleSupportedPlatforms: ["iPhoneOS"],
  DTPlatformName: "iphoneos",
  DTSDKName: "iphoneos27.0",
  ITSAppUsesNonExemptEncryption: false,
  UILaunchScreen: {},
  ...extra,
});
const macBuilt = (/** @type {Record<string, unknown>} */ extra = {}) => ({
  CFBundleIdentifier: "com.example.notebook",
  CFBundleExecutable: "Notebook",
  CFBundlePackageType: "APPL",
  CFBundleShortVersionString: "2.1",
  CFBundleVersion: "7",
  CFBundleSupportedPlatforms: ["MacOSX"],
  DTSDKName: "macosx27.0",
  ITSAppUsesNonExemptEncryption: false,
  LSApplicationCategoryType: "public.app-category.productivity",
  LSMinimumSystemVersion: "14.0",
  ...extra,
});

test("binary Release-iphoneos build: read as a built iOS app, nothing to fix", () => {
  const r = checkInput(fixture("notebook-ios-built.plist"));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.format, "binary");
  assert.equal(r.kind, "built");
  assert.equal(r.platform, "ios");
  assert.equal(r.sdk, 26);
  assert.deepEqual(notInfo(r.issues), []);
  // iPhone + iPad, portrait only, no UIRequiresFullScreen: accepted by App Store Connect today, so only a note.
  assert.deepEqual(codes(r.issues), ["ipadOrientations"]);
});

test("project Info.plist with $(…) variables is not treated as broken", () => {
  const r = checkInput(new TextDecoder().decode(fixture("notebook-ios-project.plist")));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.kind, "project");
  assert.equal(r.platform, "ios");
  assert.deepEqual(notInfo(r.issues), []);
  assert.ok(codes(r.issues).includes("projectVariables"));
  assert.ok(codes(r.issues).includes("requiresFullScreen"));
  assert.ok(codes(r.issues).includes("noEncryptionKey"));
});

test("Mac build with category and export compliance key: no issues", () => {
  const r = checkInput(fixture("notebook-mac-built.plist"), { platform: "mac" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.platform, "mac");
  assert.deepEqual(r.issues, []);
});

test("the same variables in a built app are errors", () => {
  const r = checkInfoPlist(iosBuilt({ CFBundleVersion: "$(CURRENT_PROJECT_VERSION)", NSCameraUsageDescription: "${CAMERA_TEXT}" }));
  const vars = r.issues.filter((i) => i.code === "unexpandedVariable");
  assert.deepEqual(vars.map((i) => i.key).sort(), ["CFBundleVersion", "NSCameraUsageDescription"]);
  assert.ok(vars.every((i) => i.severity === "error"));
});

test("version strings follow Apple's format", () => {
  const issue = (/** @type {Record<string, unknown>} */ extra) => codes(checkInfoPlist(iosBuilt(extra)).issues);
  assert.deepEqual(issue({ CFBundleShortVersionString: "1.0" }), []);
  assert.deepEqual(issue({ CFBundleShortVersionString: "1.2.0.1" }), ["shortVersionParts"]);
  assert.deepEqual(issue({ CFBundleShortVersionString: "1.2-beta" }), ["shortVersionFormat"]);
  assert.deepEqual(issue({ CFBundleShortVersionString: "v1.2" }), ["shortVersionFormat"]);
  assert.deepEqual(issue({ CFBundleShortVersionString: "1..2" }), ["shortVersionFormat"]);
  assert.deepEqual(issue({ CFBundleShortVersionString: "" }), ["emptyValue"]);
  assert.deepEqual(issue({ CFBundleVersion: "2026.10.31" }), []);
  assert.deepEqual(issue({ CFBundleVersion: "1.2.3.4" }), ["buildParts"]);
  assert.deepEqual(issue({ CFBundleVersion: "42a" }), ["buildFormat"]);
  assert.deepEqual(issue({ CFBundleVersion: 42 }), ["wrongType"]);
});

test("bundle ID characters, missing core keys, package type", () => {
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ CFBundleIdentifier: "com.example.note_book" })).issues), ["bundleIdChars"]);
  const d = iosBuilt();
  delete d.CFBundleIdentifier;
  delete d.CFBundleExecutable;
  const missing = checkInfoPlist(d).issues.filter((i) => i.code === "missingKey");
  assert.deepEqual(missing.map((i) => [i.key, i.severity]), [["CFBundleIdentifier", "error"], ["CFBundleExecutable", "warning"]]);
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ CFBundlePackageType: "BNDL" })).issues), ["packageType"]);
});

test("purpose strings: empty, placeholder, wrong case, wrong type", () => {
  const r = checkInfoPlist(iosBuilt({
    NSCameraUsageDescription: "",
    NSPhotoLibraryUsageDescription: "TODO",
    NSMicrophoneUsagedescription: "Notebook records voice notes you dictate.",
    NSContactsUsageDescription: true,
    NSLocationWhenInUseUsageDescription: "Notebook tags each note with the place you wrote it, so you can find notes by place.",
  }));
  assert.deepEqual(codes(r.issues).sort(), ["purposeEmpty", "purposeKeyCase", "purposePlaceholder", "wrongType"]);
  assert.ok(r.issues.every((i) => i.severity === "error"));
});

test("launch screen: error with the iOS 27 SDK, warning before it and in a project file", () => {
  const d = iosBuilt();
  delete d.UILaunchScreen;
  assert.deepEqual(codes(checkInfoPlist(d).issues), ["noLaunchScreen"]);
  assert.deepEqual(codes(checkInfoPlist({ ...d, DTSDKName: "iphoneos26.5" }).issues), ["noLaunchScreenOldSdk"]);
  for (const k of ["UILaunchStoryboardName", "UILaunchStoryboards", "UILaunchScreens"]) {
    assert.deepEqual(codes(checkInfoPlist({ ...d, [k]: k === "UILaunchStoryboardName" ? "LaunchScreen" : {} }).issues), [], k);
  }
  assert.deepEqual(codes(checkInfoPlist({ ...d, UILaunchStoryboardName: "" }).issues), ["emptyStoryboardName"]);
  const project = { CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)", LSRequiresIPhoneOS: true };
  assert.ok(codes(checkInfoPlist(project).issues).includes("noLaunchScreenProject"));
  assert.equal(checkInfoPlist({ ...d, NSExtension: {} }).issues.some((i) => i.code.startsWith("noLaunchScreen")), false);
});

test("orientations, full screen, capabilities, background modes, query schemes", () => {
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ UISupportedInterfaceOrientations: ["UIInterfaceOrientationPortrait", "Portrait"] })).issues), ["badOrientation"]);
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ UIDeviceFamily: [1, 2], UISupportedInterfaceOrientations: ORIENTATIONS })).issues), []);
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ UIDeviceFamily: [1, 2], UISupportedInterfaceOrientations: ["UIInterfaceOrientationPortrait"], UIRequiresFullScreen: true })).issues), ["requiresFullScreen"]);
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ UIRequiresFullScreen: true, UIRequiresFullScreenIgnoredStartingWithVersion: "26" })).issues), []);
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ UIRequiredDeviceCapabilities: ["arm64"] })).issues), []);
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ UIRequiredDeviceCapabilities: ["arm64", "healthkit", "camera"] })).issues), ["badCapability", "healthkitCapability", "capabilitiesUpdates"]);
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ UIRequiredDeviceCapabilities: { nfc: true, telephony: false } })).issues), ["capabilitiesUpdates"]);
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ UIRequiredDeviceCapabilities: "arm64" })).issues), ["wrongType"]);
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ UIBackgroundModes: ["audio", "processing", "background-fetch"] })).issues), ["badBackgroundMode"]);
  const schemes = (/** @type {number} */ n) => Array.from({ length: n }, (_, i) => `scheme${i}`);
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ LSApplicationQueriesSchemes: schemes(25) })).issues), []);
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ LSApplicationQueriesSchemes: schemes(26) })).issues), ["querySchemes25"]);
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ LSApplicationQueriesSchemes: schemes(51) })).issues), ["querySchemes50"]);
});

test("export compliance key", () => {
  const d = iosBuilt();
  delete d.ITSAppUsesNonExemptEncryption;
  assert.deepEqual(codes(checkInfoPlist(d).issues), ["noEncryptionKey"]);
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ ITSAppUsesNonExemptEncryption: true })).issues), ["encryptionNoCode"]);
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ ITSAppUsesNonExemptEncryption: true, ITSEncryptionExportComplianceCode: "abc" })).issues), []);
  assert.deepEqual(codes(checkInfoPlist(iosBuilt({ ITSAppUsesNonExemptEncryption: "NO" })).issues), ["wrongType"]);
});

test("Mac category and minimum system version", () => {
  const d = macBuilt();
  delete d.LSApplicationCategoryType;
  assert.deepEqual(checkInfoPlist(d).issues.map((i) => [i.code, i.severity]), [["noCategory", "error"]]);
  const project = { LSMinimumSystemVersion: "$(MACOSX_DEPLOYMENT_TARGET)", CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)" };
  assert.ok(checkInfoPlist(project).issues.some((i) => i.code === "noCategoryProject" && i.severity === "warning"));
  assert.deepEqual(codes(checkInfoPlist(macBuilt({ LSApplicationCategoryType: "" })).issues), ["emptyValue"]);
  assert.deepEqual(codes(checkInfoPlist(macBuilt({ LSApplicationCategoryType: "public.app-category.family" })).issues), ["badCategory"]);
  const near = checkInfoPlist(macBuilt({ LSApplicationCategoryType: "public.app-category.Utilities" })).issues;
  assert.deepEqual(near.map((i) => [i.code, i.expected]), [["badCategoryCase", "public.app-category.utilities"]]);
  assert.deepEqual(codes(checkInfoPlist(macBuilt({ LSMinimumSystemVersion: "macOS 14" })).issues), ["badMinimumSystem"]);
  assert.ok(CATEGORIES.includes("public.app-category.books"), "Xcode's App Category values are accepted too");
});

test("platform and file kind detection, platform override", () => {
  assert.equal(detectPlatform({ LSMinimumSystemVersion: "13.0" }), "mac");
  assert.equal(detectPlatform({ LSRequiresIPhoneOS: true }), "ios");
  assert.equal(detectPlatform({ LSApplicationCategoryType: "public.app-category.games", UILaunchScreen: {} }), "ios");
  assert.equal(detectPlatform({ CFBundleName: "x" }), undefined);
  assert.equal(fileKind({ DTXcode: "2710" }), "built");
  assert.equal(fileKind({ CFBundleName: "x" }), "project");
  assert.equal(sdkMajor({ DTSDKName: "iphoneos27.1" }), 27);
  assert.equal(sdkMajor({ DTPlatformVersion: "26.5" }), 26);
  assert.ok(codes(checkInfoPlist({ CFBundleName: "Notebook" }).issues).includes("platformUnknown"));
  const r = checkInfoPlist(macBuilt(), { platform: "ios" });
  assert.equal(r.platform, "ios");
  assert.ok(codes(r.issues).includes("platformMismatch"));
});

test("input handling: snippets, binary pasted as text, malformed XML", () => {
  const snippet = checkInput("<key>NSCameraUsageDescription</key><string></string>");
  assert.ok(snippet.ok && codes(snippet.issues).includes("purposeEmpty"));
  assert.deepEqual(checkInput("bplist00garbage"), { ok: false, error: "binaryText" });
  assert.deepEqual(checkInput("   "), { ok: false, error: "empty" });
  const bad = checkInput("<plist><dict><key>a</key></dict></plist>");
  assert.equal(bad.ok, false);
  const arr = checkInput("<plist><array/></plist>");
  assert.ok(arr.ok && codes(arr.issues).includes("notDict"));
  const empty = checkInput("<plist><dict/></plist>");
  assert.ok(empty.ok && codes(empty.issues).includes("empty"));
});

test("every issue code the checker can return is listed, and has a message in both languages", () => {
  for (const lang of /** @type {const} */ (["en", "zh"])) {
    const copy = messages[lang];
    for (const code of ISSUE_CODES) assert.ok(copy.issues[/** @type {keyof typeof copy.issues} */ (code)], `${lang} ${code}`);
    assert.deepEqual(Object.keys(copy.issues).sort(), [...ISSUE_CODES].sort(), `${lang}: no message for codes that do not exist`);
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(messages.en).sort());
    assert.deepEqual(Object.keys(copy.types).sort(), Object.keys(messages.en.types).sort());
  }
});

test("formatIssue fills placeholders, names types in words and attaches the Apple page", () => {
  const r = checkInfoPlist(iosBuilt({ CFBundleVersion: 42 }));
  const wrong = r.issues.find((i) => i.code === "wrongType");
  assert.ok(wrong);
  assert.deepEqual(formatIssue(wrong, "en"), { message: "CFBundleVersion should be a string; here it is an integer.", link: undefined });
  assert.equal(formatIssue(wrong, "zh").message, "CFBundleVersion 应该是字符串，这里是整数。");
  const id = checkInfoPlist(iosBuilt({ CFBundleIdentifier: "com.example.note_book" })).issues[0];
  assert.deepEqual(formatIssue(id), {
    message: "CFBundleIdentifier “com.example.note_book” may contain only letters (A–Z, a–z), digits, hyphens and periods.",
    link: "https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleidentifier",
  });
  for (const code of ISSUE_CODES) for (const lang of /** @type {const} */ (["en", "zh"])) {
    const { message } = formatIssue({ code, key: "K", value: "V", expected: "string", n: 1 }, lang);
    assert.doesNotMatch(message, /\{(key|value|expected|n)\}/, `${lang} ${code}`);
  }
});

test("every source is an https Apple URL", () => {
  for (const url of Object.values(SOURCES)) assert.match(url, /^https:\/\/developer\.apple\.com\//);
});
