import { Platform } from 'react-native';

export const MapboxRouteMap = Platform.OS === 'web'
  ? require('./MapboxRouteMap.web').MapboxRouteMap
  : require('./MapboxRouteMap.native').MapboxRouteMap;
