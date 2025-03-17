import React from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

// מסך אינדקס שמנווט ישירות למסך הלוגין באמצעות Redirect
export default function IndexScreen() {
  console.log('Index screen rendered - redirecting to login');
  
  // מנווט ישירות למסך הלוגין באמצעות Redirect
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D1B1E',
  },
  text: {
    color: '#FFD700',
    marginTop: 20,
    fontSize: 18,
  },
});