// src/components/AmountSuggestionBar.tsx
import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';

const vnCurrencyFormatter = new Intl.NumberFormat('vi-VN');

interface AmountSuggestionBarProps {
  amountStr: string;
  onSelectAmount: (amount: number) => void;
  onAppendZeros?: (count: number) => void;
  surface?: 'card' | 'cardSecondary';
}

export const AmountSuggestionBar: React.FC<AmountSuggestionBarProps> = ({
  amountStr,
  onSelectAmount,
  onAppendZeros,
  surface = 'cardSecondary',
}) => {
  const { colors, isDark } = useTheme();

  const num = useMemo(() => {
    const cleanStr = amountStr.replace(/\D/g, '');
    return parseInt(cleanStr || '0', 10);
  }, [amountStr]);

  const suggestions = useMemo(() => {
    if (num <= 0) {
      return [10000, 20000, 50000, 100000];
    }
    if (num < 1000) {
      return [num * 1000, num * 10000, num * 100000];
    }
    if (num < 100000) {
      return [num * 10, num * 100].filter((val) => val <= 1000000000);
    }
    if (num < 10000000) {
      return [num * 10].filter((val) => val <= 1000000000);
    }
    return [];
  }, [num]);

  const handleSelect = (val: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectAmount(val);
  };

  const handlePlus000 = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onAppendZeros) {
      onAppendZeros(3);
    } else {
      const nextVal = num > 0 ? num * 1000 : 1000;
      onSelectAmount(nextVal);
    }
  };

  const chipBg = surface === 'cardSecondary' ? colors.card : colors.cardSecondary;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
      >
        {suggestions.map((val) => (
          <Pressable
            key={val}
            onPress={() => handleSelect(val)}
            style={[
              styles.chip,
              {
                backgroundColor: chipBg,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: colors.textPrimary }]}>
              {vnCurrencyFormatter.format(val)}đ
            </Text>
          </Pressable>
        ))}

        {/* Quick +000 button */}
        <Pressable
          onPress={handlePlus000}
          style={[
            styles.chipSpecial,
            {
              backgroundColor: isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(249, 115, 22, 0.1)',
              borderColor: 'rgba(249, 115, 22, 0.4)',
            },
          ]}
        >
          <Text style={styles.chipSpecialText}>+000</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  chipSpecial: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipSpecialText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F97316',
  },
});
