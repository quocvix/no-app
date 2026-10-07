// src/components/BankHandoffSheet.tsx
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Keyboard, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { Copy, Check, QrCode } from 'lucide-react-native';
import { SUPPORTED_BANKS, getBankByCode, launchBankingApp } from '../constants/banks';
import { generateVietQR } from '../services/vietqrGenerator';
import { shareQrImageToBank } from '../services/qrImageShareService';
import { useTheme } from '../context/ThemeContext';

const vnCurrencyFormatter = new Intl.NumberFormat('vi-VN');

interface BankHandoffSheetProps {
  bankCode: string;
  amount: number;
  recipientAccount?: string;
  recipientBankCode?: string;
  recipientBankBin?: string;
  recipientName?: string;
  memo?: string;
  rawQrCode?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const BankHandoffSheet: React.FC<BankHandoffSheetProps> = ({
  bankCode,
  amount,
  recipientAccount,
  recipientBankCode,
  recipientBankBin,
  recipientName,
  memo,
  rawQrCode,
  onConfirm,
  onClose,
}) => {
  const { isDark, colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['59%'], []);
  const bank = getBankByCode(bankCode);

  const [copiedType, setCopiedType] = useState<'account' | 'amount' | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    Keyboard.dismiss();
    bottomSheetRef.current?.expand();
  }, []);

  const handleCopyAccount = async () => {
    if (!recipientAccount) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(recipientAccount);
    setCopiedType('account');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyAmount = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(amount.toString());
    setCopiedType('amount');
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Cách 2: Chia sẻ trực tiếp ảnh QR vào MB Bank qua Android Intent (ACTION_SEND)
  const handleShareQrToBank = async () => {
    setIsSharing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      // 1. Sao chép STK người nhận vào Clipboard trước
      if (recipientAccount) {
        await Clipboard.setStringAsync(recipientAccount);
      } else {
        await Clipboard.setStringAsync(amount.toString());
      }

      const targetBin = recipientBankBin || (recipientBankCode ? getBankByCode(recipientBankCode)?.bin : undefined) || '970422';

      if (recipientAccount) {
        const shared = await shareQrImageToBank({
          bankBin: targetBin,
          accountNo: recipientAccount,
          amount: amount,
          memo: memo,
          packageName: bank.packageName || 'com.mbmobile',
        });
        if (!shared) {
          // Fallback sang Deep link nếu không thể share ảnh
          await handleOpenBankDeepLink();
        }
      } else {
        await handleOpenBankDeepLink();
      }
    } catch (err) {
      console.warn('Lỗi chia sẻ ảnh QR sang bank, fallback deep link:', err);
      await handleOpenBankDeepLink();
    } finally {
      setIsSharing(false);
      onConfirm();
    }
  };

  // Cách Deep Link: Mở trực tiếp bằng URI Scheme
  const handleOpenBankDeepLink = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      if (recipientAccount) {
        await Clipboard.setStringAsync(recipientAccount);
      } else {
        await Clipboard.setStringAsync(amount.toString());
      }

      // Chuẩn bị chuỗi raw QR chuẩn EMVCo động (Dynamic QR có đủ số tiền và nội dung)
      let qrPayloadToLaunch = rawQrCode;
      const targetBin = recipientBankBin || (recipientBankCode ? getBankByCode(recipientBankCode)?.bin : undefined);

      if (recipientAccount && targetBin) {
        try {
          qrPayloadToLaunch = await generateVietQR({
            bankBin: targetBin,
            accountNo: recipientAccount,
            amount: amount,
            memo: memo,
            accountName: recipientName,
          });
        } catch (err) {
          console.warn('Failed to generate dynamic VietQR payload, falling back to rawQrCode:', err);
        }
      }

      // Kích hoạt App-to-App Deep Link với chuỗi raw EMVCo VietQR (?data=...)
      const opened = await launchBankingApp(bank.code, qrPayloadToLaunch);

      // Nếu chưa mở được và có STK: Thử dự phòng qua cổng Universal link
      if (!opened && recipientAccount) {
        try {
          const VIETQR_SOURCE_APP: Record<string, string> = {
            MB: 'mb',
            BIDV: 'bidv',
            CTG: 'icb',
            TCB: 'tcb',
            VCB: 'vcb',
            VPB: 'vpb',
            TPB: 'tpb',
            ACB: 'acb',
            OCB: 'ocb',
            MOMO: 'momo',
          };
          const sourceApp = VIETQR_SOURCE_APP[bank.code] || bank.code.toLowerCase();
          const targetBank = recipientBankCode?.toLowerCase() || '';
          const baParam = targetBank ? `${recipientAccount}@${targetBank}` : recipientAccount;
          const encodedMemo = encodeURIComponent(memo || '');
          const vietQrDeepLink = `https://dl.vietqr.io/pay?app=${sourceApp}&ba=${baParam}&am=${amount}&tn=${encodedMemo}`;
          await Linking.openURL(vietQrDeepLink);
        } catch {
          // Bỏ qua lỗi
        }
      }
    } catch (err) {
      console.warn('Bank launcher warning:', err);
    }
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onClose={onClose}
      enablePanDownToClose
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      )}
      backgroundStyle={[styles.sheetBackground, { backgroundColor: colors.card }]}
      handleIndicatorStyle={[styles.handleIndicator, { backgroundColor: colors.border }]}
    >
      <BottomSheetView style={styles.contentContainer}>
        {/* Bank Header Info */}
        <View style={styles.headerRow}>
          <View style={[styles.bankBadge, { backgroundColor: colors.cardSecondary }]}>
            <Text style={[styles.bankBadgeText, { color: colors.textPrimary }]}>{bank.code}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bankTitle, { color: colors.textPrimary }]}>Mở {bank.shortName}</Text>
            <Text style={[styles.bankSubtitle, { color: colors.textMuted }]}>
              {recipientAccount ? 'Đã sao chép sẵn STK để app tự nhận' : `${bank.shortName} sẽ điền sẵn thông tin`}
            </Text>
          </View>
        </View>

        {/* Recipient Details & Quick Copy */}
        {recipientAccount ? (
          <View style={[styles.infoCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Tài khoản thụ hưởng</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {recipientBankCode ? `${recipientBankCode} · ` : ''}{recipientAccount}
                </Text>
                {recipientName ? (
                  <Text style={[styles.infoSubValue, { color: colors.textSecondary }]}>{recipientName}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={handleCopyAccount}
                style={[styles.copyChip, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                {copiedType === 'account' ? (
                  <>
                    <Check size={13} color="#16A34A" />
                    <Text style={[styles.copyChipText, { color: '#16A34A' }]}>Đã chép</Text>
                  </>
                ) : (
                  <>
                    <Copy size={13} color="#F97316" />
                    <Text style={[styles.copyChipText, { color: '#F97316' }]}>Chép STK</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Amount Display */}
        <View style={[styles.amountContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <View style={styles.amountHeader}>
            <Text style={[styles.amountLabel, { color: colors.textMuted }]}>Số tiền chuyển</Text>
            <Pressable onPress={handleCopyAmount} style={styles.miniCopyBtn}>
              {copiedType === 'amount' ? (
                <Text style={styles.miniCopyTextDone}>Đã chép</Text>
              ) : (
                <Text style={[styles.miniCopyText, { color: colors.textMuted }]}>Chép tiền</Text>
              )}
            </Pressable>
          </View>
          <Text style={[styles.amountValue, { color: colors.textPrimary }]}>
            {vnCurrencyFormatter.format(amount)}đ
          </Text>
          {memo ? (
            <Text style={[styles.amountCaption, { color: colors.textMuted }]} numberOfLines={1}>
              Nội dung: {memo}
            </Text>
          ) : null}
        </View>

        {/* Actions: Cách 2 qua Intent (Chính) & Deep Link (Phụ) */}
        <View style={styles.actionContainer}>
          <Pressable
            onPress={handleShareQrToBank}
            disabled={isSharing}
            style={[styles.ctaButton, isDark && { backgroundColor: '#FAFAFA' }]}
          >
            {isSharing ? (
              <ActivityIndicator color={isDark ? '#09090B' : '#FFFFFF'} />
            ) : (
              <View style={styles.btnRow}>
                <QrCode size={18} color={isDark ? '#09090B' : '#FFFFFF'} style={{ marginRight: 8 }} />
                <Text style={[styles.ctaButtonText, isDark && { color: '#09090B' }]}>
                  Gửi ảnh QR sang {bank.shortName}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={async () => {
              await handleOpenBankDeepLink();
              onConfirm();
            }}
            disabled={isSharing}
            style={styles.secondaryButton}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
              Hoặc mở qua Deep Link
            </Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 20,
  },
  handleIndicator: {
    backgroundColor: '#E2E8F0',
    width: 44,
    height: 4,
    borderRadius: 2,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 14,
  },
  bankBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  bankTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  bankSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  amountContainer: {
    marginVertical: 6,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  amountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  amountLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  miniCopyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  miniCopyText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  miniCopyTextDone: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#16A34A',
  },
  amountValue: {
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  amountCaption: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  infoCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  infoSubValue: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  copyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  copyChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ctaButton: {
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
  },
  actionContainer: {
    width: '100%',
    marginTop: 6,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
