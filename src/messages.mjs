// Messages for each issue code, in English and Simplified Chinese. Placeholders {key}, {value}, {expected}, {n} are
// filled from the issue; {date}, {kind}, {platform}, {sdk}, {detail} by the caller. Key names stay in English, as they
// appear in the file. The Apple page behind each rule is in SOURCES (info-plist-checker.mjs).

import { SOURCES } from "./info-plist-checker.mjs";

const en = {
  specsNote: "Rules are from Apple's Information Property List documentation and App Store Connect upload messages, checked on {date}. Each message links to the Apple page behind it.",
  ios: "iOS / iPadOS",
  mac: "macOS",
  parseError: "This is not a valid property list: {detail}",
  readAs: "Read as: {kind}, {platform}{sdk}",
  kindBuilt: "built app",
  kindProject: "project file",
  platformUnknownShort: "platform unknown",
  sdkPart: ", built with SDK {sdk}",
  extensionNote: "This is an app extension's Info.plist, so app-only checks (launch screen, category, export compliance) are skipped.",
  noIssues: "Nothing to fix. The keys this tool checks look right for an App Store upload.",
  errorsTitle: "Will be refused or is malformed",
  warningsTitle: "Fix or check before you submit",
  infoTitle: "Worth knowing",
  appleLink: "Apple's page",
  forumLink: "Apple Developer Forums",
  summary: "Errors: {errors}, warnings: {warnings}, notes: {info}",
  readFailed: "Could not read {file}: {detail}",
  types: {
    string: "a string",
    boolean: "a Boolean (<true/> or <false/>)",
    array: "an array",
    dict: "a dictionary",
    integer: "an integer",
    real: "a real number",
    date: "a date",
    data: "data",
    unknown: "an unknown type",
  },
  issues: {
    notDict: "The top level of Info.plist must be a <dict>.",
    empty: "The file has no keys.",
    platformMismatch: "This file looks like a {value} app. The checks follow the platform you picked.",
    unexpandedVariable: "{key} still holds {value}. In a built app Xcode should have replaced this build-setting variable: check that the setting has a value for this target and build configuration.",
    projectVariables: "This is a project Info.plist with {n} $(…) build-setting values. That is normal: Xcode fills them in when it builds. To check the final values, check the Info.plist inside the built app.",
    wrongType: "{key} should be {expected}; here it is {value}.",
    missingKey: "{key} is missing from this built app.",
    projectMissing: "Not in this file: {value}. In a project that is fine when the Generate Info.plist File build setting is on, because Xcode adds them from build settings. If unsure, check the built app's Info.plist.",
    emptyValue: "{key} is empty.",
    emptyStoryboardName: "UILaunchStoryboardName is empty, so it names no storyboard. Give the storyboard's file name without .storyboard, or use UILaunchScreen.",
    shortVersionFormat: "CFBundleShortVersionString “{value}” may contain only digits and periods, like 1.4.2.",
    shortVersionParts: "CFBundleShortVersionString “{value}” has more than three numbers. Apple's format is Major.Minor.Patch, such as 1.4.2.",
    buildFormat: "CFBundleVersion “{value}” may contain only digits and periods, like 42 or 1.4.2.",
    buildParts: "CFBundleVersion “{value}” has more than three numbers. The system ignores the extra ones.",
    bundleIdChars: "CFBundleIdentifier “{value}” may contain only letters (A–Z, a–z), digits, hyphens and periods.",
    packageType: "CFBundlePackageType is {value}. For an app it is APPL.",
    bundleNameLong: "CFBundleName “{value}” is longer than 15 characters, Apple's limit for this short name. Put a longer name in CFBundleDisplayName.",
    purposeKeyCase: "{key} is never read: key names are case-sensitive. Did you mean {expected}?",
    purposeEmpty: "{key} is empty. Apple asks for a purpose string that says why the app needs this access, and it must not be blank.",
    purposePlaceholder: "{key} looks like placeholder text: “{value}”. Purpose strings must clearly and completely describe how the app uses the data (App Review Guideline 5.1.1).",
    purposeTooLong: "{key} is {n} bytes. Apple's limit for a purpose string is under 4,000 bytes.",
    noEncryptionKey: "No ITSAppUsesNonExemptEncryption key, so App Store Connect asks the export compliance questions for every build. Set it to NO if the app uses no encryption, or only exempt encryption such as HTTPS through the system.",
    encryptionNoCode: "ITSAppUsesNonExemptEncryption is YES and there is no ITSEncryptionExportComplianceCode. Apple gives you that code after it reviews your export compliance documents.",
    platformUnknown: "This file does not say which platform it is for. Choose the platform (--platform ios or --platform mac) to run the platform checks.",
    noLaunchScreen: "No launch screen. App Store Connect refuses builds made with the iOS 27 SDK or later without UILaunchScreen, UILaunchScreens, UILaunchStoryboardName or UILaunchStoryboards (ITMS-90870).",
    noLaunchScreenOldSdk: "No launch screen. This build uses an SDK older than iOS 27, so it can still upload, but once you build with the iOS 27 SDK App Store Connect refuses it without one (ITMS-90870).",
    noLaunchScreenProject: "No launch screen key in this file. Xcode adds one if the Launch Screen (Generation) or Launch Screen Interface File Base Name build setting is set; otherwise builds made with the iOS 27 SDK or later are refused on upload (ITMS-90870).",
    badOrientation: "{key} contains “{value}”, which is not one of Apple's four orientation values.",
    ipadOrientations: "On iPad the app leaves out {value}. App Store Connect accepts that, but Apple asks apps that run in resizable iPad windows to support all orientations.",
    requiresFullScreen: "UIRequiresFullScreen is deprecated from iPadOS 26. With the iOS 27 SDK it no longer keeps the app out of resizable windows. Apple's TN3192 explains how to move off it, or how to keep it for older systems with UIRequiresFullScreenIgnoredStartingWithVersion.",
    minimumOSInProject: "MinimumOSVersion is set in a project Info.plist. Apple says not to: Xcode takes it from the Deployment Target.",
    badCapability: "UIRequiredDeviceCapabilities has “{value}”, which is not on Apple's list of values.",
    healthkitCapability: "UIRequiredDeviceCapabilities requires healthkit, which limits the app to iPhone. Remove it to ship on iPad as well.",
    capabilitiesUpdates: "Required device capabilities: {value}. An update can keep or drop these but not add new ones, or people who already have the app could not run the update.",
    badBackgroundMode: "UIBackgroundModes has “{value}”, which is not on Apple's list of background modes.",
    querySchemes50: "LSApplicationQueriesSchemes lists {n} schemes. Apple limits apps linked on iOS 15 or later to 50 entries, and apps linked on iOS 27 or later to 25.",
    querySchemes25: "LSApplicationQueriesSchemes lists {n} schemes. Apple limits apps linked on iOS 27 or later to 25 entries.",
    noCategory: "No LSApplicationCategoryType. The Mac App Store refuses the upload: “The Info.plist must contain a LSApplicationCategoryType key, whose value is the UTI for a valid category.” Set App Category in the target's General tab.",
    noCategoryProject: "No LSApplicationCategoryType in this file. Xcode adds it if App Category is set in the target's General tab; the Mac App Store needs it.",
    badCategory: "LSApplicationCategoryType “{value}” is not one of Apple's category values, such as public.app-category.productivity.",
    badCategoryCase: "LSApplicationCategoryType “{value}” is not a valid category. Did you mean {expected}?",
    badMinimumSystem: "LSMinimumSystemVersion “{value}” should be a version number such as 13.0.",
  },
};

const zh = {
  specsNote: "规则取自 Apple 的 Information Property List 文档和 App Store Connect 上传提示，核对于 {date}。每条提示旁都链接到对应的 Apple 页面。",
  ios: "iOS / iPadOS",
  mac: "macOS",
  parseError: "这不是有效的属性列表：{detail}",
  readAs: "识别为：{kind}，{platform}{sdk}",
  kindBuilt: "构建好的应用",
  kindProject: "项目里的文件",
  platformUnknownShort: "平台不明",
  sdkPart: "，用 SDK {sdk} 构建",
  extensionNote: "这是应用扩展的 Info.plist，只适用于应用本身的检查（启动屏、类别、出口合规）已跳过。",
  noIssues: "没有要改的地方。这里检查的这些键，对 App Store 上传来说都没问题。",
  errorsTitle: "会被拒绝或格式有误",
  warningsTitle: "提交前请修正或核对",
  infoTitle: "值得知道",
  appleLink: "Apple 文档",
  forumLink: "Apple 开发者论坛",
  summary: "错误 {errors}，警告 {warnings}，提示 {info}",
  readFailed: "无法读取 {file}：{detail}",
  types: {
    string: "字符串",
    boolean: "布尔值（<true/> 或 <false/>）",
    array: "数组",
    dict: "字典",
    integer: "整数",
    real: "实数",
    date: "日期",
    data: "data",
    unknown: "未知类型",
  },
  issues: {
    notDict: "Info.plist 顶层必须是 <dict>。",
    empty: "文件里没有任何键。",
    platformMismatch: "这个文件看起来是 {value} 应用。检查按你选的平台进行。",
    unexpandedVariable: "{key} 还是 {value}。构建好的应用里，Xcode 应该已经替换掉这个构建设置变量：请确认该设置在这个 target 和构建配置下有值。",
    projectVariables: "这是项目里的 Info.plist，有 {n} 个 $(…) 构建设置变量。这很正常，Xcode 构建时会填入。想检查最终值，请检查构建好的应用里的 Info.plist。",
    wrongType: "{key} 应该是{expected}，这里是{value}。",
    missingKey: "这个构建好的应用缺少 {key}。",
    projectMissing: "文件里没有：{value}。如果打开了 Generate Info.plist File 构建设置，项目里缺少这些没关系，Xcode 会从构建设置里补上。不确定的话，请检查构建好的应用里的 Info.plist。",
    emptyValue: "{key} 是空的。",
    emptyStoryboardName: "UILaunchStoryboardName 是空的，没有指向任何 storyboard。请填 storyboard 的文件名（不带 .storyboard），或改用 UILaunchScreen。",
    shortVersionFormat: "CFBundleShortVersionString “{value}” 只能包含数字和英文句点，例如 1.4.2。",
    shortVersionParts: "CFBundleShortVersionString “{value}” 超过三段数字。Apple 规定的格式是 主版本.次版本.修订号，例如 1.4.2。",
    buildFormat: "CFBundleVersion “{value}” 只能包含数字和英文句点，例如 42 或 1.4.2。",
    buildParts: "CFBundleVersion “{value}” 超过三段数字，多出的部分系统会忽略。",
    bundleIdChars: "CFBundleIdentifier “{value}” 只能包含英文字母（A–Z、a–z）、数字、连字符和英文句点。",
    packageType: "CFBundlePackageType 是 {value}。应用应为 APPL。",
    bundleNameLong: "CFBundleName “{value}” 超过 15 个字符，这是 Apple 对这个短名称的上限。较长的名称请放在 CFBundleDisplayName。",
    purposeKeyCase: "{key} 不会被读取：键名区分大小写。是不是想写 {expected}？",
    purposeEmpty: "{key} 是空的。Apple 要求用途说明讲清楚应用为什么需要这项权限，不能留空。",
    purposePlaceholder: "{key} 像是占位文字：“{value}”。用途说明必须清楚完整地说明应用如何使用这些数据（App 审核指南 5.1.1）。",
    purposeTooLong: "{key} 有 {n} 字节。Apple 对用途说明的上限是不到 4,000 字节。",
    noEncryptionKey: "没有 ITSAppUsesNonExemptEncryption，每次上传构建 App Store Connect 都会问出口合规问题。如果应用不用加密，或只用系统提供的 HTTPS 这类豁免加密，设为 NO 即可。",
    encryptionNoCode: "ITSAppUsesNonExemptEncryption 是 YES，但没有 ITSEncryptionExportComplianceCode。这个代码由 Apple 审核你的出口合规文件后提供。",
    platformUnknown: "从文件里看不出是哪个平台。请指定平台（--platform ios 或 --platform mac），以运行平台相关检查。",
    noLaunchScreen: "没有启动屏。用 iOS 27 或更新 SDK 构建的应用，如果没有 UILaunchScreen、UILaunchScreens、UILaunchStoryboardName 或 UILaunchStoryboards，App Store Connect 会拒绝上传（ITMS-90870）。",
    noLaunchScreenOldSdk: "没有启动屏。这个构建用的 SDK 早于 iOS 27，现在还能上传；改用 iOS 27 SDK 构建后，没有启动屏会被 App Store Connect 拒绝（ITMS-90870）。",
    noLaunchScreenProject: "文件里没有启动屏相关的键。如果设置了 Launch Screen (Generation) 或 Launch Screen Interface File Base Name 构建设置，Xcode 会补上；否则用 iOS 27 或更新 SDK 构建时上传会被拒（ITMS-90870）。",
    badOrientation: "{key} 里有 “{value}”，不是 Apple 列出的四个方向值之一。",
    ipadOrientations: "在 iPad 上，应用没有支持 {value}。App Store Connect 会接受，但 Apple 要求在 iPad 可调整大小窗口里运行的应用支持所有方向。",
    requiresFullScreen: "UIRequiresFullScreen 从 iPadOS 26 起已弃用。用 iOS 27 SDK 构建时，它不再让应用免于窗口缩放。Apple 的 TN3192 说明了如何迁移，或如何用 UIRequiresFullScreenIgnoredStartingWithVersion 只在旧系统上保留它。",
    minimumOSInProject: "项目的 Info.plist 里写了 MinimumOSVersion。Apple 说不要这样做：Xcode 会取 Deployment Target 的值。",
    badCapability: "UIRequiredDeviceCapabilities 里有 “{value}”，不在 Apple 列出的取值里。",
    healthkitCapability: "UIRequiredDeviceCapabilities 要求 healthkit，这会让应用只能装在 iPhone 上。想同时上架 iPad，请去掉它。",
    capabilitiesUpdates: "要求的设备能力：{value}。更新时只能保留或去掉，不能新增，否则已经装了应用的人可能无法运行更新。",
    badBackgroundMode: "UIBackgroundModes 里有 “{value}”，不在 Apple 列出的后台模式里。",
    querySchemes50: "LSApplicationQueriesSchemes 列了 {n} 个 scheme。Apple 规定用 iOS 15 或更新 SDK 链接的应用最多 50 个，用 iOS 27 或更新 SDK 链接的最多 25 个。",
    querySchemes25: "LSApplicationQueriesSchemes 列了 {n} 个 scheme。Apple 规定用 iOS 27 或更新 SDK 链接的应用最多 25 个。",
    noCategory: "没有 LSApplicationCategoryType。Mac App Store 会拒绝上传：“The Info.plist must contain a LSApplicationCategoryType key, whose value is the UTI for a valid category.” 请在 target 的 General 标签里设置 App Category。",
    noCategoryProject: "文件里没有 LSApplicationCategoryType。如果在 target 的 General 标签里设置了 App Category，Xcode 会补上；Mac App Store 需要它。",
    badCategory: "LSApplicationCategoryType “{value}” 不是 Apple 的类别取值（例如 public.app-category.productivity）。",
    badCategoryCase: "LSApplicationCategoryType “{value}” 不是有效类别。是不是想写 {expected}？",
    badMinimumSystem: "LSMinimumSystemVersion “{value}” 应该是 13.0 这样的版本号。",
  },
};

/** @typedef {"en" | "zh"} Lang */
export const messages = { en, zh };

/** Fills {name} placeholders from `values`; unknown placeholders are left as they are. */
export function fill(/** @type {string} */ text, /** @type {Record<string, unknown>} */ values) {
  return text.replace(/\{(\w+)\}/g, (m, name) => (values[name] === undefined ? m : String(values[name])));
}

/**
 * The readable message for one issue, with the Apple page behind it when the issue has one.
 * @param {{ code: string, key?: string, value?: string, expected?: string, n?: number, source?: string }} issue
 * @param {Lang} [lang]
 * @returns {{ message: string, link: string | undefined }}
 */
export function formatIssue(issue, lang = "en") {
  const copy = messages[lang] ?? messages.en;
  const text = /** @type {Record<string, string>} */ (copy.issues)[issue.code] ?? issue.code;
  const types = /** @type {Record<string, string>} */ (copy.types);
  // wrongType carries type names ("string", "boolean"...) that read better as words.
  const values = issue.code === "wrongType" ? { ...issue, value: types[issue.value ?? ""] ?? issue.value, expected: types[issue.expected ?? ""] ?? issue.expected } : issue;
  const link = issue.source ? /** @type {Record<string, string>} */ (SOURCES)[issue.source] : undefined;
  return { message: fill(text, values), link };
}
