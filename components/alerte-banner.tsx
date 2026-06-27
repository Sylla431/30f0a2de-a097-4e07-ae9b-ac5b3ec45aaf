import { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';
import { useAppStore } from '@/store/useAppStore';

const NIVEAU_COLORS = {
  vigilance: '#F5A623',
  alerte: Colors.alert,
  urgence: Colors.critical,
} as const;

const NIVEAU_LABELS = {
  vigilance: 'VIGILANCE',
  alerte: 'ALERTE',
  urgence: 'URGENCE',
} as const;

export function AlerteBanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const latestAlerte = useAppStore((s) => s.latestAlerte);
  const showBanner = useAppStore((s) => s.showAlerteBanner);
  const setShowBanner = useAppStore((s) => s.setShowAlerteBanner);
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowBanner(false);
    });
  }, [slideAnim, setShowBanner]);

  useEffect(() => {
    if (showBanner && latestAlerte) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();

      // Auto-hide after 6 seconds
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, 6000);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [showBanner, latestAlerte, slideAnim, handleDismiss]);

  const handlePress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    handleDismiss();
    router.push('/(tabs)/profile/alertes-ia');
  }, [handleDismiss, router]);

  if (!showBanner || !latestAlerte) return null;

  const bgColor = NIVEAU_COLORS[latestAlerte.niveau];
  const label = NIVEAU_LABELS[latestAlerte.niveau];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          paddingTop: insets.top + 8,
          backgroundColor: bgColor,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="notifications" size={20} color={Colors.white} />
        </View>
        <View style={styles.textWrap}>
          <View style={styles.headerRow}>
            <Text style={styles.levelBadge}>{label}</Text>
            <Text style={styles.commune}>{latestAlerte.commune}</Text>
          </View>
          <Text style={styles.message} numberOfLines={2}>
            {latestAlerte.message}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={Colors.white} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 16,
    paddingBottom: 12,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    ...Platform.select({ android: { elevation: 10 } as object, default: {} }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelBadge: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: Colors.white,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  commune: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.white,
  },
  message: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.92)',
    lineHeight: 16,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
