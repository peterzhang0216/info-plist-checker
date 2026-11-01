// Purpose strings (NS…UsageDescription): the list of keys Apple documents and the text checks for one string.
//
// KEYS is transcribed from Apple's documentation (checked on 2026-10-30): the "Protected resources" list
//   https://developer.apple.com/documentation/bundleresources/protected-resources
// and each key's own page under https://developer.apple.com/documentation/bundleresources/information-property-list/<key>.
// `platforms` is Apple's availability list ("iOS 6.0-17.0" means introduced in 6.0, deprecated in 17.0); `covers` is
// Apple's one-line summary. Only string-valued purpose keys are here (not the dictionaries or Booleans in the same list).
// Do not add a key that is not on those pages.
//
// The rules for good purpose strings come from Apple's "Requesting access to protected resources"
//   https://developer.apple.com/documentation/uikit/requesting-access-to-protected-resources
// (not blank, under 4,000 bytes, a string, accurate and specific, typically one complete sentence) and App Review
// Guideline 5.1.1 (ii) "Ensure your purpose strings clearly and completely describe your use of the data" and (iv)
// "Apps must respect the user's permission settings and not attempt to manipulate, trick, or force people to consent".
//   https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage

/** Apple's limit for a purpose string, in UTF-8 bytes. */
export const MAX_BYTES = 4000;

/**
 * @typedef {{ key: string, platforms: string, covers: string, deprecated?: boolean, replacedBy?: string[] }} KeyInfo
 */

/** @type {KeyInfo[]} */
export const KEYS = [
  { key: "NFCReaderUsageDescription", platforms: "iOS 11.0, iPadOS 11.0", covers: "A message that tells people why the app is requesting access to the device’s NFC hardware." },
  { key: "NSAccessoryTrackingUsageDescription", platforms: "visionOS 26.0", covers: "A message that tells a person why the app is requesting access to track accessory position and location." },
  { key: "NSAppBundlesUsageDescription", platforms: "macOS 13.0", covers: "A message that tells people why the app needs to access the contents of other apps’ bundles." },
  { key: "NSAppDataUsageDescription", platforms: "macOS 14.0", covers: "A message that tells people why the app needs to access files in other apps’ sandbox containers." },
  { key: "NSAppleEventsUsageDescription", platforms: "macOS 10.14", covers: "A message that tells people why the app is requesting the ability to send Apple events." },
  { key: "NSAppleMusicUsageDescription", platforms: "iOS 2.0, iPadOS 2.0, macOS 15.0, visionOS 1.0", covers: "A message that tells people why the app is requesting access to their media library." },
  { key: "NSAudioCaptureUsageDescription", platforms: "macOS 14.2", covers: "A message that tells people why your app is requesting access to capture system audio on macOS." },
  { key: "NSBluetoothAlwaysUsageDescription", platforms: "iOS 13.0, iPadOS 13.0, macOS 11.0, tvOS 13.0, visionOS 1.0, watchOS 6.0", covers: "A message that tells people why the app needs access to Bluetooth." },
  { key: "NSBluetoothPeripheralUsageDescription", platforms: "iOS 6.0-13.0, iPadOS 6.0-13.0", covers: "A message that tells people why the app is requesting the ability to connect to Bluetooth peripherals.", deprecated: true, replacedBy: ["NSBluetoothAlwaysUsageDescription"] },
  { key: "NSCalendarsFullAccessUsageDescription", platforms: "iOS 17.0, iPadOS 17.0, Mac Catalyst 17.0, macOS 14.0, visionOS 1.0, watchOS 10.0", covers: "A message that tells people why the app is requesting access to read and write their calendar data." },
  { key: "NSCalendarsUsageDescription", platforms: "iOS 6.0-17.0, iPadOS 6.0-17.0, Mac Catalyst 13.0-17.0, macOS 10.14-14.0, watchOS 6.0-10.0", covers: "A message that tells people why the app is requesting access to their calendar data.", deprecated: true, replacedBy: ["NSCalendarsFullAccessUsageDescription", "NSCalendarsWriteOnlyAccessUsageDescription"] },
  { key: "NSCalendarsWriteOnlyAccessUsageDescription", platforms: "iOS 17.0, iPadOS 17.0, Mac Catalyst 17.0, macOS 14.0, visionOS 1.0, watchOS 10.0", covers: "A message that tells people why the app is requesting access to create calendar events." },
  { key: "NSCameraUsageDescription", platforms: "iOS 7.0, iPadOS 7.0, macOS 10.14, tvOS 17.0, visionOS 1.0", covers: "A message that tells people why the app is requesting access to the device’s camera." },
  { key: "NSContactsUsageDescription", platforms: "iOS 6.0, iPadOS 6.0, macOS 10.8, visionOS 1.0", covers: "A message that tells people why the app is requesting access to their contacts." },
  { key: "NSCriticalMessagingUsageDescription", platforms: "iOS 18.2, iPadOS 18.2, watchOS 11.2", covers: "A message that tells people why the app needs to send SMS messages." },
  { key: "NSDesktopFolderUsageDescription", platforms: "macOS 10.15", covers: "A message that tells people why the app needs access to their Desktop folder." },
  // Apple's page for this key has no one-line summary; its text describes access to the Documents folder.
  { key: "NSDocumentsFolderUsageDescription", platforms: "macOS 10.15", covers: "Access to the user’s Documents folder." },
  { key: "NSDownloadsFolderUsageDescription", platforms: "macOS 10.15", covers: "A message that tells people why the app needs access to the user’s Downloads folder." },
  { key: "NSEnterpriseMCAMUsageDescription", platforms: "visionOS 2.0-2.3", covers: "A message that tells people why the app is requesting access to the device’s main camera.", deprecated: true, replacedBy: ["NSMainCameraUsageDescription"] },
  { key: "NSFaceIDUsageDescription", platforms: "iOS 11.0, iPadOS 11.0", covers: "A message that tells people why the app is requesting the ability to authenticate with Face ID." },
  { key: "NSFallDetectionUsageDescription", platforms: "iOS 14.2, iPadOS 14.2, visionOS 1.0, watchOS 7.2", covers: "A message to the user that explains the app’s request for permission to access fall detection event data." },
  { key: "NSFileProviderDomainUsageDescription", platforms: "macOS 10.15", covers: "A message that tells people why the app needs access to files managed by a file provider." },
  { key: "NSFileProviderPresenceUsageDescription", platforms: "macOS 10.15", covers: "A message that tells people why the app’s file provider needs to determine which files the person is currently accessing." },
  { key: "NSFinancialDataUsageDescription", platforms: "iOS 17.4, iPadOS 17.4", covers: "A message that tells people why the app is requesting access to financial data stored in Wallet." },
  { key: "NSGKFriendListUsageDescription", platforms: "iOS 14.5, iPadOS 14.5", covers: "A message that tells people why the app needs access to their Game Center friends list." },
  { key: "NSHandsTrackingUsageDescription", platforms: "visionOS 1.0", covers: "A message that tells people why the app is requesting access to track their hand position and location." },
  { key: "NSHealthClinicalHealthRecordsShareUsageDescription", platforms: "iOS 12.0, iPadOS 12.0, visionOS 1.0", covers: "A message to the user that explains why the app requested permission to read clinical records." },
  { key: "NSHealthShareUsageDescription", platforms: "iOS 8.0, iPadOS 8.0, visionOS 1.0", covers: "A message that explains to people why the app requests permission to read samples from the HealthKit store." },
  { key: "NSHealthUpdateUsageDescription", platforms: "iOS 8.0, iPadOS 8.0, visionOS 1.0", covers: "A message to the user that explains why the app requested permission to save samples to the HealthKit store." },
  { key: "NSHomeKitUsageDescription", platforms: "iOS 8.0, iPadOS 8.0, visionOS 1.0, watchOS 2.0", covers: "A message that tells people why the app is requesting access to their HomeKit configuration data." },
  { key: "NSIdentityUsageDescription", platforms: "iOS 16.0, iPadOS 16.0, visionOS 1.0", covers: "A message that tells people why the app is requesting identity information." },
  { key: "NSLocalNetworkUsageDescription", platforms: "iOS 14.0, iPadOS 14.0, macOS 11.0, tvOS 14.0, visionOS 1.0", covers: "A message that tells people why the app is requesting access to the local network." },
  { key: "NSLocationAlwaysAndWhenInUseUsageDescription", platforms: "iOS 11.0, iPadOS 11.0, visionOS 1.0", covers: "A message that tells people why the app is requesting access to their location information at all times." },
  { key: "NSLocationAlwaysUsageDescription", platforms: "iOS 8.0-10.0, iPadOS 8.0-10.0", covers: "A message that tells people why the app is requesting access to their location at all times.", deprecated: true, replacedBy: ["NSLocationAlwaysAndWhenInUseUsageDescription"] },
  { key: "NSLocationUsageDescription", platforms: "iOS 6.0-8.0, iPadOS 6.0-8.0, macOS 10.14", covers: "A message that tells people why the app is requesting access to their location information." },
  { key: "NSLocationWhenInUseUsageDescription", platforms: "iOS 11.0, iPadOS 11.0, visionOS 1.0", covers: "A message that tells people why the app is requesting access to their location information while the app is running in the foreground." },
  { key: "NSMainCameraUsageDescription", platforms: "visionOS 26.0", covers: "A message that tells people why the app is requesting access to the device’s main camera." },
  { key: "NSMicrophoneUsageDescription", platforms: "iOS 7.0, iPadOS 7.0, macOS 10.14, tvOS 17.0, visionOS 1.0, watchOS 4.0", covers: "A message that tells people why the app is requesting access to the device’s microphone." },
  { key: "NSMotionUsageDescription", platforms: "iOS 7.0, iPadOS 7.0, macOS 10.15, visionOS 1.0", covers: "A message that tells people why the app is requesting access to the device’s motion data." },
  { key: "NSNearbyInteractionAllowOnceUsageDescription", platforms: "iOS 14.0-15.0, iPadOS 14.0-15.0", covers: "A one-time request for user permission to begin an interaction session with nearby devices.", deprecated: true, replacedBy: ["NSNearbyInteractionUsageDescription"] },
  { key: "NSNearbyInteractionUsageDescription", platforms: "iOS 15.0, iPadOS 15.0, watchOS 8.0", covers: "A request for user permission to begin an interaction session with nearby devices." },
  { key: "NSNetworkVolumesUsageDescription", platforms: "macOS 10.15", covers: "A message that tells people why the app needs access to files on a network volume." },
  { key: "NSPhotoLibraryAddUsageDescription", platforms: "iOS 11.0, iPadOS 11.0, visionOS 1.0", covers: "A message that tells people why the app is requesting add-only access to their photo library." },
  { key: "NSPhotoLibraryUsageDescription", platforms: "iOS 6.0, iPadOS 6.0, macOS 10.14, visionOS 1.0", covers: "A message that tells people why the app is requesting access to their photo library." },
  { key: "NSRemindersFullAccessUsageDescription", platforms: "iOS 17.0, iPadOS 17.0, Mac Catalyst 17.0, macOS 14.0, visionOS 1.0, watchOS 10.0", covers: "A message that tells people why the app is requesting access to read and write their reminders data." },
  { key: "NSRemindersUsageDescription", platforms: "iOS 6.0-17.0, iPadOS 6.0-17.0, Mac Catalyst 13.0-17.0, macOS 10.14-14.0, watchOS 6.0-10.0", covers: "A message that tells people why the app is requesting access to their reminders.", deprecated: true, replacedBy: ["NSRemindersFullAccessUsageDescription"] },
  { key: "NSRemovableVolumesUsageDescription", platforms: "macOS 10.15", covers: "A message that tells people why the app needs access to files on a removable volume." },
  { key: "NSSensorKitUsageDescription", platforms: "iOS 14.0, iPadOS 14.0", covers: "A short description of the purpose of your app’s research study." },
  { key: "NSSiriUsageDescription", platforms: "iOS 10.0, iPadOS 10.0, visionOS 1.0", covers: "A message that tells people why the app is requesting to send user data to Siri." },
  { key: "NSSpeechRecognitionUsageDescription", platforms: "iOS 10.0, iPadOS 10.0, macOS 10.15, visionOS 1.0", covers: "A message that tells people why the app is requesting to send user data to Apple’s speech recognition servers." },
  { key: "NSSystemAdministrationUsageDescription", platforms: "macOS 10.14", covers: "A message in macOS that tells people why the app is requesting to manipulate the system configuration." },
  { key: "NSSystemExtensionUsageDescription", platforms: "iOS 18.4, iPadOS 18.4, Mac Catalyst 18.4, macOS 10.15", covers: "A message that tells people why the app is trying to install a system extension bundle." },
  { key: "NSUserTrackingMarkdownUsageDescription", platforms: "iOS 27.2, iPadOS 27.2", covers: "A message that explains the purpose for accessing data that an application can use to track a person or device." },
  { key: "NSUserTrackingUsageDescription", platforms: "iOS 14.0, iPadOS 14.0, tvOS 14.0, visionOS 1.0", covers: "A message that explains the purpose for accessing data that an app can use to track a person or device." },
  { key: "NSVideoSubscriberAccountUsageDescription", platforms: "tvOS 9.0", covers: "A message that tells people why the app is requesting access to their TV provider account." },
  { key: "NSWorldSensingUsageDescription", platforms: "visionOS 1.0", covers: "A message that tells people why the app is requesting access to image tracking, plane detection, or scene reconstruction." },
  { key: "OSBundleUsageDescription", platforms: "iOS 18.4, iPadOS 18.4, Mac Catalyst 18.4, macOS 10.15", covers: "A message that tells people why the app is trying to install a driver extension bundle." },
];

/** @type {Map<string, KeyInfo>} */
export const KEY_INFO = new Map(KEYS.map((k) => [k.key, k]));

/**
 * @typedef {{ severity: "error" | "warning" | "info", code: string, key?: string, other?: string, value?: string, bytes?: number }} Issue
 */

const CJK = /[぀-ヿ㐀-鿿가-힯]/;
const PLACEHOLDER = /^(todo|tbd|fixme|placeholder|test|testing|description|usage description|privacy description|purpose string|string|text|n\/a|none|null|x+|\.+|…|待定|待填|待补充|占位|占位符|测试|描述|说明)[.。!！]?$/i;
const PLACEHOLDER_ANY = /lorem ipsum|<#|#>|\bTODO\b|\bFIXME\b|\bTBD\b/i;
const BUILD_VAR_ONLY = /^\$[({][A-Za-z0-9_:]+[)}]$/;
const COERCIVE = [
  /\b(won't|will not|wouldn't|can't|cannot|can not|unable to)\s+(work|function|run|be used|open|continue|start|operate)\b/i,
  /\bwithout (this|it|access|permission|your permission|these permissions)\b[^.]{0,200}\b(not|can't|cannot|won't|unable)\b/i,
  /\b(you must|must (allow|grant|enable|accept)|have to (allow|grant|enable)|need to (allow|grant|enable)|required to use (this|the) app|please (allow|grant|accept|enable))\b/i,
  /\botherwise\b/i,
  /\bin order to use (this|the) app\b/i,
  /否则|必须(允许|授权|开启|同意|打开)|(无法|不能)(使用|正常|运行|继续|工作)|请(务必)?(允许|授权|开启|同意)|才能(使用|继续)/,
];
const VAGUE = [
  /^(this |the )?(app|application) (needs|requires|wants|would like|uses|is requesting|requests)( to)?( (access|permission))?( to)?( (use|access))?( your| the)?( [\w-]+){0,3}[.!]?$/i,
  /^(we|i) (need|want|would like)( to)?( (access|use))?( your| the)?( [\w-]+){0,3}[.!]?$/i,
  /\b(for|to provide|to give you|to improve) (a )?(better|improved|the best) (user )?(experience|service)\b/i,
  /^(本|此|该)?(应用|App|app|程序)?(需要|想要|请求|要)(访问|使用|获取)?(你|您)?的?[一-鿿A-Za-z ]{1,8}(权限)?[。.!！]?$/,
  /(更好|更优|优质)的(用户)?(体验|服务)/,
];

/**
 * Problems in one purpose string's text. checkInfoPlist reports only the "empty", "placeholder" and "tooLong" results
 * (the ones Apple states as hard rules); "tooShort", "vague" and "coercive" are style hints for callers who want them.
 * @returns {Issue[]}
 */
export function lintString(/** @type {string} */ key, /** @type {string} */ value) {
  /** @type {Issue[]} */
  const issues = [];
  const t = value.trim();
  if (t === "") return [{ severity: "error", code: "empty", key }];
  if (BUILD_VAR_ONLY.test(t)) return [{ severity: "info", code: "buildVariable", key, value: t }];
  if (PLACEHOLDER.test(t) || PLACEHOLDER_ANY.test(t) || t === key) issues.push({ severity: "error", code: "placeholder", key, value: t });
  const bytes = new TextEncoder().encode(value).length;
  if (bytes >= MAX_BYTES) {
    issues.push({ severity: "error", code: "tooLong", key, bytes });
    return issues; // skip the style checks on oversized text
  }
  if (COERCIVE.some((re) => re.test(t))) issues.push({ severity: "warning", code: "coercive", key, value: t });
  if (!issues.some((i) => i.code === "placeholder")) {
    const short = CJK.test(t) ? [...t].length < 10 : t.split(/\s+/).length < 5 || t.length < 25;
    if (short) issues.push({ severity: "warning", code: "tooShort", key, value: t });
    else if (VAGUE.some((re) => re.test(t))) issues.push({ severity: "warning", code: "vague", key, value: t });
  }
  return issues;
}
