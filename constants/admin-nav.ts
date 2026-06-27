import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface AdminNavItem {
  href: string;
  label: string;
  description: string;
  icon: IconName;
  segment: string;
  badgeKey?: 'alertes';
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    href: '/(tabs)/map',
    label: 'Carte opérationnelle',
    description: 'Vue cartographique des risques',
    icon: 'map-outline',
    segment: 'map',
  },
  {
    href: '/(tabs)/sos',
    label: 'Signalements SOS',
    description: 'Alertes citoyennes en temps réel',
    icon: 'warning-outline',
    segment: 'sos',
  },
  {
    href: '/(tabs)/knowledge',
    label: 'Savoir communautaire',
    description: 'Connaissances locales partagées',
    icon: 'book-outline',
    segment: 'knowledge',
  },
  {
    href: '/(tabs)/orientation',
    label: 'Orientation IA',
    description: 'Assistant Aminata',
    icon: 'chatbubbles-outline',
    segment: 'orientation',
  },
  {
    href: '/(tabs)/profile',
    label: 'Profil & alertes',
    description: 'Compte et notifications IA',
    icon: 'person-outline',
    segment: 'profile',
    badgeKey: 'alertes',
  },
];

export const ADMIN_SECONDARY_NAV: AdminNavItem[] = [
  {
    href: '/gov-dashboard',
    label: 'Supervision',
    description: 'Tableau de bord institutionnel',
    icon: 'grid-outline',
    segment: 'gov-dashboard',
  },
  {
    href: '/risk-check',
    label: 'Vérification de zone',
    description: 'Évaluer un risque local',
    icon: 'shield-checkmark-outline',
    segment: 'risk-check',
  },
];

export function getAdminPageTitle(pathname: string): string {
  const all = [...ADMIN_NAV_ITEMS, ...ADMIN_SECONDARY_NAV];
  const match = all.find((item) => pathname.includes(item.segment));
  return match?.label ?? 'Inondalert';
}

export function isNavItemActive(pathname: string, segment: string): boolean {
  if (segment === 'gov-dashboard') {
    return pathname.includes('gov-dashboard');
  }
  if (segment === 'risk-check') {
    return pathname.includes('risk-check');
  }
  return pathname.includes(`/${segment}`);
}
