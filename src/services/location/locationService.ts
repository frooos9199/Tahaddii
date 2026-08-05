import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const NEARBY_ROOM_RADIUS_KM = 25;

const toRadians = (degrees: number) => degrees * (Math.PI / 180);

export const getDistanceKm = (from: Coordinates, to: Coordinates) => {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(to.latitude - from.latitude);
  const lonDelta = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);

  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const requestAndroidLocationPermission = async () => {
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

export const getCurrentCoordinates = async (): Promise<Coordinates> => {
  if (Platform.OS === 'android') {
    const granted = await requestAndroidLocationPermission();
    if (!granted) {
      throw new Error('Location permission is required for nearby rooms');
    }
  }

  if (Platform.OS === 'ios') {
    await new Promise<void>((resolve, reject) => {
      Geolocation.requestAuthorization(resolve, reject);
    });
  }

  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      () => reject(new Error('Unable to get your location right now')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
};