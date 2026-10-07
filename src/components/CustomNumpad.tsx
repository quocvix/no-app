import React, { useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Delete } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export interface NumpadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear?: () => void;
}

export const CustomNumpad: React.FC<NumpadProps> = ({ onDigit, onBackspace, onClear }) => {
  const { isDark, colors } = useTheme();

  // Timer refs for continuous backspace delete
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopHoldBackspace = useCallback(() => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, []);

  const handleBackspacePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBackspace();
  }, [onBackspace]);

  const startHoldBackspace = useCallback(() => {
    // Nhấn giữ 350ms bắt đầu xóa liên tục mỗi 70ms
    holdTimeoutRef.current = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      holdIntervalRef.current = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onBackspace();
      }, 70);
    }, 350);
  }, [onBackspace]);

  const handleLongPressBackspace = useCallback(() => {
    if (onClear) {
      stopHoldBackspace();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onClear();
    }
  }, [onClear, stopHoldBackspace]);

  const handleDigitPress = useCallback(
    (item: string) => {
      // Phím 000 rung đậm hơn để tạo cảm giác xúc giác rõ rệt
      if (item === '000') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onDigit(item);
    },
    [onDigit]
  );

  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['0', '000', 'backspace'],
  ];

  return (
    <View style={styles.container}>
      {rows.map((row, rIdx) => (
        <View key={rIdx} style={styles.row}>
          {row.map((item) => {
            if (item === 'backspace') {
              return (
                <Pressable
                  key={item}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Xóa lùi, nhấn giữ để xóa nhanh"
                  onPress={handleBackspacePress}
                  onPressIn={startHoldBackspace}
                  onPressOut={stopHoldBackspace}
                  onLongPress={onClear ? handleLongPressBackspace : undefined}
                  style={({ pressed }) => [
                    styles.key,
                    {
                      backgroundColor: pressed
                        ? isDark
                          ? '#3F3F46'
                          : '#CBD5E1'
                        : isDark
                        ? colors.cardSecondary
                        : '#F1F5F9',
                      borderColor: isDark ? colors.border : '#E2E8F0',
                      transform: [{ scale: pressed ? 0.94 : 1 }],
                    },
                  ]}
                >
                  <Delete size={24} color={colors.textPrimary} />
                </Pressable>
              );
            }
            return (
              <Pressable
                key={item}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={item === '000' ? 'Ba số không' : `Số ${item}`}
                onPress={() => handleDigitPress(item)}
                style={({ pressed }) => [
                  styles.key,
                  {
                    backgroundColor: pressed
                      ? isDark
                        ? '#3F3F46'
                        : '#CBD5E1'
                      : isDark
                      ? colors.cardSecondary
                      : '#F1F5F9',
                    borderColor: isDark ? colors.border : '#E2E8F0',
                    transform: [{ scale: pressed ? 0.94 : 1 }],
                  },
                ]}
              >
                <Text style={[styles.keyText, { color: colors.textPrimary }]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  key: {
    flex: 1,
    height: 56,
    marginHorizontal: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
