// src/components/CustomDateTimePickerModal.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ScrollView } from 'react-native';
import { ChevronLeft, ChevronRight, X, Clock, Calendar } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';

interface CustomDateTimePickerModalProps {
  visible: boolean;
  initialTimestamp: number;
  onConfirm: (timestamp: number) => void;
  onClose: () => void;
}

const DAYS_HEADER = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export const CustomDateTimePickerModal: React.FC<CustomDateTimePickerModalProps> = ({
  visible,
  initialTimestamp,
  onConfirm,
  onClose,
}) => {
  const { colors, isDark } = useTheme();

  const initialDate = useMemo(() => new Date(initialTimestamp), [initialTimestamp]);

  // Calendar state
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());

  // Time state
  const [selectedHour, setSelectedHour] = useState(initialDate.getHours());
  const [selectedMinute, setSelectedMinute] = useState(initialDate.getMinutes());

  // Tab: 'calendar' | 'time'
  const [activeTab, setActiveTab] = useState<'calendar' | 'time'>('calendar');

  // Days in selected month
  const calendarCells = useMemo(() => {
    // Thứ của ngày 1 (quy đổi Thứ 2 = 0, ..., Chủ Nhật = 6)
    const firstDayIndex = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { day: number; isCurrentMonth: boolean; monthOffset: number }[] = [];

    // Ngày của tháng trước
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        monthOffset: -1,
      });
    }

    // Ngày của tháng này
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      cells.push({
        day: d,
        isCurrentMonth: true,
        monthOffset: 0,
      });
    }

    // Các ngày của tháng sau để đủ lưới (bội số của 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        day: d,
        isCurrentMonth: false,
        monthOffset: 1,
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (cell: { day: number; isCurrentMonth: boolean; monthOffset: number }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (cell.monthOffset === -1) {
      handlePrevMonth();
    } else if (cell.monthOffset === 1) {
      handleNextMonth();
    }
    setSelectedDay(cell.day);
  };

  const handleQuickHourPreset = (h: number, m: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedHour(h);
    setSelectedMinute(m);
  };

  const handleSetCurrentTime = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const now = new Date();
    setSelectedHour(now.getHours());
    setSelectedMinute(now.getMinutes());
  };

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const finalDate = new Date(viewYear, viewMonth, selectedDay, selectedHour, selectedMinute, 0);
    onConfirm(finalDate.getTime());
    onClose();
  };

  const monthLabel = `Tháng ${viewMonth + 1}, ${viewYear}`;
  const formattedTime = `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`;

  const now = new Date();
  const isSelectedDateToday =
    now.getDate() === selectedDay &&
    now.getMonth() === viewMonth &&
    now.getFullYear() === viewYear;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Chọn thời gian</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                {selectedDay} tháng {viewMonth + 1}, {viewYear} · {formattedTime}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Mode Switch Tabs: Ngày / Giờ */}
          <View style={[styles.tabsWrap, { backgroundColor: colors.cardSecondary }]}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab('calendar');
              }}
              style={[
                styles.tabBtn,
                activeTab === 'calendar' && { backgroundColor: isDark ? '#3F3F46' : '#FFFFFF' },
              ]}
            >
              <Calendar
                size={15}
                color={activeTab === 'calendar' ? '#F97316' : colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'calendar' ? colors.textPrimary : colors.textMuted },
                ]}
              >
                Ngày ({selectedDay}/{viewMonth + 1})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab('time');
              }}
              style={[
                styles.tabBtn,
                activeTab === 'time' && { backgroundColor: isDark ? '#3F3F46' : '#FFFFFF' },
              ]}
            >
              <Clock
                size={15}
                color={activeTab === 'time' ? '#F97316' : colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'time' ? colors.textPrimary : colors.textMuted },
                ]}
              >
                Giờ ({formattedTime})
              </Text>
            </Pressable>
          </View>

          {/* TAB 1: CALENDAR VIEW */}
          {activeTab === 'calendar' ? (
            <View style={styles.calendarContainer}>
              {/* Month Navigation */}
              <View style={styles.monthNav}>
                <Pressable onPress={handlePrevMonth} hitSlop={10} style={styles.monthNavBtn}>
                  <ChevronLeft size={20} color={colors.textPrimary} />
                </Pressable>
                <Text style={[styles.monthNavTitle, { color: colors.textPrimary }]}>{monthLabel}</Text>
                <Pressable onPress={handleNextMonth} hitSlop={10} style={styles.monthNavBtn}>
                  <ChevronRight size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              {/* Day of Week Headers */}
              <View style={styles.daysHeaderRow}>
                {DAYS_HEADER.map((d, index) => (
                  <View key={d} style={styles.dayHeaderCell}>
                    <Text
                      style={[
                        styles.dayHeaderText,
                        { color: index >= 5 ? '#F97316' : colors.textMuted },
                      ]}
                    >
                      {d}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.grid}>
                {calendarCells.map((cell, idx) => {
                  const isSelected = cell.isCurrentMonth && cell.day === selectedDay;
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => handleSelectDay(cell)}
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          { color: cell.isCurrentMonth ? colors.textPrimary : colors.textMuted },
                          !cell.isCurrentMonth && { opacity: 0.35 },
                          isSelected && styles.dayTextSelected,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            /* TAB 2: TIME SELECTOR VIEW */
            <View style={styles.timeContainer}>
              <View style={styles.timeDisplayRow}>
                {/* Giờ */}
                <View style={styles.timeWheelCol}>
                  <Text style={[styles.timeUnitLabel, { color: colors.textMuted }]}>Giờ (0 - 23)</Text>
                  <View style={[styles.wheelBox, { backgroundColor: colors.cardSecondary }]}>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedHour((h) => (h + 1) % 24);
                      }}
                      style={styles.adjustBtn}
                    >
                      <Text style={[styles.adjustBtnText, { color: colors.textPrimary }]}>+</Text>
                    </Pressable>
                    <Text style={[styles.timeWheelNumber, { color: colors.textPrimary }]}>
                      {selectedHour.toString().padStart(2, '0')}
                    </Text>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedHour((h) => (h === 0 ? 23 : h - 1));
                      }}
                      style={styles.adjustBtn}
                    >
                      <Text style={[styles.adjustBtnText, { color: colors.textPrimary }]}>−</Text>
                    </Pressable>
                  </View>
                </View>

                <Text style={[styles.timeColon, { color: colors.textPrimary }]}>:</Text>

                {/* Phút */}
                <View style={styles.timeWheelCol}>
                  <Text style={[styles.timeUnitLabel, { color: colors.textMuted }]}>Phút (0 - 59)</Text>
                  <View style={[styles.wheelBox, { backgroundColor: colors.cardSecondary }]}>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedMinute((m) => (m + 5) % 60);
                      }}
                      style={styles.adjustBtn}
                    >
                      <Text style={[styles.adjustBtnText, { color: colors.textPrimary }]}>+5</Text>
                    </Pressable>
                    <Text style={[styles.timeWheelNumber, { color: colors.textPrimary }]}>
                      {selectedMinute.toString().padStart(2, '0')}
                    </Text>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedMinute((m) => (m < 5 ? 55 : m - 5));
                      }}
                      style={styles.adjustBtn}
                    >
                      <Text style={[styles.adjustBtnText, { color: colors.textPrimary }]}>−5</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Time Presets */}
              <View style={styles.presetsWrap}>
                <Pressable
                  onPress={handleSetCurrentTime}
                  style={[styles.presetChip, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                >
                  <Text style={[styles.presetChipText, { color: colors.textPrimary }]}>Bây giờ</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleQuickHourPreset(8, 0)}
                  style={[styles.presetChip, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                >
                  <Text style={[styles.presetChipText, { color: colors.textPrimary }]}>Sáng 08:00</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleQuickHourPreset(12, 0)}
                  style={[styles.presetChip, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                >
                  <Text style={[styles.presetChipText, { color: colors.textPrimary }]}>Trưa 12:00</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleQuickHourPreset(19, 0)}
                  style={[styles.presetChip, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                >
                  <Text style={[styles.presetChipText, { color: colors.textPrimary }]}>Tối 19:00</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Confirm Button */}
          <Pressable
            onPress={handleConfirm}
            style={[styles.confirmBtn, { backgroundColor: isDark ? '#FAFAFA' : '#0F172A' }]}
          >
            <Text style={[styles.confirmBtnText, { color: isDark ? '#09090B' : '#FFFFFF' }]}>
              Xác nhận
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
  },
  closeBtn: {
    padding: 6,
  },
  tabsWrap: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  calendarContainer: {
    marginBottom: 16,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  monthNavBtn: {
    padding: 6,
    borderRadius: 10,
  },
  monthNavTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  daysHeaderRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: '#EA580C',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  timeContainer: {
    paddingVertical: 10,
    marginBottom: 16,
  },
  timeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  timeWheelCol: {
    alignItems: 'center',
  },
  timeUnitLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  wheelBox: {
    width: 84,
    borderRadius: 18,
    paddingVertical: 8,
    alignItems: 'center',
  },
  adjustBtn: {
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  adjustBtnText: {
    fontSize: 18,
    fontWeight: '800',
  },
  timeWheelNumber: {
    fontSize: 34,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginVertical: 4,
  },
  timeColon: {
    fontSize: 32,
    fontWeight: '900',
    marginHorizontal: 14,
    marginTop: 18,
  },
  presetsWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confirmBtn: {
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
