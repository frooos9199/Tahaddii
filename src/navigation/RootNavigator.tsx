import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import LanguageSelectScreen from '../screens/LanguageSelectScreen';
import HomeScreen from '../screens/HomeScreen';
import GameModeSelectScreen from '../screens/GameModeSelectScreen';
import AddPlayersScreen from '../screens/AddPlayersScreen';
import AgeGroupSelectScreen from '../screens/AgeGroupSelectScreen';
import CategorySelectScreen from '../screens/CategorySelectScreen';
import DifficultySelectScreen from '../screens/DifficultySelectScreen';
import GameSetupScreen from '../screens/GameSetupScreen';
import TvPairingScannerScreen from '../screens/TvPairingScannerScreen';
import GameScreen from '../screens/GameScreen';
import ResultsScreen from '../screens/ResultsScreen';
import StatisticsScreen from '../screens/StatisticsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import OnlinePlayScreen from '../screens/OnlinePlayScreen';
import OnlineLobbyScreen from '../screens/OnlineLobbyScreen';
import OnlineGameScreen from '../screens/OnlineGameScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AdminPanelScreen from '../screens/AdminPanelScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  prefixes: ['tahaddi://'],
  config: {
    screens: {
      OnlinePlay: 'online/join/:roomCode',
    },
  },
};

export default function RootNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="GameModeSelect" component={GameModeSelectScreen} />
        <Stack.Screen name="AddPlayers" component={AddPlayersScreen} />
        <Stack.Screen name="AgeGroupSelect" component={AgeGroupSelectScreen} />
        <Stack.Screen name="CategorySelect" component={CategorySelectScreen} />
        <Stack.Screen name="DifficultySelect" component={DifficultySelectScreen} />
        <Stack.Screen name="GameSetup" component={GameSetupScreen} />
        <Stack.Screen name="TvPairingScanner" component={TvPairingScannerScreen} />
        <Stack.Screen name="Game" component={GameScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Results" component={ResultsScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Statistics" component={StatisticsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="OnlinePlay" component={OnlinePlayScreen} />
        <Stack.Screen name="OnlineLobby" component={OnlineLobbyScreen} />
        <Stack.Screen name="OnlineGame" component={OnlineGameScreen} />
        <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
