import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from './SplashScreen';

const Stack = createNativeStackNavigator();

const TREASURE = {
  latitude: -23.11453,
  longitude: -45.70785,
};

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getBearing(lat1, lon1, lat2, lon2) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

function MainApp() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [steps, setSteps] = useState(0);
  const [hint, setHint] = useState('Procure o tesouro!');
  const [found, setFound] = useState(false);

  const arrowAnim = useRef(new Animated.Value(0)).current;
  const backgroundColor = useRef(new Animated.Value(0)).current;
  const soundRef = useRef(null);
  const watchSubscription = useRef(null);

  async function playSound() {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3' }
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (e) {
      console.log('Erro ao tocar som:', e);
    }
  }

  const updateHint = (distSteps) => {
    if (distSteps < 10) setHint('Muito quente! Está quase lá!');
    else if (distSteps < 25) setHint('Quente! Está perto!');
    else if (distSteps < 50) setHint('Morno! Continue procurando.');
    else setHint('Frio! Está longe do tesouro.');
  };

  const animateBackground = (distSteps) => {
    let targetValue = 0;
    if (distSteps < 10) targetValue = 3; 
    else if (distSteps < 25) targetValue = 2; 
    else if (distSteps < 50) targetValue = 1; 
    else targetValue = 0; 

    Animated.timing(backgroundColor, {
      toValue: targetValue,
      duration: 400,
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) setErrorMsg('Permissão de localização negada');
          return;
        }

        if (Platform.OS === 'web') {
          const mockLocation = {
            coords: { latitude: -23.11500, longitude: -45.70800, accuracy: 10, heading: 0 },
            timestamp: Date.now()
          };
          if (isMounted) setLocation(mockLocation);

          const interval = setInterval(() => {
            if (isMounted && !found) {
              const newLocation = {
                coords: {
                  latitude: mockLocation.coords.latitude - 0.00001,
                  longitude: mockLocation.coords.longitude - 0.00001,
                  accuracy: 10,
                  heading: Math.random() * 360
                },
                timestamp: Date.now()
              };
              setLocation(newLocation);
              mockLocation.coords = newLocation.coords;
            }
          }, 500);
          
          return () => clearInterval(interval);
        } else {
          watchSubscription.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.BestForNavigation,
              distanceInterval: 0.5,
              timeInterval: 500,
            },
            (newLocation) => {
              if (isMounted) setLocation(newLocation);
            }
          );
        }
      } catch (error) {
        if (isMounted) setErrorMsg('Erro ao obter localização: ' + error.message);
      }
    })();

    return () => {
      isMounted = false;
      if (watchSubscription.current) watchSubscription.current.remove();
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, [found]);

  useEffect(() => {
    if (location && !found) {
      const dist = getDistanceMeters(
        location.coords.latitude,
        location.coords.longitude,
        TREASURE.latitude,
        TREASURE.longitude
      );
      const stepsCalc = Math.max(0, dist / 0.5); 
      setSteps(stepsCalc);

      updateHint(stepsCalc);
      animateBackground(stepsCalc);

      if (dist < 2) {
        setFound(true);
        playSound();
      }

      const heading = location.coords.heading || 0;
      const brng = getBearing(
        location.coords.latitude,
        location.coords.longitude,
        TREASURE.latitude,
        TREASURE.longitude
      );

      const rotation = (brng - heading + 360) % 360;

      Animated.spring(arrowAnim, {
        toValue: rotation,
        useNativeDriver: true,
        friction: 7,
      }).start();
    }
  }, [location, found]);

  const interpolatedColor = backgroundColor.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: ['#87CEFA', '#ADD8E6', '#FFA500', '#FF4500'] // Frio → Morno → Quente → Muito quente
  });

  if (errorMsg) {
    return (
      <View style={[styles.container, { backgroundColor: '#fff' }]}>
        <Text>{errorMsg}</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor: interpolatedColor }]}>
      <Text style={styles.title}>Caça ao Tesouro</Text>
      <Text style={styles.hint}>{hint}</Text>
      <Text style={styles.steps}>Distância: {steps.toFixed(1)} passos</Text>
      
      <View style={styles.arrowContainer}>
        <Animated.View
          style={[
            styles.arrowWrapper,
            {
              transform: [
                {
                  rotate: arrowAnim.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg']
                  })
                }
              ]
            }
          ]}
        >
          <Text style={styles.arrow}>↑</Text>
        </Animated.View>
      </View>
      
      {found && (
        <View style={styles.foundContainer}>
          <Text style={styles.foundText}>Tesouro encontrado! 🎉</Text>
        </View>
      )}

      {Platform.OS === 'web' && (
        <View style={styles.webNote}>
          <Text style={styles.webNoteText}>
            Modo de demonstração para web - use em dispositivo móvel para GPS real
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Main" component={MainApp} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  hint: { fontSize: 22, marginBottom: 10, textAlign: 'center', color: '#333' },
  steps: { fontSize: 18, marginBottom: 30, color: '#333' },
  arrowContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 30, height: 150, width: 150 },
  arrowWrapper: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 60, color: '#333', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  foundContainer: { marginTop: 20, padding: 15, backgroundColor: 'rgba(255,215,0,0.8)', borderRadius: 10 },
  foundText: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  webNote: { marginTop: 30, padding: 10, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 5 },
  webNoteText: { fontSize: 14, color: '#666', textAlign: 'center' },
});