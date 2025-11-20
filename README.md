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

## 🐛 Debugging

### Inspecting the Local Database (Android)

To inspect the contents of the local SQLite database on an Android emulator or device, you can copy the database file to your computer using the following command:

```bash
adb exec-out run-as com.blockstrackerapp cat files/blockstracker.sqlite > ~/Work/blockstracker.sqlite

```

You can open the `blockstracker.sqlite` file with any SQLite database browser or with VS Code SQLite extension.

## 📦 Features

- Offline-first task and habit tracking
- Local database (no account required)
- Sync-ready architecture

## 📄 License

BlocksTracker is free and open-source software, licensed under the [GPLv3](https://www.gnu.org/licenses/gpl-3.0.html).
