import { Stack } from 'expo-router';

export default function MessagesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen 
        name="chat" 
        options={{ 
          headerShown: false,
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="media-viewer" 
        options={{ 
          headerShown: false,
          presentation: 'fullScreenModal',
        }} 
      />
    </Stack>
  );
} 