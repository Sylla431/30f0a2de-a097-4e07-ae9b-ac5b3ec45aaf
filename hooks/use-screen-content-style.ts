import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

export function useScreenContentStyle() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  return {
    backgroundColor: Colors.background,
    paddingTop: isWeb ? 0 : insets.top + Layout.screenTopPadding,
  };
}
