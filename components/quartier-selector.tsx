import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';
import { QUARTIERS } from '@/constants/Quartiers';
import { useCallback } from 'react';

interface QuartierSelectorProps {
  selected: string | null;
  onSelect: (quartier: string | null) => void;
  showAll?: boolean;
}

export function QuartierSelector({ selected, onSelect, showAll = true }: QuartierSelectorProps) {
  const handlePress = useCallback(
    (quartier: string | null) => {
      onSelect(quartier === selected ? null : quartier);
    },
    [selected, onSelect]
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={styles.container}
    >
      {showAll && (
        <TouchableOpacity
          style={[styles.chip, !selected && styles.chipActive]}
          onPress={() => handlePress(null)}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, !selected && styles.chipTextActive]}>Tous</Text>
        </TouchableOpacity>
      )}
      {QUARTIERS.map((q) => (
        <TouchableOpacity
          key={q}
          style={[styles.chip, selected === q && styles.chipActive]}
          onPress={() => handlePress(q)}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, selected === q && styles.chipTextActive]}>{q}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.white,
  },
});
