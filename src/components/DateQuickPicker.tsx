// src/components/DateQuickPicker.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Calendar } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { CustomDateTimePickerModal } from './CustomDateTimePickerModal';

interface DateQuickPickerProps {
  value: number;
  onChange: (timestamp: number) => void;
  surface?: 'card' | 'cardSecondary';
  style?: StyleProp<ViewStyle>;
}

export const DateQuickPicker: React.FC<DateQuickPickerProps> = ({
  value,
  onChange,
  surface = 'cardSecondary',
  style,
}) => {
  const { colors, isDark } = useTheme();
  const [showCustomModal, setShowCustomModal] = useState(false);

  const currentDate = new Date(value);
  const now = new Date();

  // Kiểm tra xem có phải Hôm nay không
  const isToday =
    currentDate.getDate() === now.getDate() &&
    currentDate.getMonth() === now.getMonth() &&
    currentDate.getFullYear() === now.getFullYear();

  // Kiểm tra xem có phải Hôm qua không
  const yesterday = new Date(now.getTime() - 86400000);
  const isYesterday =
    currentDate.getDate() === yesterday.getDate() &&
    currentDate.getMonth() === yesterday.getMonth() &&
    currentDate.getFullYear() === yesterday.getFullYear();

  const handleSelectToday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const d = new Date();
    d.setHours(currentDate.getHours(), currentDate.getMinutes(), currentDate.getSeconds());
    onChange(d.getTime());
  };

  const handleSelectYesterday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const d = new Date(Date.now() - 86400000);
    d.setHours(currentDate.getHours(), currentDate.getMinutes(), currentDate.getSeconds());
    onChange(d.getTime());
  };

  const handleOpenCustomPicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCustomModal(true);
  };

  const formatCustomLabel = () => {
    const day = currentDate.getDate().toString().padStart(2, '0');
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const hours = currentDate.getHours().toString().padStart(2, '0');
    const minutes = currentDate.getMinutes().toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
  };

  const inactiveBg = surface === 'cardSecondary' ? colors.card : colors.cardSecondary;
  const activeBg = isDark ? '#FAFAFA' : '#0F172A';
  const activeText = isDark ? '#09090B' : '#FFFFFF';

  return (
    <View style={[styles.container, style]}>
      {/* Chip Hôm nay */}
      <Pressable
        onPress={handleSelectToday}
        style={[
          styles.chip,
          {
            backgroundColor: isToday ? activeBg : inactiveBg,
            borderColor: isToday ? activeBg : colors.border,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.chipText,
            { color: isToday ? activeText : colors.textSecondary },
          ]}
        >
          Hôm nay
        </Text>
      </Pressable>

      {/* Chip Hôm qua */}
      <Pressable
        onPress={handleSelectYesterday}
        style={[
          styles.chip,
          {
            backgroundColor: isYesterday ? activeBg : inactiveBg,
            borderColor: isYesterday ? activeBg : colors.border,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.chipText,
            { color: isYesterday ? activeText : colors.textSecondary },
          ]}
        >
          Hôm qua
        </Text>
      </Pressable>

      {/* Chip Chọn ngày giờ tùy chỉnh */}
      <Pressable
        onPress={handleOpenCustomPicker}
        style={[
          styles.chipCustom,
          {
            backgroundColor: !isToday && !isYesterday ? activeBg : inactiveBg,
            borderColor: !isToday && !isYesterday ? activeBg : colors.border,
          },
        ]}
      >
        <Calendar
          size={13}
          color={!isToday && !isYesterday ? activeText : colors.textSecondary}
          style={{ marginRight: 4 }}
        />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.chipText,
            { color: !isToday && !isYesterday ? activeText : colors.textSecondary },
          ]}
        >
          {formatCustomLabel()}
        </Text>
      </Pressable>

      {/* Custom Clean Minimalist Modal */}
      {showCustomModal && (
        <CustomDateTimePickerModal
          visible={showCustomModal}
          initialTimestamp={value}
          onConfirm={(newTimestamp) => {
            onChange(newTimestamp);
          }}
          onClose={() => setShowCustomModal(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 6,
  },
  chip: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipCustom: {
    flex: 1.25,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
