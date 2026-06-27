import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';

const PRIORITY_CONFIG = {
  faible: { color: Colors.prioriteFaible, label: 'Faible' },
  moyenne: { color: Colors.prioriteMoyenne, label: 'Moyenne' },
  haute: { color: Colors.prioriteHaute, label: 'Haute' },
  critique: { color: Colors.prioriteCritique, label: 'Critique' },
} as const;

interface PriorityBadgeProps {
  priorite: keyof typeof PRIORITY_CONFIG;
  size?: 'small' | 'medium';
}

export function PriorityBadge({ priorite, size = 'small' }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priorite];
  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, { backgroundColor: `${config.color}18` }, isSmall && styles.badgeSmall]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.text, { color: config.color }, isSmall && styles.textSmall]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
  },
  textSmall: {
    fontSize: 11,
  },
});
