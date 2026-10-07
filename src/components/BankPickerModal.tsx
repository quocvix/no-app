import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ScrollView } from 'react-native';
import { X, Check } from 'lucide-react-native';
import { SUPPORTED_BANKS, BankMeta } from '../constants/banks';
import { useTheme } from '../context/ThemeContext';

interface BankPickerModalProps {
  visible: boolean;
  selectedCode: string;
  onSelect: (bank: BankMeta) => void;
  onClose: () => void;
}

export const BankPickerModal: React.FC<BankPickerModalProps> = ({
  visible,
  selectedCode,
  onSelect,
  onClose,
}) => {
  const { isDark, colors } = useTheme();
  const bankList = Object.values(SUPPORTED_BANKS).filter((b) => b.code !== 'CASH');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Chọn ngân hàng thanh toán</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {bankList.map((bank) => {
              const isSelected = bank.code === selectedCode;
              return (
                <Pressable
                  key={bank.code}
                  onPress={() => {
                    onSelect(bank);
                    onClose();
                  }}
                  style={[
                    styles.item,
                    {
                      backgroundColor: isSelected
                        ? (isDark ? '#431407' : '#FFF7ED')
                        : (isDark ? colors.cardSecondary : '#F8F9FA'),
                      borderColor: isSelected ? '#EA580C' : (isDark ? colors.border : 'transparent'),
                      borderWidth: 1,
                    },
                  ]}
                >
                  <View style={[styles.badge, { backgroundColor: isDark ? colors.card : '#E2E8F0' }]}>
                    <Text style={[styles.badgeText, { color: colors.textPrimary }]}>{bank.code}</Text>
                  </View>
                  <View style={styles.info}>
                    <Text style={[styles.shortName, { color: colors.textPrimary }]}>{bank.shortName}</Text>
                    <Text style={[styles.fullName, { color: colors.textMuted }]} numberOfLines={1}>{bank.name}</Text>
                  </View>
                  {isSelected && <Check size={18} color="#EA580C" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 12,
  },
  list: {
    maxHeight: 380,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  itemSelected: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  info: {
    flex: 1,
  },
  shortName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  fullName: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
});
