import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';

const TREASURE = {
  latitude: -23.11443,
  longitude: -45.70780,
};

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  // Haversine formula
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getBearing(lat1, lon1, lat2, lon2) {
  // Returns bearing in degrees from north
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

export default function TreasureHuntApp() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [steps, setSteps] = useState(0);
  const [hint, setHint] = useState('');
  const [bgColor, setBgColor] = useState('#87CEFA');
  const [bearing, setBearing] = useState(0);
  const [found, setFound] = useState(false);
  const soundRef = useRef(null);
  const arrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permissão de localização negada');
        return;
      }
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, distanceInterval: 1 },
        (loc) => setLocation(loc)
      );
    })();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    if (location) {
      const dist = getDistanceMeters(
        location.coords.latitude,
        location.coords.longitude,
        TREASURE.latitude,
        TREASURE.longitude
      );
      const stepsCalc = dist / 0.8;
      setSteps(stepsCalc);

      // Dicas e cor de fundo
      if (stepsCalc < 10) {
        setHint('Muito quente! Está quase lá!');
        setBgColor('#FF4500');
        if (!found) {
          setFound(true);
          playSound();
        }
      } else if (stepsCalc < 25) {
        setHint('Quente! Está perto!');
        setBgColor('#FF4500');
      } else if (stepsCalc < 50) {
        setHint('Morno! Continue procurando.');
        setBgColor('#FF4500');
      } else {
        setHint('Frio! Está longe do tesouro.');
        setBgColor('#87CEFA');
      }

      // Direção
      const brng = getBearing(
        location.coords.latitude,
        location.coords.longitude,
        TREASURE.latitude,
        TREASURE.longitude
      );
      setBearing(brng);
      Animated.timing(arrowAnim, {
        toValue: brng,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();
    }
  }, [location]);

  async function playSound() {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('./assets/treasure.mp3')
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (e) {
      // erro ao tocar som
    }
  }

  if (errorMsg) {
    return (
      <View style={[styles.container, { backgroundColor: '#fff' }]}>
        <Text>{errorMsg}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Text style={styles.title}>Caça ao Tesouro</Text>
      <Text style={styles.hint}>{hint}</Text>
      <Text style={styles.steps}>
        Distância: {steps.toFixed(1)} passos
      </Text>
      <View style={styles.arrowContainer}>
        <Animated.View
          style={{
            transform: [
              {
                rotate: arrowAnim.interpolate({
                  inputRange: [0, 360],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ],
          }}
        >
          <Text style={styles.arrow}>↑</Text>
        </Animated.View>
      </View>
      {found && (
        <Text style={styles.found}>🎉 Tesouro encontrado! 🎉</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  hint: { fontSize: 22, marginBottom: 10 },
  steps: { fontSize: 18, marginBottom: 30 },
  arrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    height: 100,
  },
  arrow: { fontSize: 80, color: '#222' },
  found: { fontSize: 24, color: '#FFD700', marginTop: 20 },
});
