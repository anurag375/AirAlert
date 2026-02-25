import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, SafeAreaView, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Disable notification handling in Expo Go to prevent warnings
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: true,
//     shouldSetBadge: false,
//   }),
// });

const HISTORY_KEY = '@aqi_search_history';

export default function App() {
  const [locationName, setLocationName] = useState('Current Location');
  const [aqiData, setAqiData] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);

  useEffect(() => {
    // Only register for push notifications if not using Expo Go
    // registerForPushNotificationsAsync();
    loadHistory();
    checkCurrentLocationAirQuality();
  }, []);

  const loadHistory = async () => {
    try {
      const savedHistory = await AsyncStorage.getItem(HISTORY_KEY);
      if (savedHistory !== null) {
        setSearchHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error('Failed to load history', e);
    }
  };

  const saveToHistory = async (newItem) => {
    try {
      const isDuplicate = searchHistory.some(item => item.name.toLowerCase() === newItem.name.toLowerCase());
      if (isDuplicate) return;

      const updatedHistory = [newItem, ...searchHistory].slice(0, 5); // Keep last 5 searches
      setSearchHistory(updatedHistory);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
    } catch (e) {
      console.error('Failed to save history', e);
    }
  };

  const getAqiDescription = (value) => {
    if (value <= 20) return { text: 'Good', color: '#00e400' };
    if (value <= 40) return { text: 'Fair', color: '#ffff00' };
    if (value <= 60) return { text: 'Moderate', color: '#ff7e00' };
    if (value <= 80) return { text: 'Poor', color: '#ff0000' };
    if (value <= 100) return { text: 'Very Poor', color: '#8f3f97' };
    return { text: 'Extremely Poor', color: '#7e0023' };
  };

  const triggerAlert = async (aqiValue) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⚠️ High AQI Alert!",
        body: `The current Air Quality Index is ${aqiValue}. Consider staying indoors.`,
        sound: true,
      },
      trigger: null,
    });
  };

  const fetchAqiData = async (lat, lon, locName) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // European AQI includes PM10, PM2.5, Nitrogen Dioxide, Ozone, Sulphur Dioxide, etc. Hourly forecast for next 24h
      const response = await axios.get(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide&hourly=european_aqi&timezone=auto`
      );

      const { current, hourly } = response.data;

      if (current?.european_aqi !== undefined) {
        setAqiData(current);
        setLocationName(locName);

        // Map forecast data (next 24 hours)
        const next24h = hourly.time.slice(0, 24).map((time, index) => ({
          time: new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          aqi: hourly.european_aqi[index]
        }));
        setForecast(next24h);

        // Trigger notification and vibration if AQI > 50
        if (current.european_aqi > 50) {
          triggerAlert(current.european_aqi);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        saveToHistory({ name: locName, lat, lon });

      } else {
        setErrorMsg('Could not fetch AQI data for this location.');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkCurrentLocationAirQuality = async () => {
    try {
      setLoading(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        setLoading(false);
        return;
      }

      let locationData = await Location.getCurrentPositionAsync({});
      await fetchAqiData(locationData.coords.latitude, locationData.coords.longitude, 'Current Location');
    } catch (e) {
      setErrorMsg('Error getting current location: ' + e.message);
      setLoading(false);
    }
  };

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      // Open-Meteo Geocoding API
      const geoResponse = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=1&language=en&format=json`);
      if (geoResponse.data.results && geoResponse.data.results.length > 0) {
        const result = geoResponse.data.results[0];
        const fullName = `${result.name}, ${result.country}`;
        setSearchQuery('');
        await fetchAqiData(result.latitude, result.longitude, fullName);
      } else {
        setErrorMsg('Location not found. Please try another city.');
        setLoading(false);
      }
    } catch (e) {
      setErrorMsg('Error searching location: ' + e.message);
      setLoading(false);
    }
  };

  const handleHistoryPress = (item) => {
    fetchAqiData(item.lat, item.lon, item.name);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <Text style={styles.title}>AQI Explorer</Text>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.input}
            placeholder="Search a city..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={searchLocation}
          />
          <TouchableOpacity style={styles.searchButton} onPress={searchLocation}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.locationButton} onPress={checkCurrentLocationAirQuality}>
            <Text style={styles.locationButtonText}>📍</Text>
          </TouchableOpacity>
        </View>

        {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
        {loading && <ActivityIndicator size="large" color="#0000ff" style={{ marginVertical: 20 }} />}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {aqiData && !loading && (
            <View style={styles.card}>
              <Text style={styles.subtitle}>{locationName}</Text>

              <View style={styles.aqiContainer}>
                <Text style={styles.aqiValue}>{aqiData.european_aqi}</Text>
                <Text style={[styles.aqiLevel, { color: getAqiDescription(aqiData.european_aqi).color }]}>
                  {getAqiDescription(aqiData.european_aqi).text}
                </Text>
              </View>

              <View style={styles.detailsContainer}>
                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>PM2.5</Text>
                  <Text style={styles.detailValue}>{aqiData.pm2_5} µg/m³</Text>
                </View>
                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>PM10</Text>
                  <Text style={styles.detailValue}>{aqiData.pm10} µg/m³</Text>
                </View>
                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>NO2</Text>
                  <Text style={styles.detailValue}>{aqiData.nitrogen_dioxide} µg/m³</Text>
                </View>
                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>CO</Text>
                  <Text style={styles.detailValue}>{aqiData.carbon_monoxide} µg/m³</Text>
                </View>
              </View>
            </View>
          )}

          {forecast.length > 0 && !loading && (
            <View style={styles.forecastSection}>
              <Text style={styles.sectionTitle}>24h Forecast</Text>
              <FlatList
                data={forecast}
                keyExtractor={(item, index) => index.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.forecastItem}>
                    <Text style={styles.forecastTime}>{item.time}</Text>
                    <Text style={[styles.forecastAqi, { color: getAqiDescription(item.aqi).color }]}>{item.aqi}</Text>
                  </View>
                )}
              />
            </View>
          )}

          {searchHistory.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.sectionTitle}>Recent Searches</Text>
              {searchHistory.map((item, index) => (
                <TouchableOpacity key={index} style={styles.historyItem} onPress={() => handleHistoryPress(item)}>
                  <Text style={styles.historyText}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

async function registerForPushNotificationsAsync() {
  let token;
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 10,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    justifyContent: 'center',
    borderRadius: 8,
    marginRight: 10,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  locationButton: {
    backgroundColor: '#e5e5ea',
    paddingHorizontal: 15,
    justifyContent: 'center',
    borderRadius: 8,
  },
  locationButtonText: {
    fontSize: 18,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    marginBottom: 25,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#444',
    marginBottom: 10,
    textAlign: 'center',
  },
  aqiContainer: {
    alignItems: 'center',
    marginVertical: 15,
  },
  aqiValue: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#333',
  },
  aqiLevel: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 5,
  },
  detailsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  detailBox: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: 'bold',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  forecastSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  forecastItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginRight: 10,
    alignItems: 'center',
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  forecastTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  forecastAqi: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  historySection: {
    marginBottom: 20,
  },
  historyItem: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  historyText: {
    fontSize: 16,
    color: '#333',
  },
  error: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  }
});
