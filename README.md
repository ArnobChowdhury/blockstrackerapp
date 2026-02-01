# 📱 BlocksTracker Mobile

Mobile companion app for [BlocksTracker](https://blocks-tracker.com/) — a privacy-first, offline-first habit + task tracker.

Built with **React Native**, backed by an embedded SQLite database.

## ⚙️ Tech Stack

- **React Native CLI**
- **TypeScript**
- **SQLite** via `react-native-nitro-sqlite`
- **React Context API** for state management

## 🚀 Getting Started

```bash
npm install
npx pod-install    # iOS only
npx react-native run-android   # or run-ios
```

## ⚙️ Configuration

Create a .env file in the root directory of the project. For local development (Android Emulator), use:

```
API_URL=http://10.0.2.2:5000
```

## 🐛 Debugging

### Inspecting the Local Database (Android)

To inspect the contents of the local SQLite database on an Android emulator or device, you can copy the database file to your computer using the following command:

```bash
adb exec-out run-as com.blockstrackerapp cat files/blockstracker.sqlite > ~/Work/blockstracker.sqlite

```

You can open the `blockstracker.sqlite` file with any SQLite database browser or with VS Code SQLite extension.

## 🎨 Custom Fonts (Android)

To copy fonts from `src/assets` to the Android application:

1. Place font files (e.g., `.ttf`, `.otf`) in:
   `android/app/src/main/assets/fonts`
   (Create the directory if it doesn't exist).

2. Rebuild the application:
   ```bash
   cd android && ./gradlew clean
   cd ..
   npx react-native run-android
   ```

## 📦 Features

- Offline-first task and habit tracking
- Local database (no account required)
- Sync-ready architecture

## 📄 License

BlocksTracker is free and open-source software, licensed under the [GPLv3](https://www.gnu.org/licenses/gpl-3.0.html).
