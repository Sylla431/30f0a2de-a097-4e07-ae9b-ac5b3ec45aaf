import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { APP_NAME } from '@/constants/Brand';

const LOGO_SOURCE = require('@/assets/images/long_logo.png');

interface AppLogoProps {
  variant?: 'auth' | 'sidebar';
  style?: StyleProp<ViewStyle>;
}

export function AppLogo({ variant = 'auth', style }: AppLogoProps) {
  if (variant === 'sidebar') {
    return (
      <View style={styles.sidebarWrap}>
        <Image
          source={LOGO_SOURCE}
          style={styles.sidebarImage}
          contentFit="contain"
          contentPosition="center"
          accessibilityLabel={APP_NAME}
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <Image
        source={LOGO_SOURCE}
        style={styles.authImage}
        contentFit="contain"
        accessibilityLabel={APP_NAME}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  authImage: {
    width: 280,
    height: 88,
  },
  sidebarWrap: {
    width: '100%',
    alignItems: 'center',
  },
  sidebarImage: {
    width: 200,
    height: 72,
  },
});
