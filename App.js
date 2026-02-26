import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator, StatusBar,
  TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ScrollView, Animated, Switch
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BlurView } from 'expo-blur';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const HISTORY_KEY = '@aqi_search_history';
const THEME_KEY = '@aqi_theme';

// ─── Themes ────────────────────────────────────────────────────────────────
const DARK = {
  bg: '#050510',
  surface: 'rgba(25, 25, 45, 0.7)',
  surfaceAlt: 'rgba(40, 40, 70, 0.5)',
  border: 'rgba(0, 242, 255, 0.4)',
  text: '#ffffff',
  muted: '#a0a0ff',
  accent: '#00f2ff', // Neon Cyan
  accentAlt: '#ff00f2', // Neon Magenta
  toggleBg: 'rgba(0, 242, 255, 0.2)',
  toggleText: '☀️',
  glow: '#00f2ff',
};

const LIGHT = {
  bg: '#eff3ff',
  surface: 'rgba(255, 255, 255, 0.85)',
  surfaceAlt: 'rgba(235, 238, 255, 0.7)',
  border: 'rgba(92, 103, 255, 0.25)',
  text: '#1a1b4b',
  muted: '#6a6b9a',
  accent: '#5c67ff', // Vibrant Indigo
  accentAlt: '#ff5c8d', // Bright Pink/Coral
  toggleBg: 'rgba(92, 103, 255, 0.15)',
  toggleText: '🌙',
  glow: '#5c67ff',
};

// ─── AQI meta ───────────────────────────────────────────────────────────────
const getAqiMeta = (v) => {
  if (!v && v !== 0) return { text: '--', color: '#7a7a9a', bg: 'rgba(122,122,154,0.12)', emoji: '❓', tip: '' };
  if (v <= 20) return { text: 'Good', color: '#00c853', bg: 'rgba(0,200,83,0.12)', emoji: '😊', tip: 'Air quality is excellent — enjoy outdoors!' };
  if (v <= 40) return { text: 'Fair', color: '#ffd600', bg: 'rgba(255,214,0,0.12)', emoji: '🙂', tip: 'Acceptable for most people.' };
  if (v <= 60) return { text: 'Moderate', color: '#ff6d00', bg: 'rgba(255,109,0,0.12)', emoji: '😐', tip: 'Sensitive groups may be affected.' };
  if (v <= 80) return { text: 'Poor', color: '#d50000', bg: 'rgba(213,0,0,0.12)', emoji: '😷', tip: 'Limit outdoor activity.' };
  if (v <= 100) return { text: 'Very Poor', color: '#aa00ff', bg: 'rgba(170,0,255,0.12)', emoji: '🤢', tip: 'Stay indoors if possible.' };
  return { text: 'Hazardous', color: '#7e0023', bg: 'rgba(126,0,35,0.15)', emoji: '☠️', tip: 'Avoid ALL outdoor activity!' };
};

// ─── Weather meta ────────────────────────────────────────────────────────────
const getWeatherMeta = (code) => {
  if (code === 0) return { text: 'Clear Sky', emoji: '☀️', color: '#ffea00' };
  if (code <= 3) return { text: 'Partly Cloudy', emoji: '⛅', color: '#90caf9' };
  if (code <= 48) return { text: 'Foggy', emoji: '🌫️', color: '#b0bec5' };
  if (code <= 55) return { text: 'Drizzle', emoji: '🌦️', color: '#81d4fa' };
  if (code <= 65) return { text: 'Rainy', emoji: '🌧️', color: '#4fc3f7' };
  if (code <= 75) return { text: 'Snowy', emoji: '❄️', color: '#e1f5fe' };
  if (code <= 82) return { text: 'Showers', emoji: '☔', color: '#29b6f6' };
  return { text: 'Stormy', emoji: '⛈️', color: '#5c6bc0' };
};

// ─── Component ──────────────────────────────────────────────────────────────
export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [locationName, setLocationName] = useState('');
  const [aqiData, setAqiData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('aqi');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  const C = isDark ? DARK : LIGHT;

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(THEME_KEY);
      if (saved !== null) setIsDark(saved === 'dark');
    })();
    requestNotifPermissions();
    loadHistory();
    checkCurrentLocationAirQuality();
  }, []);

  const toggleTheme = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  };

  const startPulse = () => {
    if (pulseLoop.current) pulseLoop.current.stop();
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.055, duration: 950, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 950, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  };

  const requestNotifPermissions = async () => {
    await Notifications.requestPermissionsAsync();
  };

  const loadHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem(HISTORY_KEY);
      if (saved) setSearchHistory(JSON.parse(saved));
    } catch (e) { }
  };

  const saveToHistory = async (newItem, currentHistory) => {
    try {
      const filtered = currentHistory.filter(
        i => i.name.toLowerCase() !== newItem.name.toLowerCase()
      );
      const updated = [newItem, ...filtered].slice(0, 6);
      setSearchHistory(updated);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (e) { }
  };

  const triggerAlert = async (aqiValue) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ Poor Air Quality`,
        body: `AQI ${aqiValue} — ${getAqiMeta(aqiValue).text}. ${getAqiMeta(aqiValue).tip}`,
      },
      trigger: null,
    });
  };

  const fetchAqiData = async (lat, lon, locName) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const aqiRes = await axios.get(
        `https://air-quality-api.open-meteo.com/v1/air-quality` +
        `?latitude=${lat}&longitude=${lon}` +
        `&current=european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide` +
        `&hourly=european_aqi&timezone=auto`
      );

      const weatherRes = await axios.get(
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure` +
        `&timezone=auto`
      );

      const { current, hourly } = aqiRes.data;
      const currentWeather = weatherRes.data.current;

      if (current?.european_aqi !== undefined) {
        setAqiData(current);
        setWeatherData(currentWeather);
        setLocationName(locName);

        const next24h = hourly.time.slice(0, 24).map((t, i) => ({
          time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          aqi: hourly.european_aqi[i],
        }));
        setForecast(next24h);
        startPulse();

        if (current.european_aqi > 50) {
          await triggerAlert(current.european_aqi);
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        setSearchHistory(prev => {
          saveToHistory({ name: locName, lat, lon }, prev);
          return prev;
        });
      } else {
        setErrorMsg('No AQI data returned for this location.');
      }
    } catch (err) {
      setErrorMsg('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkCurrentLocationAirQuality = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission denied.');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      await fetchAqiData(loc.coords.latitude, loc.coords.longitude, 'My Location 📍');
    } catch (e) {
      setErrorMsg('Could not get location.');
      setLoading(false);
    }
  };

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setErrorMsg(null);
    try {
      const geo = await axios.get(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=1&language=en&format=json`
      );
      if (geo.data.results?.length > 0) {
        const r = geo.data.results[0];
        setSearchQuery('');
        await fetchAqiData(r.latitude, r.longitude, `${r.name}, ${r.country}`);
      } else {
        setErrorMsg('City not found. Try a different spelling.');
        setLoading(false);
      }
    } catch (e) {
      setErrorMsg('Search error: ' + e.message);
      setLoading(false);
    }
  };

  const meta = getAqiMeta(aqiData?.european_aqi);

  // Dynamic styles that depend on theme or AQI
  const d = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: C.bg },
    header: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    headerTitle: { fontSize: 32, fontWeight: '900', color: C.text, letterSpacing: -0.5, textShadowColor: isDark ? C.glow : 'transparent', textShadowRadius: 10 },
    headerSub: { fontSize: 13, color: C.muted, marginTop: -2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.6)', borderRadius: 16, borderWidth: 1, borderColor: C.border, paddingHorizontal: 15 },
    input: { flex: 1, color: C.text, fontSize: 16, paddingVertical: 14, fontWeight: '500' },
    searchBtn: { backgroundColor: C.accent, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 16, shadowColor: C.accent, shadowRadius: 8, shadowOpacity: 0.4 },
    locBtn: { backgroundColor: C.surface, paddingHorizontal: 15, justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
    mainCard: { backgroundColor: C.surface, borderRadius: 24, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: C.border, shadowColor: C.glow || '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: isDark ? 0.6 : 0.1, shadowRadius: 15, elevation: 12, overflow: 'hidden' },
    locName: { fontSize: 18, color: C.accent, textAlign: 'center', marginBottom: 20, fontWeight: '700', textShadowColor: C.glow, textShadowRadius: 8 },
    aqiCircle: { width: 180, height: 180, borderRadius: 90, borderWidth: 3, borderColor: meta.color, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : meta.bg, marginBottom: 14, shadowColor: meta.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12 },
    aqiNum: { fontSize: 52, fontWeight: '900', color: meta.color, textShadowColor: meta.color, textShadowRadius: 10 },
    aqiLabel: { fontSize: 15, fontWeight: '700', marginTop: 2, color: meta.color },
    aqiTip: { fontSize: 13, color: C.text, textAlign: 'center', marginBottom: 20, paddingHorizontal: 10, opacity: 0.8 },
    divider: { height: 1, backgroundColor: C.border, marginBottom: 20, opacity: 0.5 },
    gridCell: { width: '47%', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : C.surfaceAlt, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
    gridLabel: { fontSize: 12, color: C.muted, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
    gridVal: { fontSize: 20, fontWeight: '800', color: C.text, textShadowColor: isDark ? C.accent : 'transparent', textShadowRadius: 4 },
    gridUnit: { fontSize: 11, color: C.muted, marginTop: 2 },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 12, letterSpacing: 0.3 },
    forecastCard: { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)', borderRadius: 16, padding: 14, marginRight: 12, alignItems: 'center', minWidth: 85, borderWidth: 1, borderColor: C.border },
    forecastTime: { fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: '500' },
    historyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
    historyText: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
    historyArrow: { fontSize: 20, color: C.muted },
    toggleBtn: { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 15, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
    tabBar: { flexDirection: 'row', backgroundColor: isDark ? 'transparent' : C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: Platform.OS === 'ios' ? 35 : 25, paddingTop: 15, justifyContent: 'space-around', shadowColor: C.accent, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 20, position: 'absolute', bottom: 0, left: 0, right: 0 },
    tabItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    tabText: { fontSize: 12, fontWeight: '700', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    activeTabIndicator: { position: 'absolute', top: -15, width: '50%', height: 4, backgroundColor: C.accent, borderRadius: 4, shadowColor: C.accent, shadowRadius: 10, shadowOpacity: 0.8 },
    weatherMainCard: { backgroundColor: isDark ? 'transparent' : C.surface, borderRadius: 24, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: C.border, alignItems: 'center', shadowColor: C.accentAlt || C.glow, shadowRadius: 15, shadowOpacity: 0.6, elevation: 12, overflow: 'hidden' },
  });

  return (
    <SafeAreaProvider>
      <SafeAreaView style={d.safeArea} edges={['top']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={d.header}>
            <View>
              <Text style={d.headerTitle}>AQI Explorer</Text>
              <Text style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Real-time Air Quality</Text>
            </View>
            {/* Theme Toggle */}
            <TouchableOpacity style={d.toggleBtn} onPress={toggleTheme} activeOpacity={0.75}>
              <Text style={{ fontSize: 22 }}>{C.toggleText}</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[s.searchRow]}>
            <View style={d.inputWrap}>
              <Text style={s.searchIcon}>🔍</Text>
              <TextInput
                style={d.input}
                placeholder="Search any city..."
                placeholderTextColor={C.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={searchLocation}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity style={d.searchBtn} onPress={searchLocation} activeOpacity={0.8}>
              <Text style={s.searchBtnText}>Go</Text>
            </TouchableOpacity>
            <TouchableOpacity style={d.locBtn} onPress={checkCurrentLocationAirQuality} activeOpacity={0.8}>
              <Text style={{ fontSize: 20 }}>📍</Text>
            </TouchableOpacity>
          </View>

          {errorMsg ? (
            <View style={s.errorBanner}>
              <Text style={s.errorText}>⚠ {errorMsg}</Text>
            </View>
          ) : null}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[s.scroll]}
          >
            {loading && (
              <View style={s.loaderWrap}>
                <ActivityIndicator size="large" color={C.accent} />
                <Text style={{ color: C.muted, fontSize: 14, marginTop: 12 }}>Fetching data…</Text>
              </View>
            )}

            {/* AQI Tab Content */}
            {activeTab === 'aqi' && aqiData && !loading && (
              <View>
                <BlurView intensity={isDark ? 40 : 0} tint={isDark ? "dark" : "light"} style={d.mainCard}>
                  <Text style={d.locName}>{locationName}</Text>

                  <Animated.View style={[d.aqiCircle, { transform: [{ scale: pulseAnim }] }]}>
                    <Text style={{ fontSize: 30, marginBottom: 4 }}>{meta.emoji}</Text>
                    <Text style={d.aqiNum}>{aqiData.european_aqi}</Text>
                    <Text style={d.aqiLabel}>{meta.text}</Text>
                  </Animated.View>

                  <Text style={d.aqiTip}>{meta.tip}</Text>
                  <View style={d.divider} />

                  <View style={s.grid}>
                    {[
                      { label: 'PM2.5', val: aqiData.pm2_5, unit: 'µg/m³', icon: '💨' },
                      { label: 'PM10', val: aqiData.pm10, unit: 'µg/m³', icon: '🌫️' },
                      { label: 'NO₂', val: aqiData.nitrogen_dioxide, unit: 'µg/m³', icon: '🏭' },
                      { label: 'CO', val: aqiData.carbon_monoxide, unit: 'µg/m³', icon: '🔥' },
                    ].map(item => (
                      <View key={item.label} style={d.gridCell}>
                        <Text style={{ fontSize: 22, marginBottom: 4 }}>{item.icon}</Text>
                        <Text style={d.gridLabel}>{item.label}</Text>
                        <Text style={d.gridVal}>
                          {item.val !== undefined ? Number(item.val).toFixed(1) : '--'}
                        </Text>
                        <Text style={d.gridUnit}>{item.unit}</Text>
                      </View>
                    ))}
                  </View>
                </BlurView>

                {/* 24h Forecast */}
                {forecast.length > 0 && (
                  <View style={{ marginBottom: 24 }}>
                    <Text style={d.sectionTitle}>24-Hour Forecast</Text>
                    <FlatList
                      data={forecast}
                      keyExtractor={(_, i) => i.toString()}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingLeft: 2, paddingBottom: 4 }}
                      renderItem={({ item }) => {
                        const fm = getAqiMeta(item.aqi);
                        return (
                          <View style={d.forecastCard}>
                            <Text style={d.forecastTime}>{item.time}</Text>
                            <Text style={{ fontSize: 20, marginBottom: 4 }}>{fm.emoji}</Text>
                            <Text style={[{ fontSize: 20, fontWeight: '800' }, { color: fm.color }]}>
                              {item.aqi ?? '--'}
                            </Text>
                          </View>
                        );
                      }}
                    />
                  </View>
                )}
              </View>
            )}

            {/* Weather Tab Content */}
            {activeTab === 'weather' && weatherData && !loading && (
              <View>
                <BlurView intensity={isDark ? 40 : 0} tint={isDark ? "dark" : "light"} style={d.weatherMainCard}>
                  <Text style={d.locName}>{locationName}</Text>
                  <Text style={{ fontSize: 64, marginBottom: 8 }}>{getWeatherMeta(weatherData.weather_code).emoji}</Text>
                  <Text style={{ fontSize: 48, fontWeight: '800', color: C.text, textShadowColor: C.accentAlt, textShadowRadius: 10 }}>{Math.round(weatherData.temperature_2m)}°C</Text>
                  <Text style={{ fontSize: 18, color: C.accentAlt, fontWeight: '700', textTransform: 'uppercase' }}>{getWeatherMeta(weatherData.weather_code).text}</Text>
                </BlurView>

                <View style={s.grid}>
                  {[
                    { label: 'Feels Like', val: Math.round(weatherData.apparent_temperature), unit: '°C', icon: '🌡️' },
                    { label: 'Humidity', val: weatherData.relative_humidity_2m, unit: '%', icon: '💧' },
                    { label: 'Wind Speed', val: weatherData.wind_speed_10m, unit: 'km/h', icon: '💨' },
                    { label: 'Pressure', val: Math.round(weatherData.surface_pressure), unit: 'hPa', icon: '🏘️' },
                  ].map(item => (
                    <View key={item.label} style={d.gridCell}>
                      <Text style={{ fontSize: 22, marginBottom: 4 }}>{item.icon}</Text>
                      <Text style={d.gridLabel}>{item.label}</Text>
                      <Text style={d.gridVal}>{item.val}</Text>
                      <Text style={d.gridUnit}>{item.unit}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Search History (Show on both tabs if relevant, or just AQI) */}
            {searchHistory.length > 0 && !loading && (
              <View style={{ marginTop: 10, marginBottom: 20 }}>
                <Text style={d.sectionTitle}>Recent Searches</Text>
                {searchHistory.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={d.historyRow}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      fetchAqiData(item.lat, item.lon, item.name);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 16, marginRight: 10 }}>🕑</Text>
                    <Text style={d.historyText}>{item.name}</Text>
                    <Text style={d.historyArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Bottom Tab Bar */}
          <BlurView intensity={isDark ? 80 : 0} tint={isDark ? "dark" : "light"} style={d.tabBar}>
            <TouchableOpacity
              onPress={() => {
                setActiveTab('aqi');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={d.tabItem}
              activeOpacity={0.8}
            >
              {activeTab === 'aqi' && <View style={d.activeTabIndicator} />}
              <Text style={[s.tabIcon, { color: activeTab === 'aqi' ? C.accent : C.muted }]}>🌬️</Text>
              <Text style={[d.tabText, { color: activeTab === 'aqi' ? C.accent : C.muted }]}>Air Quality</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setActiveTab('weather');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={d.tabItem}
              activeOpacity={0.8}
            >
              {activeTab === 'weather' && <View style={d.activeTabIndicator} />}
              <Text style={[s.tabIcon, { color: activeTab === 'weather' ? C.accent : C.muted }]}>🌤️</Text>
              <Text style={[d.tabText, { color: activeTab === 'weather' ? (isDark ? C.accentAlt : C.accent) : C.muted }]}>Weather</Text>
            </TouchableOpacity>
          </BlurView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// Static styles (don't depend on theme)
const s = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 22,
    marginBottom: 16,
    gap: 8,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  errorBanner: {
    marginHorizontal: 22,
    marginBottom: 12,
    backgroundColor: 'rgba(239,83,80,0.12)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,83,80,0.3)',
  },
  errorText: {
    color: '#ef5350',
    fontSize: 14,
    textAlign: 'center',
  },
  loaderWrap: {
    alignItems: 'center',
    marginTop: 60,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingBottom: 100, // Extra space for glassy tab bar
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tabIcon: {
    fontSize: 22,
  },
});
