import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { DashboardColors } from '@/constants/Dashboard';
import { getAdminPageTitle } from '@/constants/admin-nav';
import { Fonts } from '@/constants/Typography';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store/useAppStore';

interface AdminTopbarProps {
  onMenuPress?: () => void;
  showMenu?: boolean;
}

export function AdminTopbar({ onMenuPress, showMenu }: AdminTopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const unreadAlertesCount = useAppStore((s) => s.unreadAlertesCount);
  const title = getAdminPageTitle(pathname);

  return (
    <View style={styles.topbar}>
      <View style={styles.left}>
        {showMenu ? (
          <TouchableOpacity style={styles.iconBtn} onPress={onMenuPress} activeOpacity={0.7}>
            <Ionicons name="menu" size={22} color={Colors.text} />
          </TouchableOpacity>
        ) : null}
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Plateforme de vigilance inondations — Bamako</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/risk-check')}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-checkmark-outline" size={18} color={DashboardColors.accent} />
          <Text style={styles.actionBtnText}>Zone à risque</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push('/(tabs)/profile/alertes-ia')}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={22} color={Colors.text} />
          {unreadAlertesCount > 0 ? (
            <View style={styles.notifDot}>
              <Text style={styles.notifDotText}>
                {unreadAlertesCount > 9 ? '9+' : unreadAlertesCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push('/gov-dashboard')}
          activeOpacity={0.7}
        >
          <Ionicons name="grid-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    height: 64,
    backgroundColor: DashboardColors.topbarBg,
    borderBottomWidth: 1,
    borderBottomColor: DashboardColors.topbarBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  actionBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: DashboardColors.accent,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: DashboardColors.topbarBorder,
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: DashboardColors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifDotText: {
    fontFamily: Fonts.bold,
    fontSize: 9,
    color: Colors.white,
  },
});
