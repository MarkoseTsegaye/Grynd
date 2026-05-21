# my-app

A cross-platform mobile application built with [Expo](https://expo.dev) (SDK 54), React Native, and TypeScript.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/) + React Native 0.81 |
| Navigation | [Expo Router v6](https://docs.expo.dev/router/introduction/) (file-based) |
| Styling | [NativeWind v4](https://www.nativewind.dev/) (Tailwind CSS for React Native) |
| State Management | [Zustand v5](https://zustand-demo.pmnd.rs/) |
| Animations | [React Native Reanimated v4](https://docs.swmansion.com/react-native-reanimated/) |
| Language | TypeScript 5.9 |
| Build & Deploy | [EAS Build](https://docs.expo.dev/build/introduction/) |

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [npm](https://www.npmjs.com/) 9+ (or yarn)
- [Expo CLI](https://docs.expo.dev/more/expo-cli/) — `npm install -g expo-cli`
- For iOS: Xcode 15+ (macOS only)
- For Android: Android Studio with an emulator, or a physical device

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/MarkoseTsegaye/my-app.git
cd my-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the development env file and fill in any required values:

```bash
cp .env.development .env.local
```

### 4. Start the development server

```bash
npm start
```

Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with [Expo Go](https://expo.dev/go).

---

## Available Scripts

| Command | Description |
|---|---|
| `npm start` | Start the Expo dev server (development env) |
| `npm run start:tunnel` | Start with tunnel (for physical devices on different networks) |
| `npm run start:prod` | Start against the production environment |
| `npm run android` | Build and run on an Android emulator/device |
| `npm run ios` | Build and run on an iOS simulator/device |
| `npm run build:prod` | Trigger an EAS production build |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Lint `src/` and `app/` with ESLint |

---

## Project Structure

```
my-app/
├── app/            # Expo Router screens (file-based routing)
├── src/            # Shared components, hooks, stores, utilities
├── assets/         # Static assets (images, fonts, icons)
├── .claude/        # AI agent context
├── app.config.ts   # Expo dynamic config
├── app.json        # Expo static config
├── tailwind.config.ts
└── tsconfig.json
```

---

## Building for Production

This project uses [EAS Build](https://docs.expo.dev/build/introduction/) for production builds.

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in to your Expo account
eas login

# Trigger a production build
npm run build:prod
```

Build profiles are configured in `eas.json`. Refer to the [EAS documentation](https://docs.expo.dev/build/eas-json/) for customization.

---

## Environment Variables

| File | Purpose |
|---|---|
| `.env.development` | Variables loaded in development (`npm start`) |
| `.env.production` | Variables loaded in production builds |

> **Never commit secrets.** Add sensitive values to `.gitignore` and use EAS Secrets for CI/CD.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to your branch: `git push origin feat/your-feature`
5. Open a Pull Request

Before submitting, make sure the following pass:

```bash
npm run typecheck
npm run lint
```

---

## License

This project is private. All rights reserved.
