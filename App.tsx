import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/theme/ThemeContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0F0A1E" />
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
