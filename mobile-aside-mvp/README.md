# Aside Mobile — Android MVP v0.1

An install-once prototype to drive a phone's browser, SMS composer, dialer and simple on-screen controls from a floating panel. Native Android Java, zero third-party runtime dependencies.

## Required phone

Android 8.0+ (API 26+), preferably Android 12+ for on-device Korean speech recognition. Not for iOS. Google Play release is **not** included; test only through debug APK sideload.

## What works

| Command | Result |
| --- | --- |
| `네이버 열어`, `구글 열어`, `유튜브 열어`, `브라우저 example.com` | Browser via `ACTION_VIEW` |
| `문자 01012345678 안녕하세요` | Opens default SMS **composer**, never sends |
| `전화 01012345678` | Opens dialer, never places call |
| `화면 읽어` | Reads a bounded, locally redacted accessibility text tree |
| `클릭 검색` | Clicks a matching accessible UI control |
| `입력 단어` | Inserts text into focused **non-password** editable input |
| `뒤로`, `홈`, `아래로`, `위로` | Android navigation/gesture |
| Tap microphone in overlay | Uses OS on-device speech recognizer **only when available**, Android 12+ |

No LLM or natural-language planning yet; command parsing is deterministic. No `INTERNET` permission; no network call in app; no background event logging; no SMS or call direct permissions. Password fields and authentication/payment/submit/send controls are intentionally excluded from automated handling. SMS/phone sensitive actions require a human tap.

## Build locally

Install Android Studio (JDK 17, Android SDK Platform 35). Open this project and select **Build → Build APK(s)**, or with Gradle 8.10.2 installed:

```bash
gradle :app:assembleDebug
# output: app/build/outputs/apk/debug/app-debug.apk
```

GitHub Actions config is `.github/workflows/android-debug-apk.yml` at the **repository root** in the isolated experimental branch; it builds `mobile-aside-mvp/` and uploads `Aside-Mobile-Debug-APK` artifact.

## Direct download (public GitHub Release)

- **APK:** https://github.com/hang154/OpenCLI/releases/download/aside-mobile-v0.1/Aside-Mobile-v0.1.apk
- **Release page:** https://github.com/hang154/OpenCLI/releases/tag/aside-mobile-v0.1

The APK is a *debug test build*, not a Play Store package. Its signature may change between CI builds, so Android may require uninstalling a previous debug installation before installing an update. The release download works without accessing private CI artifacts.

## Install and test

1. Download the APK to the phone, open the file, and allow installation from the source app if Android asks. If device policy blocks sideloading, use ADB: `adb install -r app-debug.apk`.
2. Launch **Aside Mobile**. Read the disclosure and check the consent checkbox.
3. Press **접근성 설정 열기**, find **Aside 화면 조작 서비스** and enable it. On Android 13+ if the switch is disabled, go to **Settings → Apps → Aside Mobile → ⋮ → Allow restricted settings** first (menu varies by OEM), then return to Accessibility.
4. Open Chrome or the default browser. Tap the floating **ASIDE ●** bubble. Type `화면 읽어`, `아래로`, or `클릭 검색`.
5. Try `문자 01012345678 테스트` and `전화 01012345678` with a **test number**; these only open SMS composer or dialer. Do **not** manually send/place a call to an arbitrary real number.
6. To test voice on compatible Android 12+ devices, allow Microphone from inside Aside app, then press 🎤. If the device has no on-device recognizer or Korean language pack, text input still works.
7. Disable the accessibility service from Android Settings when finished.

### Known limitations

- This is not a full universal agent and is not guaranteed to work in apps that hide their accessibility tree, use custom canvas views, or display secure/system windows.
- Android OEMs may restrict sideloaded accessibility services.
- Accessibility overlay and microphone availability can vary across devices; needs actual-phone testing. No emulator/phone test has been run in this build environment.
- Users initiate every command; no autonomous agent execution. Google Play's Accessibility policy restricts autonomous AI agent plans/actions, so future releases require a policy-compliant redesign, not just a new model.
- Local speech-recognition service is provided by the OS; the app requests specifically an on-device recognizer but cannot audit the OS vendor implementation.

## Code and tests

- `app/src/main/java/ai/decisionos/aside/CommandParser.java` — pure Java parser.
- `CommandRouter.java` — Android intents and safe dispatch.
- `AsideAccessibilityService.java` — accessibility windows, overlay, gestures and speech.
- `MainActivity.java` — onboarding disclosure/consent and manual test controls.
- `scripts/test_parser.sh` — JDK-only parser tests.
- `scripts/reproduce_result_file.py` — outputs and hashes; compares against baseline when provided.
- `reports/RESULT_FILE_README.md` — assumptions and validation summary.
