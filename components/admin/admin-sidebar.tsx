import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { DashboardColors } from '@/constants/Dashboard';
import {
  ADMIN_OPERATIONS_NAV,
  ADMIN_SECONDARY_NAV,
  isNavItemActive,
  type AdminNavItem,
} from '@/constants/admin-nav';
import { Fonts } from '@/constants/Typography';
import { Colors } from '@/constants/Colors';
import { AppLogo } from '@/components/app-logo';
import { useAppStore } from '@/store/useAppStore';

interface AdminSidebarProps {
  onNavigate?: () => void;
}

function NavButton({
  item,
  active,
  badge,
  onPress,
}: {
  item: AdminNavItem;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.navItem, active && styles.navItemActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.navItemLeft}>
        <Ionicons
          name={item.icon}
          size={20}
          color={active ? DashboardColors.sidebarTextActive : DashboardColors.sidebarText}
        />
        <View style={styles.navLabels}>
          <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
          <Text style={styles.navDescription} numberOfLines={1}>
            {item.description}
          </Text>
        </View>
      </View>
      {badge != null && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const profile = useAppStore((s) => s.profile);
  const session = useAppStore((s) => s.session);

  const navigate = (href: string) => {
    router.push(href as never);
    onNavigate?.();
  };

  const displayName =
    profile?.nom?.trim() ||
    session?.user?.email?.split('@')[0] ||
    'Agent connecté';

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <AppLogo variant="sidebar" />
        <Text style={styles.brandSubtitle}>Centre de supervision</Text>
      </View>

      <View style={styles.institution}>
        <Text style={styles.institutionLabel}>RÉPUBLIQUE DU MALI</Text>
        <Text style={styles.institutionDept}>Protection civile & crues</Text>
      </View>

      <ScrollView style={styles.navScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>OPÉRATIONS</Text>
        {ADMIN_OPERATIONS_NAV.map((item) => (
          <NavButton
            key={item.href}
            item={item}
            active={isNavItemActive(pathname, item.segment)}
            onPress={() => navigate(item.href)}
          />
        ))}

        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>OUTILS</Text>
        {ADMIN_SECONDARY_NAV.map((item) => (
          <NavButton
            key={item.href}
            item={item}
            active={isNavItemActive(pathname, item.segment)}
            onPress={() => navigate(item.href)}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={16} color={DashboardColors.accent} />
        </View>
        <View style={styles.footerInfo}>
          <Text style={styles.footerName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.footerRole}>
            {profile?.role === 'admin' ? 'Administrateur' : 'Opérateur terrain'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: DashboardColors.sidebar,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  brand: {
    marginBottom: 12,
    gap: 4,
    alignItems: 'center',
  },
  brandSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: DashboardColors.sidebarText,
    textAlign: 'center',
  },
  institution: {
    paddingHorizontal: 4,
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: DashboardColors.sidebarBorder,
  },
  institutionLabel: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: DashboardColors.sidebarTextActive,
    letterSpacing: 1.2,
  },
  institutionDept: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: DashboardColors.sidebarText,
    marginTop: 4,
  },
  navScroll: {
    flex: 1,
  },
  sectionLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    color: DashboardColors.sidebarMuted,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 8,
  },
  sectionLabelSpaced: {
    marginTop: 20,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
  },
  navItemActive: {
    backgroundColor: DashboardColors.sidebarHover,
    borderLeftWidth: 3,
    borderLeftColor: DashboardColors.accentLight,
  },
  navItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  navLabels: {
    flex: 1,
    gap: 2,
  },
  navLabel: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: DashboardColors.sidebarText,
  },
  navLabelActive: {
    color: DashboardColors.sidebarTextActive,
  },
  navDescription: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: DashboardColors.sidebarMuted,
  },
  badge: {
    backgroundColor: DashboardColors.danger,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: Colors.white,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: DashboardColors.sidebarBorder,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DashboardColors.sidebarHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerInfo: {
    flex: 1,
  },
  footerName: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: DashboardColors.sidebarTextActive,
  },
  footerRole: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: DashboardColors.sidebarMuted,
    marginTop: 2,
  },
});
