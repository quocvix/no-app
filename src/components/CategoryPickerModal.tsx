// src/components/CategoryPickerModal.tsx
import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { Category } from '../storage/sqlite';
import { useTheme } from '../context/ThemeContext';
import { renderCategoryIcon } from '../constants/categoryIcons';

interface CategoryPickerModalProps {
  visible: boolean;
  categories: Category[];
  selectedId: string;
  onSelect: (cat: Category) => void;
  onClose: () => void;
}

export const getCategoryIcon = renderCategoryIcon;

export const CategoryPickerModal: React.FC<CategoryPickerModalProps> = ({
  visible,
  categories,
  selectedId,
  onSelect,
  onClose,
}) => {
  const { isDark, colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Chọn danh mục</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.list}>
            {categories.map((cat) => {
              const isSelected = cat.id === selectedId;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    onSelect(cat);
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
                  <View style={[styles.iconWrap, { backgroundColor: isDark ? colors.card : '#F1F5F9' }, isSelected && styles.iconWrapSelected]}>
                    {getCategoryIcon(cat.icon, 18, isSelected ? '#F97316' : colors.textSecondary)}
                  </View>
                  <Text style={[styles.itemText, { color: colors.textPrimary }, isSelected && styles.itemTextSelected]}>
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
    marginBottom: 20,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  item: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  itemSelected: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconWrapSelected: {
    backgroundColor: '#FFEDD5',
  },
  itemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  itemTextSelected: {
    color: '#EA580C',
    fontWeight: '700',
  },
});
