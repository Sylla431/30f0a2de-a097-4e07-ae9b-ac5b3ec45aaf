import { useState, type ReactNode } from 'react';
import { View, StyleSheet, Modal, Pressable, useWindowDimensions } from 'react-native';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminTopbar } from '@/components/admin/admin-topbar';
import {
  DashboardColors,
  DASHBOARD_SIDEBAR_MARGIN,
  DASHBOARD_SIDEBAR_OFFSET,
  DASHBOARD_SIDEBAR_RADIUS,
  DASHBOARD_SIDEBAR_WIDTH,
} from '@/constants/Dashboard';
import { DESKTOP_BREAKPOINT } from '@/constants/Layout';

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <View style={styles.root}>
      {isDesktop ? (
        <View style={styles.sidebarSlot}>
          <View style={styles.sidebarFloating}>
            <AdminSidebar />
          </View>
        </View>
      ) : (
        <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={closeDrawer}>
          <Pressable style={styles.drawerOverlay} onPress={closeDrawer}>
            <Pressable style={styles.drawerFloating} onPress={(e) => e.stopPropagation()}>
              <AdminSidebar onNavigate={closeDrawer} />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <View style={[styles.main, isDesktop && { marginLeft: DASHBOARD_SIDEBAR_OFFSET }]}>
        <AdminTopbar showMenu={!isDesktop} onMenuPress={() => setDrawerOpen(true)} />
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const floatingPanel = {
  width: DASHBOARD_SIDEBAR_WIDTH,
  borderRadius: DASHBOARD_SIDEBAR_RADIUS,
  overflow: 'hidden' as const,
  backgroundColor: DashboardColors.sidebar,
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DashboardColors.pageBg,
    minHeight: '100%',
  },
  sidebarSlot: {
    position: 'absolute',
    left: DASHBOARD_SIDEBAR_MARGIN,
    top: DASHBOARD_SIDEBAR_MARGIN,
    bottom: DASHBOARD_SIDEBAR_MARGIN,
    width: DASHBOARD_SIDEBAR_WIDTH,
    zIndex: 20,
  },
  sidebarFloating: {
    ...floatingPanel,
    flex: 1,
    height: '100%',
  },
  main: {
    flex: 1,
    minHeight: '100%',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    flexDirection: 'row',
    padding: DASHBOARD_SIDEBAR_MARGIN,
  },
  drawerFloating: {
    ...floatingPanel,
    height: '100%',
    boxShadow: '4px 0 32px rgba(0, 0, 0, 0.25)',
  },
});
