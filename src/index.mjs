// Public API. See README.md for examples.
export {
  checkInfoPlist, checkInput, detectPlatform, fileKind, isExtension, sdkMajor, typeName,
  ISSUE_CODES, SOURCES, specsCheckedOn, CATEGORIES, ORIENTATIONS, DEVICE_CAPABILITIES, BACKGROUND_MODES, LAUNCH_KEYS,
} from "./info-plist-checker.mjs";
export { parsePlist, parseXmlPlist, parseBinaryPlist, isBinaryPlist, isDict, PlistError, PlistReal } from "./apple-plist.mjs";
export { messages, formatIssue, fill } from "./messages.mjs";
export { KEYS as PURPOSE_KEYS, MAX_BYTES as PURPOSE_MAX_BYTES, lintString as lintPurposeString } from "./purpose-strings.mjs";
