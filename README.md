# info-plist-checker

Checks an iOS or Mac app's `Info.plist` before you upload it to App Store Connect. It reads XML and binary plists,
tells a project `Info.plist` from the one inside a built app, and lists what the upload or App Review would refuse,
what is malformed, and what is worth knowing. Each message links to the Apple page the rule comes from.

- Command line tool and a small JavaScript library, zero dependencies, Node 18 or later.
- Same rules as the web version at [obelisk.club/tools/info-plist-checker](https://obelisk.club/tools/info-plist-checker)
  (same issue codes, same severities). Try it in the browser: the file never leaves your machine.
- Rules checked on **2026-10-31**. Apple changes its rules; if one here is out of date, a PR is welcome.

## What it checks

The checker first works out what it is looking at: a **built** `Info.plist` (it has the `DT…` keys Xcode adds) or a
**project** file (where `$(VARIABLES)` are normal), the platform (iOS or macOS, from the file or `--platform`), the SDK
the app was built with, and whether it is an app extension (app-only checks are skipped for extensions).

**Errors** (the upload would be refused, or the file is malformed)

- The top level is not a dictionary, or the file has no keys.
- `$(...)` / `${...}` build-setting variables left unexpanded in a built app.
- Wrong value types for the keys it reads (for example `CFBundleVersion` as an integer, `ITSAppUsesNonExemptEncryption` as a string).
- Missing `CFBundleIdentifier`, `CFBundleShortVersionString` or `CFBundleVersion` in a built app; empty values.
- `CFBundleShortVersionString` not in Apple's format (digits and periods, at most three numbers, such as `1.4.2`).
- `CFBundleVersion` with anything other than digits and periods.
- `CFBundleIdentifier` with characters other than letters, digits, hyphens and periods.
- Purpose strings (`NS…UsageDescription`): blank, placeholder text (`TODO`, `<#…#>`, the key name itself, …), 4,000 bytes
  or longer, not a string, or a key name with the wrong case (`NSCameraUsagedescription` is never read).
- iOS: no launch screen key in an app built with the iOS 27 SDK or later (ITMS-90870).
- macOS: missing or empty `LSApplicationCategoryType` in a built app, or a value that is not one of Apple's categories
  (with a suggestion when only the case is wrong).

**Warnings** (fix or check before you submit)

- Missing `CFBundleExecutable` or `CFBundlePackageType` in a built app; `CFBundlePackageType` other than `APPL` for an app.
- `CFBundleVersion` with more than three numbers (the system ignores the rest).
- iOS: no launch screen in a build made with an SDK older than iOS 27, or in a project file; an empty `UILaunchStoryboardName`.
- iOS: orientation values, `UIRequiredDeviceCapabilities` values or `UIBackgroundModes` values that are not on Apple's lists.
- iOS: more than 25 or more than 50 `LSApplicationQueriesSchemes` entries (Apple's limits for apps linked on iOS 27 and iOS 15).
- macOS: missing or empty `LSApplicationCategoryType` in a project file; `LSMinimumSystemVersion` that is not a version number.
- The file looks like it is for a different platform than the one you asked for.

**Notes** (worth knowing)

- A project file with `$(...)` values, or without core keys that Xcode adds at build time.
- No `ITSAppUsesNonExemptEncryption` (App Store Connect then asks the export compliance questions for every build), or
  `YES` without `ITSEncryptionExportComplianceCode`.
- `CFBundleName` longer than 15 characters.
- iOS: an iPad app that leaves out some orientations; `UIRequiresFullScreen` (deprecated) without
  `UIRequiresFullScreenIgnoredStartingWithVersion`; `MinimumOSVersion` set in a project file; `healthkit` as a required
  capability (iPhone only); a reminder that an update cannot add required device capabilities.
- The platform could not be told from the file.

The full list of issue codes is `ISSUE_CODES` in [`src/info-plist-checker.mjs`](src/info-plist-checker.mjs), with the
Apple page behind each rule in `SOURCES` and in the comments at the top of that file.

It only sees one file. It cannot tell whether the icons, storyboard or entitlements in the bundle match, whether the
bundle ID is registered in your account, or anything about signing. A clean result is one step, not a guarantee.

## Install

No npm release yet; install from GitHub.

```sh
# run once, nothing to install
npx github:peterzhang0216/info-plist-checker path/to/Info.plist

# or add it to a project
npm i -D github:peterzhang0216/info-plist-checker
npx info-plist-check path/to/Info.plist
```

Where to find the file: in a built iOS app it is `YourApp.app/Info.plist`; in a Mac app,
`YourApp.app/Contents/Info.plist`. For an `.ipa`, unzip it and look in `Payload/YourApp.app/Info.plist`.

## Command line

```
info-plist-check <Info.plist | -> [--platform ios|mac] [--lang en|zh] [--json]
```

| Option | |
| --- | --- |
| `-` | Read the plist from stdin |
| `--platform ios\|mac` | Run the checks for this platform instead of the one read from the file |
| `--lang en\|zh` | Messages in English (default) or Simplified Chinese |
| `--json` | Machine-readable output |

Exit codes: `0` no errors (warnings and notes do not fail), `1` at least one error or not a valid plist, `2` usage
problem or the file could not be read.

Sample output, for a built iOS app with a few mistakes ([`test/fixtures/broken-ios-built.plist`](test/fixtures/broken-ios-built.plist)):

```
$ info-plist-check Notebook.app/Info.plist
Notebook.app/Info.plist
Read as: built app, iOS / iPadOS, built with SDK 27 (xml plist)

Will be refused or is malformed (6)
  - [unexpandedVariable] CFBundleShortVersionString still holds $(MARKETING_VERSION). In a built app Xcode should have replaced this build-setting variable: check that the setting has a value for this target and build configuration.
    https://developer.apple.com/documentation/bundleresources/managing-your-app-s-information-property-list
  - [buildFormat] CFBundleVersion “1.0b3” may contain only digits and periods, like 42 or 1.4.2.
    https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleversion
  - [bundleIdChars] CFBundleIdentifier “com.example.note_book” may contain only letters (A–Z, a–z), digits, hyphens and periods.
    https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleidentifier
  - [purposeEmpty] NSCameraUsageDescription is empty. Apple asks for a purpose string that says why the app needs this access, and it must not be blank.
    https://developer.apple.com/documentation/uikit/requesting-access-to-protected-resources
  - [purposeKeyCase] NSMicrophoneUsagedescription is never read: key names are case-sensitive. Did you mean NSMicrophoneUsageDescription?
    https://developer.apple.com/documentation/uikit/requesting-access-to-protected-resources
  - [noLaunchScreen] No launch screen. App Store Connect refuses builds made with the iOS 27 SDK or later without UILaunchScreen, UILaunchScreens, UILaunchStoryboardName or UILaunchStoryboards (ITMS-90870).
    https://developer.apple.com/documentation/technotes/tn3208-preparing-your-apps-launch-screen-to-meet-app-store-requirements

Fix or check before you submit (1)
  - [badBackgroundMode] UIBackgroundModes has “background-fetch”, which is not on Apple's list of background modes.
    https://developer.apple.com/documentation/bundleresources/information-property-list/uibackgroundmodes

Worth knowing (1)
  - [noEncryptionKey] No ITSAppUsesNonExemptEncryption key, so App Store Connect asks the export compliance questions for every build. Set it to NO if the app uses no encryption, or only exempt encryption such as HTTPS through the system.
    https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations

Errors: 6, warnings: 1, notes: 1
Rules are from Apple's Information Property List documentation and App Store Connect upload messages, checked on 2026-10-31. Each message links to the Apple page behind it.
```

With `--json`:

```json
{
  "file": "Notebook.app/Info.plist",
  "ok": true,
  "format": "xml",
  "kind": "built",
  "platform": "ios",
  "extension": false,
  "sdk": 27,
  "specsCheckedOn": "2026-10-31",
  "counts": { "error": 6, "warning": 1, "info": 1 },
  "issues": [
    {
      "severity": "error",
      "code": "buildFormat",
      "value": "1.0b3",
      "message": "CFBundleVersion “1.0b3” may contain only digits and periods, like 42 or 1.4.2.",
      "link": "https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleversion"
    }
  ]
}
```

(`issues` shortened here.) `ok` means the file was read as a plist; whether it passes is in `counts.error` (and the exit code). When the input is not a valid plist, the JSON is `{ "ok": false, "error": "parse", "detail": "…" }`.

## In CI

Check the `Info.plist` of the app you are about to upload, after Xcode has filled in the build settings:

```yaml
# GitHub Actions, macOS runner
- name: Archive
  run: xcodebuild archive -scheme Notebook -archivePath build/Notebook.xcarchive -destination 'generic/platform=iOS'

- name: Check Info.plist
  run: npx --yes github:peterzhang0216/info-plist-checker build/Notebook.xcarchive/Products/Applications/Notebook.app/Info.plist
```

For a Mac app the path is `…/Products/Applications/Notebook.app/Contents/Info.plist`. App extensions have their own
`Info.plist` under `Notebook.app/PlugIns/*.appex/`; check each one the same way. To keep builds reproducible, pin a
commit or tag: `github:peterzhang0216/info-plist-checker#<commit>`.

## Library

```js
import { readFileSync } from "node:fs";
import { checkInput, formatIssue } from "info-plist-checker";

const result = checkInput(new Uint8Array(readFileSync("Notebook.app/Info.plist")));
if (!result.ok) throw new Error(result.detail ?? result.error);

console.log(result.kind, result.platform, result.sdk); // "built" "ios" 27
for (const issue of result.issues) {
  const { message, link } = formatIssue(issue, "en");
  console.log(issue.severity, issue.code, message, link);
}
```

Main exports:

- `checkInput(input, { platform? })`: parses a `string` (XML) or `Uint8Array` (XML or binary) and checks it. Returns
  `{ ok: true, format, kind, platform, extension, sdk, issues }` or `{ ok: false, error, detail? }`. A pasted snippet of
  `<key>…</key>` lines without the surrounding `<plist><dict>` is wrapped first. `platform` is `"ios"`, `"mac"` or `"any"`.
- `checkInfoPlist(value, { platform? })`: the same checks on an already parsed plist (a plain object).
- `parsePlist(input)`: the XML and binary parser on its own. Returns `{ ok: true, value, format }` or `{ ok: false, error }`.
  Also exported from `info-plist-checker/plist`.
- `ISSUE_CODES`: every code the checker can return. `SOURCES`: the Apple page for each `issue.source`.
- `messages`: `{ en, zh }` text for every issue code; `formatIssue(issue, lang)` fills one in and returns
  `{ message, link }`. Also exported from `info-plist-checker/messages`.
- `specsCheckedOn`: the date the rules were last checked against Apple's pages.

Each issue is `{ severity: "error" | "warning" | "info", code, key?, value?, expected?, n?, source? }`.

## 中文说明

检查 iOS 或 Mac 应用的 `Info.plist`，在上传 App Store Connect 之前找出会被拒绝、格式有误或值得注意的地方，每条提示都附上对应的 Apple 文档链接。支持 XML 和二进制 plist，能区分项目里的文件和构建好的应用里的文件。规则与网页版 [obelisk.club/tools/info-plist-checker](https://obelisk.club/tools/info-plist-checker) 相同；网页版在浏览器里运行，文件不会离开你的电脑。

```sh
npx github:peterzhang0216/info-plist-checker path/to/Info.plist --lang zh
```

有错误时退出码为 1，可以直接放进 CI。规则核对于 2026-10-31；Apple 的规则会变，发现过时的地方欢迎提 PR。

## License

[MIT](LICENSE) © 2026 Peter Zhang
