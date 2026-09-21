# 📱 BlocksTracker Mobile

Mobile companion app for [BlocksTracker](https://blocks-tracker.com/)
--- a privacy-first, offline-first habit + task tracker.

Built with **React Native**, backed by an embedded SQLite database.

## ⚙️ Tech Stack

-   **React Native CLI**
-   **TypeScript**
-   **SQLite** via `react-native-nitro-sqlite`
-   **React Context API** for state management

## 🚀 Getting Started

``` bash
npm install
npx pod-install    # iOS only
npx react-native run-android   # or run-ios
```

## ⚙️ Configuration

Create a `.env` file in the root directory of the project. For local
development (Android Emulator), use:

``` env
API_URL=http://10.0.2.2:5000
```

## 🐛 Debugging

### Inspecting the Local Database (Android)

To inspect the contents of the local SQLite database on an Android
emulator or device, you can copy the database file to your computer
using the following command:

``` bash
adb exec-out run-as com.blockstrackerapp cat files/blockstracker.sqlite > ~/Work/blockstracker.sqlite
```

You can open the `blockstracker.sqlite` file with any SQLite database
browser or with the VS Code SQLite extension.

### Debug and Release Builds

The debug and release builds use separate Android application IDs so
they can be installed on the same device without sharing the same app
installation or local database.

-   **Debug:** `com.blockstrackerapp.debug`
-   **Release:** `com.blockstrackerapp`

The debug build uses the standard debug signing configuration.

For local release testing, the `release` build type is temporarily
configured to use the **debug signing configuration**. This is only for
testing locally and must be changed back to the proper release signing
configuration before distributing a production release.

Example:

``` gradle
buildTypes {
    debug {
        applicationIdSuffix ".debug"
        versionNameSuffix "-debug"
        signingConfig signingConfigs.debug
    }

    release {
        // Local testing only:
        signingConfig signingConfigs.debug

        // Production release:
        // signingConfig signingConfigs.release

        minifyEnabled enableProguardInReleaseBuilds
        proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
    }
}
```

**Important:** Never use the debug signing configuration for a
production/public release.

### Testing a Release Build on a Physical Android Device

To test the release APK on a physical Android device without using USB,
Android's **Wireless Debugging** can be used.

#### 1. Enable Wireless Debugging

On the Android device:

1.  Enable **Developer options**.
2.  Open **Developer options → Wireless debugging**.
3.  Turn on **Wireless debugging**.
4.  Select **Pair device with pairing code**.
5.  Note the IP address and pairing port shown by Android.

#### 2. Pair the Device

From the development machine, run:

``` bash
adb pair <PHONE_IP>:<PAIRING_PORT>
```

Enter the pairing code shown on the phone.

For example:

``` bash
adb pair 192.168.1.25:37099
```

After pairing, connect to the device if it does not appear
automatically:

``` bash
adb connect <PHONE_IP>:<ADB_PORT>
```

Then verify the connection:

``` bash
adb devices
```

The physical device should appear in the list.

#### 3. Build the Release APK

From the project root:

``` bash
cd android
./gradlew assembleRelease
```

The APK will be generated at:

``` text
android/app/build/outputs/apk/release/app-release.apk
```

#### 4. Install the Release APK

If multiple Android devices are connected, first run:

``` bash
adb devices
```

Identify the physical phone's device ID, then install specifically to
that device:

``` bash
adb -s '<DEVICE_ID>' install -r android/app/build/outputs/apk/release/app-release.apk
```

For example:

``` bash
adb -s 'adb-34181FDH2004PQ-rG6QhP._adb-tls-connect._tcp' install -r android/app/build/outputs/apk/release/app-release.apk
```

The `-r` option updates the existing installation while preserving its
application data.

#### 5. Launch the Release App

Launch BlocksTracker with:

``` bash
adb -s '<DEVICE_ID>' shell monkey -p com.blockstrackerapp 1
```

For example:

``` bash
adb -s 'adb-34181FDH2004PQ-rG6QhP._adb-tls-connect._tcp' shell monkey -p com.blockstrackerapp 1
```

### ⚠️ Protecting Real BlocksTracker Data

If the release installation on your physical phone contains real todos
and habits:

-   Do **not** run `adb uninstall com.blockstrackerapp`.
-   Do **not** run `adb shell pm clear com.blockstrackerapp`.
-   Do **not** clear the app's storage from Android Settings.
-   Avoid running `npm run android` against the physical phone when you
    intend to use the release installation. This launches the
    development/debug build.
-   When multiple devices are connected, always specify the target
    device with `adb -s <DEVICE_ID>`.

The debug build should use `com.blockstrackerapp.debug`, while the
release build uses `com.blockstrackerapp`. This allows both versions to
coexist on the same Android device with separate application data.

## 🎨 Custom Fonts (Android)

To copy fonts from `src/assets` to the Android application:

1.  Place font files (e.g., `.ttf`, `.otf`) in:
    `android/app/src/main/assets/fonts` (Create the directory if it
    doesn't exist).

2.  Rebuild the application:

    ``` bash
    cd android && ./gradlew clean
    cd ..
    npx react-native run-android
    ```

## 📦 Features

-   Offline-first task and habit tracking
-   Local database (no account required)
-   Sync-ready architecture

## 📄 License

BlocksTracker is free and open-source software, licensed under the
[GPLv3](https://www.gnu.org/licenses/gpl-3.0.html).
