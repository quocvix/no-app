// src/components/PaymentFormSheet.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Keyboard,
  BackHandler,
} from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, CheckCircle2, X, Calendar } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Debt, DebtPayment, addPayment, updatePayment } from '../storage/debts';
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

interface PaymentFormSheetProps {
  debt: Debt;
  initialPayment?: DebtPayment | null;
  onDone: () => void;
  onClose: () => void;
}

export const PaymentFormSheet: React.FC<PaymentFormSheetProps> = ({
  debt,
  initialPayment,
  onDone,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const isEditPayment = Boolean(initialPayment);
  const [amountStr, setAmountStr] = useState(
    initialPayment ? initialPayment.amount.toString() : debt.remaining.toString()
  );
  const [note, setNote] = useState(initialPayment ? (initialPayment.note || '') : '');
  const [createdAt, setCreatedAt] = useState(initialPayment ? initialPayment.created_at : Date.now());
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

  const parsedAmount = parseInt(amountStr || '0', 10);

  const handleQuickPayAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmountStr(debt.remaining.toString());
  };

  const handleSubmit = () => {
    if (parsedAmount <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (parsedAmount > debt.remaining) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (isEditPayment && initialPayment) {
      updatePayment(initialPayment.id, {
        amount: parsedAmount,
        note,
        created_at: createdAt,
      });
    } else {
      addPayment({
        debt_id: debt.id,
        amount: parsedAmount,
        note,
        created_at: createdAt,
      });
    }

    onDone();
    onClose();
  };

  const isLend = debt.direction === 'LEND';
  const actionTitle = isLend ? 'Người ta trả tôi' : 'Tôi trả người ta';

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlayRoot, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.container, { paddingTop: insets.top }, animatedContainerStyle]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <Pressable onPress={onClose} hitSlop={12} style={styles.headerBtn}>
              <X size={22} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Ghi nhận trả nợ</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                {debt.person_name} · Còn nợ: {vnCurrencyFormatter.format(debt.remaining)}đ
              </Text>
            </View>
            <View style={styles.headerBtn} />
          </View>

          {/* Scrollable Form Content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          {/* Amount Display */}
          <View style={styles.amountSection}>
            <Text style={[styles.amountLabel, { color: colors.textMuted }]}>{actionTitle}</Text>
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

            {/* Quick Pay All Chip */}
            {parsedAmount !== debt.remaining && (
              <Pressable
                onPress={handleQuickPayAll}
                style={[styles.quickPayChip, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <CheckCircle2 size={14} color="#F97316" style={{ marginRight: 6 }} />
                <Text style={[styles.quickPayText, { color: colors.textPrimary }]}>
                  Trả hết ({vnCurrencyFormatter.format(debt.remaining)}đ)
                </Text>
              </Pressable>
            )}
          </View>

          {/* Details Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Date Picker */}
            <View style={styles.fieldCol}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldLeft}>
                  <View style={[styles.rowIconBox, { backgroundColor: colors.cardSecondary }]}>
                    <Calendar size={18} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Ngày trả</Text>
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
                  placeholder="VD: Chuyển khoản, tiền mặt..."
                  placeholderTextColor={colors.textMuted}
                  style={[styles.fieldInput, { color: colors.textPrimary }]}
                />
              </View>
              <NoteSuggestionChips
                suggestions={['Chuyển khoản', 'Tiền mặt', 'Cấn trừ', 'Trả bớt', 'Trả hết']}
                currentNote={note}
                onSelectNote={setNote}
              />
            </View>
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
              Xác nhận trả
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
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
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
  quickPayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
  },
  quickPayText: {
    fontSize: 12,
    fontWeight: '600',
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
  fieldInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
    marginLeft: 12,
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
});
