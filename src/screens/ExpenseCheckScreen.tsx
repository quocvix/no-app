import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
  Keyboard,
} from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown, ChevronRight, Edit3, Utensils, Clock, Wallet, Landmark, ExternalLink } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AmountSuggestionBar } from '../components/AmountSuggestionBar';
import { BankHandoffSheet } from '../components/BankHandoffSheet';
import { CategoryPickerModal, getCategoryIcon } from '../components/CategoryPickerModal';
import { BankPickerModal } from '../components/BankPickerModal';
import { VietQRData } from '../services/vietqrParser';
import { getBankByCode, BankMeta } from '../constants/banks';
import { getCategories, insertTransaction, updateTransaction, Category, Transaction } from '../storage/sqlite';
import { storage, STORAGE_KEYS } from '../storage/mmkv';
import { useTheme } from '../context/ThemeContext';
import { DateQuickPicker } from '../components/DateQuickPicker';
import { NoteSuggestionChips } from '../components/NoteSuggestionChips';

// Hoist Intl Currency Formatter outside component scope (rule: js-hoist-intl)
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

interface ExpenseCheckScreenProps {
  qrData?: VietQRData;
  editingTx?: Transaction;
  onBack: () => void;
  onDone: () => void;
}

export const ExpenseCheckScreen: React.FC<ExpenseCheckScreenProps> = ({
  qrData,
  editingTx,
  onBack,
  onDone,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const categories = useMemo(() => getCategories(), []);
  const isEditMode = Boolean(editingTx);
  const isManualEntry = !isEditMode && (!qrData || !qrData.isValid);

  // Initial amount: from editingTx, from QR or default '0' for manual entry
  const initialAmount = editingTx
    ? editingTx.amount.toString()
    : isManualEntry
    ? '0'
    : qrData?.amount !== undefined
    ? qrData.amount.toString()
    : '0';
  const [amountStr, setAmountStr] = useState(initialAmount);
  const amountInputRef = useRef<TextInput>(null);

  // Payment method: Cash vs Bank
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK'>(() => {
    if (editingTx?.source_bank_code === 'CASH') return 'CASH';
    return 'BANK';
  });

  // Expandable date picker
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  // Auto-focus amount input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  // Default source bank from MMKV or editingTx
  const defaultBankCode = editingTx?.source_bank_code || storage.getString(STORAGE_KEYS.DEFAULT_SOURCE_BANK) || 'BIDV';
  const [selectedBank, setSelectedBank] = useState<BankMeta>(() => getBankByCode(defaultBankCode));

  // Category
  const initialCat = editingTx
    ? categories.find((c) => c.id === editingTx.category_id) || categories[0]
    : categories.find((c) => c.id === 'cat_food') || categories[0] || {
        id: 'cat_food',
        name: 'Ăn uống',
        icon: 'Utensils',
        type: 'EXPENSE' as const,
        sort_order: 1,
      };
  const [selectedCategory, setSelectedCategory] = useState<Category>(initialCat);

  // Note
  const [note, setNote] = useState(editingTx ? (editingTx.note || '') : (qrData?.memo || ''));
  const [isEditingNote, setIsEditingNote] = useState(false);

  // Created at date
  const [createdAt, setCreatedAt] = useState(editingTx ? editingTx.created_at : Date.now());

  // Modals & Sheets
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showHandoffSheet, setShowHandoffSheet] = useState(false);

  // Cursor blink simulation
  const [cursorVisible, setCursorVisible] = useState(true);
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 600);
    return () => clearInterval(timer);
  }, []);

  const handleDigit = useCallback((val: string) => {
    setAmountStr((prev) => {
      if (prev === '0') return val;
      if (prev.length >= 11) return prev;
      return prev + val;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setAmountStr((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  }, []);

  const handleClear = useCallback(() => {
    setAmountStr('0');
  }, []);

  const parsedAmount = parseInt(amountStr || '0', 10);
  const formattedAmount = vnCurrencyFormatter.format(parsedAmount);

  // Recipient details
  const recipientBank = editingTx?.receiver_bank_code || qrData?.bankCode || 'TCB';
  const recipientAccount = editingTx?.receiver_account || qrData?.accountNumber || '2023130298';

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    amountInputRef.current?.blur();
  }, []);

  const handleOpenTransfer = () => {
    dismissKeyboard();

    if (parsedAmount <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (isEditMode && editingTx) {
      // Lưu chỉnh sửa ngay, không mở bank handoff
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const finalBankCode = paymentMethod === 'CASH' ? 'CASH' : selectedBank.code;
      updateTransaction(editingTx.id, {
        amount: parsedAmount,
        type: selectedCategory.type,
        category_id: selectedCategory.id,
        source_bank_code: finalBankCode,
        note,
        created_at: createdAt,
      });
      onDone();
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowHandoffSheet(true);
  };

  const handleSaveDirect = () => {
    dismissKeyboard();

    if (parsedAmount <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    const finalBankCode = paymentMethod === 'CASH' ? 'CASH' : selectedBank.code;

    if (isEditMode && editingTx) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateTransaction(editingTx.id, {
        amount: parsedAmount,
        type: selectedCategory.type,
        category_id: selectedCategory.id,
        source_bank_code: finalBankCode,
        note,
        created_at: createdAt,
      });
      onDone();
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    insertTransaction({
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      amount: parsedAmount,
      type: selectedCategory.type,
      category_id: selectedCategory.id,
      source_bank_code: finalBankCode,
      receiver_name: paymentMethod === 'CASH' ? 'Tiền mặt' : selectedBank.shortName,
      receiver_account: '',
      receiver_bank_code: finalBankCode,
      note: note.trim(),
      raw_qr: '',
      created_at: createdAt,
    });
    onDone();
  };

  const handleConfirmTransaction = () => {
    // Save to SQLite
    insertTransaction({
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      amount: parsedAmount,
      type: selectedCategory.type,
      category_id: selectedCategory.id,
      source_bank_code: selectedBank.code,
      receiver_name: qrData?.memo || 'Người nhận',
      receiver_account: recipientAccount,
      receiver_bank_code: recipientBank,
      note: note || (qrData?.memo ?? ''),
      raw_qr: qrData?.rawPayload || '',
      created_at: createdAt,
    });

    setShowHandoffSheet(false);
    onDone();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Animated.View style={[styles.mainWrapper, animatedContainerStyle]}>
        {/* Top Header */}
        <View style={[styles.topNav, { borderBottomColor: colors.borderSubtle }]}>
        <Pressable
          onPress={() => {
            dismissKeyboard();
            onBack();
          }}
          hitSlop={12}
          style={styles.backButton}
        >
          <ChevronLeft size={22} color="#F97316" />
          <Text style={styles.backButtonText}>
            {isEditMode ? 'Hủy' : isManualEntry ? 'Đóng' : 'Quét QR'}
          </Text>
        </Pressable>

        <Text style={[styles.navTitle, { color: colors.textPrimary }]}>
          {isEditMode ? 'Sửa khoản chi' : isManualEntry ? 'Ghi chép chi tiêu' : 'Kiểm tra khoản chi'}
        </Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Payment Method Segmented Control (only when manual entry or editing) */}
        {(isManualEntry || isEditMode) && (
          <View style={[styles.segmentContainer, { backgroundColor: colors.cardSecondary }]}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPaymentMethod('CASH');
              }}
              style={[
                styles.segmentBtn,
                paymentMethod === 'CASH' && { backgroundColor: isDark ? '#3F3F46' : '#FFFFFF' },
              ]}
            >
              <Wallet
                size={16}
                color={paymentMethod === 'CASH' ? '#16A34A' : colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: paymentMethod === 'CASH' ? colors.textPrimary : colors.textMuted },
                ]}
              >
                Tiền mặt
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPaymentMethod('BANK');
              }}
              style={[
                styles.segmentBtn,
                paymentMethod === 'BANK' && { backgroundColor: isDark ? '#3F3F46' : '#FFFFFF' },
              ]}
            >
              <Landmark
                size={16}
                color={paymentMethod === 'BANK' ? '#3B82F6' : colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: paymentMethod === 'BANK' ? colors.textPrimary : colors.textMuted },
                ]}
              >
                Ngân hàng
              </Text>
            </Pressable>
          </View>
        )}

        {/* Recipient subtitle - only for valid scanned QR */}
        {!isManualEntry && !isEditMode && qrData?.isValid && (
          <>
            <Text style={[styles.recipientLabel, { color: colors.textMuted }]}>Người nhận</Text>
            <Text style={[styles.recipientValue, { color: colors.textSecondary }]}>
              {recipientBank} · {recipientAccount}
            </Text>
          </>
        )}

        {/* Huge Amount Display with cursor */}
        <Pressable
          onPress={() => amountInputRef.current?.focus()}
          style={styles.amountDisplayRow}
        >
          <Text style={[styles.amountText, { color: colors.textPrimary }]}>{formattedAmount}</Text>
          <Text style={[styles.amountCursor, { color: colors.textPrimary, opacity: cursorVisible ? 1 : 0 }]}>|</Text>
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

        {/* Input Card: Category, Date & Note */}
        <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Category Item */}
          <Pressable
            onPress={() => {
              dismissKeyboard();
              setShowCategoryModal(true);
            }}
            style={styles.cardRow}
          >
            <View style={styles.cardRowLeft}>
              <View style={[styles.rowIconBox, { backgroundColor: colors.cardSecondary }]}>
                {getCategoryIcon(selectedCategory.icon, 18, colors.textSecondary)}
              </View>
              <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>Danh mục</Text>
            </View>
            <View style={styles.cardRowRight}>
              <Text style={[styles.cardRowValue, { color: colors.textPrimary }]}>{selectedCategory.name}</Text>
              <ChevronRight size={18} color={colors.textMuted} />
            </View>
          </Pressable>

          {/* Time Item (collapsible DateQuickPicker) */}
          <View style={[styles.cardDivider, { backgroundColor: colors.borderSubtle }]} />
          <Pressable
            onPress={() => {
              dismissKeyboard();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowDatePicker((prev) => !prev);
            }}
            style={styles.cardRow}
          >
            <View style={styles.cardRowLeft}>
              <View style={[styles.rowIconBox, { backgroundColor: colors.cardSecondary }]}>
                <Clock size={18} color={colors.textSecondary} />
              </View>
              <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>Thời gian</Text>
            </View>
            <View style={styles.cardRowRight}>
              <Text style={[styles.cardRowValue, { color: colors.textPrimary }]}>
                {formatDateTimeDisplay(createdAt)}
              </Text>
              <ChevronDown
                size={16}
                color={colors.textMuted}
                style={{
                  marginLeft: 6,
                  transform: [{ rotate: showDatePicker ? '180deg' : '0deg' }],
                }}
              />
            </View>
          </Pressable>

          {showDatePicker && (
            <View style={styles.cardDateContent}>
              <DateQuickPicker value={createdAt} onChange={setCreatedAt} surface="card" />
            </View>
          )}

          {/* Divider */}
          <View style={[styles.cardDivider, { backgroundColor: colors.borderSubtle }]} />

          {/* Note Item with Suggestion Chips */}
          <View style={styles.noteBlock}>
            <View style={styles.cardRow}>
              <View style={styles.cardRowLeft}>
                <View style={[styles.rowIconBox, { backgroundColor: colors.cardSecondary }]}>
                  <Edit3 size={18} color={colors.textSecondary} />
                </View>
                <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>Ghi chú</Text>
              </View>
              <View style={styles.cardRowRightFlex}>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Thêm ghi chú (không bắt buộc)"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.noteInput, { color: colors.textPrimary }]}
                />
              </View>
            </View>
            <NoteSuggestionChips
              suggestions={['Ăn uống', 'Cà phê', 'Đi chợ', 'Mua sắm', 'Đổ xăng', 'Tiền trọ']}
              currentNote={note}
              onSelectNote={setNote}
              containerStyle={{ paddingBottom: 10, paddingHorizontal: 4 }}
            />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Accessory Section: Suggestion Bar + Action Bar */}
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

        <View style={styles.bottomBar}>
          {paymentMethod === 'BANK' && (
            <Pressable
              onPress={() => {
                dismissKeyboard();
                setShowBankModal(true);
              }}
              style={[styles.bankPill, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[styles.bankPillText, { color: colors.textPrimary }]}>{selectedBank.code}</Text>
              <ChevronDown size={14} color={colors.textMuted} style={{ marginLeft: 4 }} />
            </Pressable>
          )}

          {paymentMethod === 'CASH' && (
            <View
              style={[styles.bankPill, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Wallet size={14} color="#16A34A" style={{ marginRight: 4 }} />
              <Text style={[styles.bankPillText, { color: colors.textPrimary }]}>Tiền mặt</Text>
            </View>
          )}

          <Pressable
            onPress={isManualEntry || isEditMode ? handleSaveDirect : handleOpenTransfer}
            style={[styles.transferCta, isDark && { backgroundColor: '#FAFAFA' }]}
          >
            <Text style={[styles.transferCtaText, isDark && { color: '#09090B' }]}>
              {isEditMode ? 'Lưu thay đổi' : isManualEntry ? 'Lưu khoản chi' : 'Chuyển khoản'}
            </Text>
          </Pressable>

          {/* Nếu là Manual Entry và chọn BANK: Nút phụ mở app ngân hàng */}
          {isManualEntry && paymentMethod === 'BANK' && (
            <Pressable
              onPress={() => {
                dismissKeyboard();
                if (parsedAmount <= 0) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowHandoffSheet(true);
              }}
              style={[styles.bankAppSubBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              hitSlop={8}
            >
              <ExternalLink size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </Animated.View>
    </Animated.View>

      {/* Modals & Bottom Sheet */}
      <CategoryPickerModal
        visible={showCategoryModal}
        categories={categories}
        selectedId={selectedCategory.id}
        onSelect={(cat) => setSelectedCategory(cat)}
        onClose={() => setShowCategoryModal(false)}
      />

      <BankPickerModal
        visible={showBankModal}
        selectedCode={selectedBank.code}
        onSelect={(b) => setSelectedBank(b)}
        onClose={() => setShowBankModal(false)}
      />

      {showHandoffSheet && (
        <BankHandoffSheet
          bankCode={selectedBank.code}
          amount={parsedAmount}
          recipientAccount={recipientAccount}
          recipientBankCode={recipientBank}
          recipientBankBin={qrData?.bankBin}
          memo={note || qrData?.memo}
          rawQrCode={qrData?.rawPayload || editingTx?.raw_qr}
          onConfirm={handleConfirmTransaction}
          onClose={() => setShowHandoffSheet(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mainWrapper: {
    flex: 1,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexShrink: 0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F97316',
    marginLeft: 2,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  navSpacer: {
    width: 72,
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  recipientLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
    marginBottom: 4,
  },
  recipientValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 16,
  },
  amountDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  amountText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  amountCursor: {
    fontSize: 42,
    fontWeight: '300',
    color: '#0F172A',
    marginHorizontal: 1,
  },
  amountCurrency: {
    fontSize: 42,
    fontWeight: '700',
    color: '#0F172A',
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    paddingVertical: 4,
    paddingHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  cardRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EDF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardRowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#475569',
  },
  cardRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardRowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 4,
  },
  cardRowRightFlex: {
    flex: 1,
    marginLeft: 16,
    alignItems: 'flex-end',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  cardDateBlock: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cardDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardDateFormatted: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardDateContent: {
    width: '100%',
  },
  noteText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  notePlaceholder: {
    color: '#94A3B8',
    fontWeight: '400',
  },
  noteInput: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    padding: 0,
    width: '100%',
    textAlign: 'right',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  bottomSection: {
    borderTopWidth: 1,
    borderTopColor: 'transparent',
    paddingTop: 4,
    flexShrink: 0,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  bankPill: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingHorizontal: 18,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bankPillPressed: {
    backgroundColor: '#E2E8F0',
  },
  bankPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  transferCta: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 20,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  transferCtaPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  transferCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    marginBottom: 8,
    width: '100%',
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
  bankAppSubBtn: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  noteBlock: {
    width: '100%',
  },
});
