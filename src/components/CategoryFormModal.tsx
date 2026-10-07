// src/components/CategoryFormModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Category } from '../storage/sqlite';
import { useTheme } from '../context/ThemeContext';
import { AVAILABLE_CATEGORY_ICONS, renderCategoryIcon } from '../constants/categoryIcons';

interface CategoryFormModalProps {
  visible: boolean;
  initialCategory?: Category | null;
  defaultType: 'EXPENSE' | 'INCOME';
  onSave: (data: { name: string; icon: string; type: 'EXPENSE' | 'INCOME' }) => void;
  onClose: () => void;
}

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  visible,
  initialCategory,
  defaultType,
  onSave,
  onClose,
}) => {
  const { isDark, colors } = useTheme();

  const isEdit = Boolean(initialCategory);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Tag');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>(defaultType);

  useEffect(() => {
    if (visible) {
      if (initialCategory) {
        setName(initialCategory.name);
        setIcon(initialCategory.icon);
        setType(initialCategory.type);
      } else {
        setName('');
        setIcon(defaultType === 'INCOME' ? 'Banknote' : 'ShoppingBag');
        setType(defaultType);
      }
    }
  }, [visible, initialCategory, defaultType]);

  const handleSelectIcon = (iconName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIcon(iconName);
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({
      name: trimmed,
      icon,
      type,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheetContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {isEdit ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Live Preview Card */}
            <View style={[styles.previewCard, { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle }]}>
              <View style={[styles.previewIconBox, { backgroundColor: isDark ? '#27272A' : '#FFFFFF' }]}>
                {renderCategoryIcon(icon, 28, '#EA580C')}
              </View>
              <View style={styles.previewInfo}>
                <Text style={[styles.previewTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {name.trim() || 'Tên danh mục'}
                </Text>
                <Text style={[styles.previewSubtitle, { color: colors.textMuted }]}>
                  {type === 'EXPENSE' ? 'Danh mục Chi tiêu' : 'Danh mục Thu nhập'}
                </Text>
              </View>
            </View>

            {/* Type Selector (only when adding new) */}
            {!isEdit && (
              <View style={styles.typeSelectorRow}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setType('EXPENSE');
                  }}
                  style={[
                    styles.typeBtn,
                    { backgroundColor: type === 'EXPENSE' ? (isDark ? '#431407' : '#FFF7ED') : colors.cardSecondary },
                    type === 'EXPENSE' && { borderColor: '#EA580C', borderWidth: 1.5 },
                  ]}
                >
                  <Text style={[styles.typeBtnText, { color: type === 'EXPENSE' ? '#EA580C' : colors.textMuted }]}>
                    Chi tiêu
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setType('INCOME');
                  }}
                  style={[
                    styles.typeBtn,
                    { backgroundColor: type === 'INCOME' ? (isDark ? '#052E16' : '#F0FDF4') : colors.cardSecondary },
                    type === 'INCOME' && { borderColor: '#16A34A', borderWidth: 1.5 },
                  ]}
                >
                  <Text style={[styles.typeBtnText, { color: type === 'INCOME' ? '#16A34A' : colors.textMuted }]}>
                    Thu nhập
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Input Name */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>TÊN DANH MỤC</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle }]}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="VD: Nuôi thú cưng, Quà tặng..."
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { color: colors.textPrimary }]}
                maxLength={40}
              />
            </View>

            {/* Icon Picker Grid */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 16 }]}>CHỌN BIỂU TƯỢNG</Text>
            <View style={styles.iconGrid}>
              {AVAILABLE_CATEGORY_ICONS.map((opt) => {
                const isSelected = opt.name === icon;
                return (
                  <Pressable
                    key={opt.name}
                    onPress={() => handleSelectIcon(opt.name)}
                    style={[
                      styles.iconGridItem,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? '#431407' : '#FFF7ED')
                          : (isDark ? colors.cardSecondary : '#F8F9FA'),
                        borderColor: isSelected ? '#EA580C' : 'transparent',
                      },
                    ]}
                  >
                    {renderCategoryIcon(opt.name, 22, isSelected ? '#EA580C' : colors.textSecondary)}
                    <Text
                      style={[
                        styles.iconLabel,
                        { color: isSelected ? '#EA580C' : colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Bottom Actions */}
          <View style={[styles.bottomActions, { borderTopColor: colors.borderSubtle }]}>
            <Pressable
              onPress={onClose}
              style={[styles.cancelBtn, { backgroundColor: colors.cardSecondary }]}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Hủy</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!name.trim()}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: name.trim()
                    ? (isDark ? '#FAFAFA' : '#0F172A')
                    : (isDark ? '#27272A' : '#CBD5E1'),
                },
              ]}
            >
              <Check size={18} color={name.trim() ? (isDark ? '#09090B' : '#FFFFFF') : colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.saveBtnText, { color: name.trim() ? (isDark ? '#09090B' : '#FFFFFF') : colors.textMuted }]}>
                {isEdit ? 'Lưu thay đổi' : 'Tạo danh mục'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  previewIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  previewInfo: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  previewSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputWrap: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    fontSize: 15,
    fontWeight: '600',
    padding: 0,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  iconGridItem: {
    width: '22.5%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  iconLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
    height: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
