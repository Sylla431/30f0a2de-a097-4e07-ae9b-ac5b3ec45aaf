import { Stack } from 'expo-router';
import { useScreenContentStyle } from '@/hooks/use-screen-content-style';

export default function SosLayout() {
  const contentStyle = useScreenContentStyle();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle,
      }}
    />
  );
}
