# 🌬️ AQI Explorer - React Native Expo App

A premium, cross-platform React Native utility application that lets users monitor real-time air quality indices (AQI) anywhere in the world. Built entirely with **Expo**, featuring a dynamic Dark/Light theme, haptic feedback, local push notifications, and rich environmental data straight from the Open-Meteo API.

---

## ✨ Features

- **🌍 Global City Search:** Powered by Open-Meteo's Geocoding API, letting you look up the air quality of almost any location intuitively.
- **📍 Current Location:** Tap the location button to automatically fetch AQI where you are right now using native GPS permissions (`expo-location`).
- **🎨 Dynamic Theming:** Comes with beautiful Nature-Light and Midnight-Dark themes. Your preference is automatically persisted locally using `AsyncStorage`.
- **🚦 Color-Coded Indicators:** The main UI features a large pulsing circle that smoothly shifts from Green (Good) to Purple/Red (Hazardous) so you understand the air quality without reading a number.
- **📱 Haptics & Notifications:** Uses `expo-haptics` to provide rich physical tactile feedback, and `expo-notifications` to trigger local system banners when a toxic AQI value is read.
- **📊 Extended Pollutant Breakdown:** Detailed values for Particulate Matter (PM2.5, PM10), Nitrogen Dioxide ($NO_2$), and Carbon Monoxide ($CO$).
- **🕒 24-Hour Forecast:** Scrollable horizontal timeline displaying predicted air quality for the next full day.
- **🕒 Search History:** The app automatically saves your last 5 searches locally. Just tap them to instantly reload.

---

## 🛠️ Required Tech Stack

- **React Native / Expo SDK**
- **API:**
  - [Open-Meteo Air Quality API](https://open-meteo.com/) (European AQI standard)
  - [Open-Meteo Geocoding API](https://open-meteo.com/)
- **State & Packages:**
  - `axios` (API requests)
  - `@react-native-async-storage/async-storage` (Offline persistence)
- **Expo Native Modules:**
  - `expo-location`
  - `expo-notifications`
  - `expo-haptics`

---

## 🚀 Getting Started

### 1. Prerequisites
Make sure you have Node.js installed, and install the **Expo Go** application on your physical iOS or Android device.

### 2. Installations
Clone the repository and install the NPM packages:
```bash
# Navigate to the correct folder
cd aqi-app

# Install all dependencies
npm install
```

### 3. Running the App
Start the Expo development server:
```bash
npx expo start
```
Once the server starts running, it will generate a QR code in your terminal. 
- **On Android**: Open the Expo Go app and select "Scan QR code".
- **On iOS**: Open your device Camera, point it at the QR code, and tap the prompt to open it in Expo Go.

---

## ⚠️ Known Limitations
- **Background Processes:** This app does not run background tasks; you must open the app or press fetch to trigger the local AQI notification alert.
- **Remote Push:** Expo Go no longer natively supports *remote* push notifications out-of-the-box in SDK 53+. The app is configured strictly to rely on *local* notifications, ensuring compatibility across all Expo Go testers. 

---

*Made for the Clash of Coders Hackathon 2026*
