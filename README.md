# 🌬️ AQI Explorer - React Native Expo App

A premium, cross-platform React Native utility application that lets users monitor real-time air quality indices (AQI) and weather conditions anywhere in the world. Built with **Expo** and enhanced with a **Glassy Neon UI**, featuring haptic feedback, local push notifications, and rich environmental data from the Open-Meteo API.

---

## 📸 Screenshots

| Air Quality (Dark) | Weather (Dark) | Air Quality (Light) | Weather (Light) |
|:---:|:---:|:---:|:---:|
| <img src="./img/Dark1.jpeg" width="180"> | <img src="./img/Dark2.jpeg" width="180"> | <img src="./img/light1.jpeg" width="180"> | <img src="./img/light2.jpeg" width="180"> |

---

## ✨ Features

- **📑 Dual-Tab Navigation:** Seamlessly switch between **Air Quality** and **Detailed Weather** views with a floating glassy tab bar.
- **✨ Glassy Neon UI:** A modern aesthetic using `expo-blur` for frosted-glass effects and neon glow highlights.
- **🌤️ Integrated Weather:** Real-time data for Temperature, Feels Like, Humidity, Wind Speed, and Surface Pressure.
- **🌍 Global City Search:** Powered by Open-Meteo's Geocoding API, letting you look up any location intuitively.
- **📍 Current Location:** Tap the location button to automatically fetch data where you are right now.
- **🎨 Dynamic Theming:** 
  - **Neon Cyberpunk:** Dark mode with glowing cyan and magenta accents.
  - **Vibrant Pastel:** A clean, glassy light mode with indigo and coral highlights.
- **📱 Haptics & Notifications:** Tactile feedback on all interactions and local system alerts for hazardous air quality.
- **📊 Detailed Breakdowns:** PM2.5, PM10, NO₂, and CO levels with explanatory health tips.
- **🕒 24-Hour Forecast:** Horizontal timeline for AQI predictions.

---

## 🛠️ Required Tech Stack

- **React Native / Expo SDK (v54+)**
- **UI & Animations:**
  - `expo-blur` (Glassmorphism effects)
  - `expo-linear-gradient`
  - `Animated` API (Pulsing indicators)
- **API:**
  - [Open-Meteo Air Quality & Weather API](https://open-meteo.com/)
- **Expo Native Modules:**
  - `expo-location`
  - `expo-notifications`
  - `expo-haptics`
  - `@react-native-async-storage/async-storage`

---

## 🚀 Getting Started

### 1. Prerequisites
Make sure you have Node.js installed, and install the **Expo Go** application on your device.

### 2. Installations
```bash
# Clone the repository
git clone https://github.com/anurag375/AirAlert.git
cd AirAlert

# Install dependencies
npm install
```

### 3. Running the App
```bash
npx expo start
```
Scan the QR code with **Expo Go** (Android) or the **Camera App** (iOS).

---

## ⚠️ Known Limitations
- **Background Tasks:** Notifications trigger when the app is active or upon manual fetch; background fetch is not implemented in this version.
- **Expo Go:** Local notifications are used to ensure maximum compatibility without needing a full development build.

---

*Made for the Clash of Coders Hackathon 2026*
