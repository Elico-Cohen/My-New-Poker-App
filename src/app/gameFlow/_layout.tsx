// src/app/gameFlow/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';
import { GameProvider } from '@/contexts/GameContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function GameFlowLayout() {
  return (
    // All authenticated users can access game features
    <ProtectedRoute>
      <GameProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </GameProvider>
    </ProtectedRoute>
  );
}