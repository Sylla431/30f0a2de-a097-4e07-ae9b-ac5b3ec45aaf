import { Platform, useWindowDimensions } from 'react-native';
import { DESKTOP_BREAKPOINT } from '@/constants/Layout';

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const isWebDesktop = isWeb && isDesktop;

  return { width, height, isWeb, isDesktop, isWebDesktop };
}
