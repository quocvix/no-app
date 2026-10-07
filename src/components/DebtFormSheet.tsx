// src/components/DebtFormSheet.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Switch,
  ScrollView,
  Platform,
  Keyboard,
  BackHandler,
  Alert,
} from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, FileText, ArrowUpRight, ArrowDownLeft, X, Calendar } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  Debt,
  DebtDirection,
  createDebt,
  updateDebt,
  getPersonNameSuggestions,
  getOppositeDebtRemaining,
  addDebtWithOffset,
} from '../storage/debts';
import { AmountSuggestionBar } from './AmountSuggestionBar';
import { DateQuickPicker } from './DateQuickPicker';
import { NoteSuggestionChips } from './NoteSuggestionChips';
import { useTheme } from '../context/ThemeContext';

const vnCurrencyFormatter = new Intl.NumberFormat('vi-VN');

const formatDateTimeDisplay = (timestamp: number) => {
  const d = new Date(timestamp);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${hours}:${minutes} · ${day}/${month}/${year}`;
};

interface DebtFormSheetProps {
  initialDebt?: Debt | null;
  defaultPersonName?: string;
  defaultDirection?: DebtDirection;
  onDone: () => void;
  onClose: () => void;
}

export const DebtFormSheet: React.FC<DebtFormSheetProps> = ({
  initialDebt,
  defaultPersonName,
  defaultDirection,
  onDone,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const isEdit = Boolean(initialDebt);
  const [direction, setDirection] = useState<DebtDirection>(
    initialDebt?.direction || defaultDirection || 'LEND'
  );
  const [personName, setPersonName] = useState(initialDebt?.person_name || defaultPersonName || '');
  const [amountStr, setAmountStr] = useState(initialDebt ? initialDebt.amount.toString() : '0');
  const [note, setNote] = useState(initialDebt?.note || '');
  const [trackInExpense, setTrackInExpense] = useState(initialDebt ? Boolean(initialDebt.track_in_expense) : false);
  const [createdAt, setCreatedAt] = useState(initialDebt ? initialDebt.created_at : Date.now());
  const amountInputRef = useRef<TextInput>(null);

  // Reanimated native keyboard tracking (supports Android translucent status bar + iOS)
  const keyboard = useAnimatedKeyboard({ isStatusBarTranslucentAndroid: true });
  const [fallbackHeight, setFallbackHeight] = useState(0);

  useEffect(() => {
    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height;
      if (typeof h === 'number' && h > 0) {
        setFallbackHeight(h);
      }
    };
    const onHide = () => setFallbackHeight(0);

    const showSub1 = Keyboard.addListener('keyboardDidShow', onShow);
    const showSub2 = Keyboard.addListener('keyboardWillShow', onShow);
    const hideSub1 = Keyboard.addListener('keyboardDidHide', onHide);
    const hideSub2 = Keyboard.addListener('keyboardWillHide', onHide);

    return () => {
      showSub1.remove();
      showSub2.remove();
      hideSub1.remove();
      hideSub2.remove();
    };
  }, []);

  const animatedContainerStyle = useAnimatedStyle(() => {
    const h = keyboard.height.value > 0 ? keyboard.height.value : fallbackHeight;
    return {
      paddingBottom: h,
    };
  });

  const animatedBottomStyle = useAnimatedStyle(() => {
    const h = keyboard.height.value > 0 ? keyboard.height.value : fallbackHeight;
    return {
      paddingBottom: h > 0 ? 8 : Math.max(insets.bottom, 12),
    };
  });

  // Hardware back button handler for Android
  useEffect(() => {
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => backSub.remove();
  }, [onClose]);

  // Auto-focus amount input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Cursor blink simulation
  const [cursorVisible, setCursorVisible] = useState(true);
  useEffect(() => {
    const timer = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 600);
    return () => clearInterval(timer);
  }, []);

  const suggestions = useMemo(() => getPersonNameSuggestions(), []);

  const parsedAmount = parseInt(amountStr || '0', 10);

  const oppositeRemaining = useMemo(() => {
    if (isEdit || !personName.trim()) return 0;
    return getOppositeDebtRemaining(personName.trim(), direction);
  }, [isEdit, personName, direction]);

  const executeSave = (shouldOffset: boolean) => {
    const trimmedName = personName.trim();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (isEdit && initialDebt) {
      updateDebt(initialDebt.id, {
        person_name: trimmedName,
        amount: parsedAmount,
        note,
        created_at: createdAt,
      });
    } else if (shouldOffset) {
      addDebtWithOffset({
        person_name: trimmedName,
        direction,
        amount: parsedAmount,
        note,
        track_in_expense: trackInExpense,
        created_at: createdAt,
      });
    } else {
      createDebt({
        person_name: trimmedName,
        direction,
        amount: parsedAmount,
        note,
        track_in_expense: trackInExpense,
        created_at: createdAt,
      });
    }

    onDone();
    onClose();
  };

  const handleSubmit = () => {
    const trimmedName = personName.trim();
    if (!trimmedName) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (parsedAmount <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // Check if there is opposite debt to offset
    if (!isEdit && oppositeRemaining > 0) {
      const isLend = direction === 'LEND';
      const oppositeDesc = isLend
        ? `Bạn đang nợ ${trimmedName} ${vnCurrencyFormatter.format(oppositeRemaining)}đ.`
        : `${trimmedName} đang nợ bạn ${vnCurrencyFormatter.format(oppositeRemaining)}đ.`;

      Alert.alert(
        'Cấn trừ công nợ?',
        `${oppositeDesc}\n\nBạn có muốn cấn trừ số tiền ${vnCurrencyFormatter.format(parsedAmount)}đ này vào nợ cũ hay tạo khoản nợ riêng biệt?`,
        [
          {
            text: 'Hủy',
            style: 'cancel',
          },
          {
            text: 'Tạo nợ riêng',
            style: 'default',
            onPress: () => executeSave(false),
          },
          {
            text: 'Cấn trừ nợ cũ',
            style: 'default',
            onPress: () => executeSave(true),
          },
        ]
      );
      return;
    }

    executeSave(false);
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlayRoot, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.container, { paddingTop: insets.top }, animatedContainerStyle]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <Pressable onPress={onClose} hitSlop={12} style={styles.headerBtn}>
              <X size={22} color={colors.textPrimary} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {isEdit ? 'Sửa khoản nợ' : 'Ghi nợ mới'}
            </Text>
            <View style={styles.headerBtn} />
          </View>

          {/* Scrollable Form Content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          {/* Direction Segmented Control (only when creating) */}
          {!isEdit && (
            <View style={[styles.segmentContainer, { backgroundColor: colors.cardSecondary }]}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDirection('LEND');
                }}
                style={[
                  styles.segmentBtn,
                  direction === 'LEND' && { backgroundColor: isDark ? '#3F3F46' : '#FFFFFF' },
                ]}
              >
                <ArrowUpRight
                  size={16}
                  color={direction === 'LEND' ? '#16A34A' : colors.textMuted}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: direction === 'LEND' ? colors.textPrimary : colors.textMuted },
                  ]}
                >
                  Tôi cho mượn
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDirection('BORROW');
                }}
                style={[
                  styles.segmentBtn,
                  direction === 'BORROW' && { backgroundColor: isDark ? '#3F3F46' : '#FFFFFF' },
                ]}
              >
                <ArrowDownLeft
                  size={16}
                  color={direction === 'BORROW' ? '#EA580C' : colors.textMuted}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.segmentText,
                    { color: direction === 'BORROW' ? colors.textPrimary : colors.textMuted },
                  ]}
                >
                  Tôi đi vay
                </Text>
              </Pressable>
            </View>
          )}

          {/* Amount Display */}
          <View style={styles.amountSection}>
            <Text style={[styles.amountLabel, { color: colors.textMuted }]}>
              {direction === 'LEND' ? 'Số tiền cho mượn' : 'Số tiền đi vay'}
            </Text>
            <Pressable
              onPress={() => amountInputRef.current?.focus()}
              style={styles.amountDisplayRow}
            >
              <Text style={[styles.amountText, { color: colors.textPrimary }]}>
                {vnCurrencyFormatter.format(parsedAmount)}
              </Text>
              <Text style={[styles.amountCursor, { color: colors.textPrimary, opacity: cursorVisible ? 1 : 0 }]}>
                |
              </Text>
              <Text style={[styles.amountCurrency, { color: colors.textPrimary }]}>đ</Text>

              {/* Direct full-overlay TextInput for instant numeric input */}
              <TextInput
                ref={amountInputRef}
                value={amountStr === '0' ? '' : amountStr}
                onChangeText={(val) => {
                  const clean = val.replace(/\D/g, '');
                  setAmountStr(clean || '0');
                }}
                keyboardType="number-pad"
                autoFocus
                style={[StyleSheet.absoluteFill, { opacity: 0 }]}
                caretHidden
              />
            </Pressable>
          </View>

          {/* Form fields card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Person Name Input */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldLeft}>
                <View style={[styles.rowIconBox, { backgroundColor: colors.cardSecondary }]}>
                  <User size={18} color={colors.textSecondary} />
                </View>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Người nợ</Text>
              </View>
              <TextInput
                value={personName}
                onChangeText={setPersonName}
                placeholder="Tên người mượn / vay"
                placeholderTextColor={colors.textMuted}
                style={[styles.fieldInput, { color: colors.textPrimary }]}
              />
            </View>

            {/* Name suggestions */}
            {suggestions.length > 0 && !personName && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
                {suggestions.map((name) => (
                  <Pressable
                    key={name}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPersonName(name);
                    }}
                    style={[styles.suggestChip, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                  >
                    <Text style={[styles.suggestChipText, { color: colors.textPrimary }]}>{name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Opposite Debt Offset Notice Banner */}
            {oppositeRemaining > 0 && (
              <View style={[styles.offsetHintBanner, { backgroundColor: isDark ? 'rgba(234, 88, 12, 0.15)' : '#FFF7ED', borderColor: isDark ? 'rgba(234, 88, 12, 0.3)' : '#FDBA74' }]}>
                <Text style={[styles.offsetHintText, { color: isDark ? '#FB923C' : '#C2410C' }]}>
                  {direction === 'LEND'
                    ? `💡 Bạn đang nợ ${personName.trim()} ${vnCurrencyFormatter.format(oppositeRemaining)}đ. Có thể cấn trừ vào nợ cũ khi lưu.`
                    : `💡 ${personName.trim()} đang nợ bạn ${vnCurrencyFormatter.format(oppositeRemaining)}đ. Có thể cấn trừ vào nợ cũ khi lưu.`}
                </Text>
              </View>
            )}

            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

            {/* Date Picker */}
            <View style={styles.fieldCol}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldLeft}>
                  <View style={[styles.rowIconBox, { backgroundColor: colors.cardSecondary }]}>
                    <Calendar size={18} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    {isEdit ? 'Thời gian' : 'Ngày ghi'}
                  </Text>
                </View>
                <Text style={[styles.fieldValueDate, { color: colors.textMuted }]}>
                  {formatDateTimeDisplay(createdAt)}
                </Text>
              </View>
              <View style={styles.datePickerWrap}>
                <DateQuickPicker value={createdAt} onChange={setCreatedAt} surface="card" />
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

            {/* Note Input */}
            <View style={styles.fieldCol}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldLeft}>
                  <View style={[styles.rowIconBox, { backgroundColor: colors.cardSecondary }]}>
                    <FileText size={18} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Ghi chú</Text>
                </View>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Lý do / Hạn trả (nếu có)"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.fieldInput, { color: colors.textPrimary }]}
                />
              </View>
              <NoteSuggestionChips
                suggestions={['Ăn uống', 'Mua hộ', 'Cà phê', 'Tiền trọ', 'Đổ xăng', 'Du lịch', 'Mượn gấp']}
                currentNote={note}
                onSelectNote={setNote}
              />
            </View>

            {/* Option: Ghi cả vào chi tiêu (chỉ hiển thị khi tạo mới) */}
            {!isEdit && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
                <View style={styles.fieldRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textPrimary, fontWeight: '600' }]}>
                      Ghi cả vào chi tiêu
                    </Text>
                    <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                      {direction === 'LEND'
                        ? 'Tạo 1 khoản CHI tương ứng trong Lịch sử'
                        : 'Tạo 1 khoản THU tương ứng trong Lịch sử'}
                    </Text>
                  </View>
                  <Switch
                    value={trackInExpense}
                    onValueChange={(val) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTrackInExpense(val);
                    }}
                    trackColor={{ false: colors.border, true: '#EA580C' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </>
            )}
          </View>
        </ScrollView>

        {/* Bottom Section: AmountSuggestionBar + Submit Button */}
        <Animated.View
          style={[
            styles.bottomSection,
            {
              backgroundColor: colors.background,
            },
            animatedBottomStyle,
          ]}
        >
          <AmountSuggestionBar
            amountStr={amountStr}
            onSelectAmount={(val) => setAmountStr(val.toString())}
            onAppendZeros={(count) =>
              setAmountStr((prev) => {
                if (prev === '0' || !prev) return '0';
                if (prev.length + count > 12) return prev;
                return prev + '0'.repeat(count);
              })
            }
            surface="card"
          />

          <Pressable
            onPress={handleSubmit}
            style={[styles.submitBtn, { backgroundColor: isDark ? '#FAFAFA' : '#0F172A' }]}
          >
            <Text style={[styles.submitBtnText, { color: isDark ? '#09090B' : '#FFFFFF' }]}>
              {isEdit ? 'Lưu thay đổi' : 'Lưu khoản nợ'}
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
    zIndex: 9999,
    elevation: 9999,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexShrink: 0,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  amountSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  amountDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  amountText: {
    fontSize: 38,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  amountCursor: {
    fontSize: 34,
    fontWeight: '300',
    marginHorizontal: 1,
  },
  amountCurrency: {
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 4,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 10,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  fieldCol: {
    paddingVertical: 12,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  fieldValueDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  datePickerWrap: {
    width: '100%',
  },
  fieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  fieldHint: {
    fontSize: 11,
    marginTop: 2,
  },
  fieldInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
    marginLeft: 12,
  },
  suggestionsScroll: {
    flexDirection: 'row',
    paddingBottom: 10,
  },
  suggestChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  suggestChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
    flexShrink: 0,
  },
  submitBtn: {
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  offsetHintBanner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 6,
  },
  offsetHintText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
});
