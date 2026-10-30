# Build verification summary

Goal: deliver install-once Android MVP source with deterministic input parsing and a reproducible debug APK build recipe.

Tests run here: JDK `javac` + `java` parser tests (17 cases); XML parse validation; static security scans; source file SHA-256 reproduction. The runtime did not contain an Android SDK / Gradle, and the shell network was unavailable, so a full APK build and actual-device test were **not** performed locally. Do not mistake the source archive for an installable APK.

Parameters: package `ai.decisionos.aside`; min SDK 26; target/compile SDK 35; AGP 8.7.3; Gradle 8.10.2; Java 17; no backend URL. Duplicate criterion: relative pathname (unique). Calendar denominator: N/A. Seed: N/A.

Android build artifacts: `app/build/outputs/apk/debug/app-debug.apk`; GitHub Actions artifact `Aside-Mobile-Debug-APK` when CI successfully runs.

Known risk: Android 13+ restricted accessibility settings for sideloaded apps; microphone use from a background accessibility service varies by OS/OEM, Korean local speech pack may be absent; accessibility text for custom WebViews may be inaccessible; no public Play policy compliance claim.
