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
  bg: '#0f0f13',
  surface: '#1a1a24',
  surfaceAlt: '#22222f',
  border: '#2e2e3e',
  text: '#f0f0f5',
  muted: '#7a7a9a',
  accent: '#6c63ff',
  toggleBg: '#22222f',
  toggleText: '☀️',
};

const LIGHT = {
  bg: '#f0f4f0',
  surface: '#ffffff',
  surfaceAlt: '#e8f5e9',
  border: '#d0e8d0',
  text: '#1a2e1a',
  muted: '#5a7a5a',
  accent: '#2e7d32',
  toggleBg: '#c8e6c9',
  toggleText: '🌙',
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

// ─── Component ──────────────────────────────────────────────────────────────
export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [locationName, setLocationName] = useState('');
  const [aqiData, setAqiData] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
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
      const res = await axios.get(
        `https://air-quality-api.open-meteo.com/v1/air-quality` +
        `?latitude=${lat}&longitude=${lon}` +
        `&current=european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide` +
        `&hourly=european_aqi&timezone=auto`
      );
      const { current, hourly } = res.data;

      if (current?.european_aqi !== undefined) {
        setAqiData(current);
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
    headerTitle: { fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: 0.5 },
    headerSub: { fontSize: 13, color: C.muted, marginTop: 2 },
    inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12 },
    input: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 13 },
    searchBtn: { backgroundColor: C.accent, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 14 },
    locBtn: { backgroundColor: C.surface, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: C.border },
    mainCard: { backgroundColor: C.surface, borderRadius: 24, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0.4 : 0.1, shadowRadius: 12, elevation: 8 },
    locName: { fontSize: 17, color: C.muted, textAlign: 'center', marginBottom: 20, fontWeight: '500' },
    aqiCircle: { width: 180, height: 180, borderRadius: 90, borderWidth: 5, borderColor: meta.color, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: meta.bg, marginBottom: 14 },
    aqiNum: { fontSize: 52, fontWeight: '900', lineHeight: 56, color: meta.color },
    aqiLabel: { fontSize: 15, fontWeight: '700', marginTop: 2, color: meta.color },
    aqiTip: { fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 20, paddingHorizontal: 10 },
    divider: { height: 1, backgroundColor: C.border, marginBottom: 20 },
    gridCell: { width: '47%', backgroundColor: C.surfaceAlt, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
    gridLabel: { fontSize: 12, color: C.muted, fontWeight: '600', marginBottom: 4 },
    gridVal: { fontSize: 20, fontWeight: '800', color: C.text },
    gridUnit: { fontSize: 11, color: C.muted, marginTop: 2 },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 12, letterSpacing: 0.3 },
    forecastCard: { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginRight: 10, alignItems: 'center', minWidth: 76, borderWidth: 1, borderColor: C.border },
    forecastTime: { fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: '500' },
    historyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
    historyText: { flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },
    historyArrow: { fontSize: 20, color: C.muted },
    toggleBtn: { backgroundColor: C.toggleBg, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: C.border },
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
                <Text style={{ color: C.muted, fontSize: 14, marginTop: 12 }}>Fetching air quality…</Text>
              </View>
            )}

            {/* Main AQI Card */}
            {aqiData && !loading && (
              <View style={d.mainCard}>
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
              </View>
            )}

            {/* 24h Forecast */}
            {forecast.length > 0 && !loading && (
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

            {/* Search History */}
            {searchHistory.length > 0 && (
              <View style={{ marginBottom: 20 }}>
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
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
