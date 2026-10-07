// src/screens/CategoryManagementScreen.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Pencil, Trash2, Info, ShieldCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import {
  Category,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryHidden,
  getCategoryUsageCount,
} from '../storage/sqlite';
import { renderCategoryIcon } from '../constants/categoryIcons';
import { CategoryFormModal } from '../components/CategoryFormModal';

interface CategoryManagementScreenProps {
  onBack: () => void;
  onCategoryChange?: () => void;
}

type TabType = 'EXPENSE' | 'INCOME';

export const CategoryManagementScreen: React.FC<CategoryManagementScreenProps> = ({
  onBack,
  onCategoryChange,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();

  const [activeTab, setActiveTab] = useState<TabType>('EXPENSE');
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  const hasChanged = useRef(false);

  const reloadCategories = useCallback(() => {
    // Include hidden categories in management screen
    const all = getCategories({ includeHidden: true });
    setCategories(all);

    // Compute usage counts for each category
    const counts: Record<string, number> = {};
    for (const cat of all) {
      counts[cat.id] = getCategoryUsageCount(cat.id);
    }
    setUsageCounts(counts);
  }, []);

  useEffect(() => {
    reloadCategories();
  }, [reloadCategories]);

  const handleBack = () => {
    if (hasChanged.current) {
      onCategoryChange?.();
    }
    onBack();
  };

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => c.type === activeTab && c.id !== 'cat_debt');
  }, [categories, activeTab]);

  const expenseCount = useMemo(
    () => categories.filter((c) => c.type === 'EXPENSE' && c.id !== 'cat_debt').length,
    [categories]
  );
  const incomeCount = useMemo(
    () => categories.filter((c) => c.type === 'INCOME' && c.id !== 'cat_debt').length,
    [categories]
  );

  const handleTabChange = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const handleToggleHidden = (cat: Category, currentlyHidden: boolean) => {
    if (cat.id === 'cat_other') {
      Alert.alert('Không thể ẩn', 'Danh mục "Khác" là danh mục mặc định của hệ thống và luôn được duy trì.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextHidden = !currentlyHidden;

    // Optimistic update local state immediately so UI won't stutter/flicker
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, is_hidden: nextHidden ? 1 : 0 } : c))
    );

    // Persist in background
    toggleCategoryHidden(cat.id, nextHidden);
    hasChanged.current = true;
  };

  const handleDeleteCategory = (cat: Category) => {
    if (cat.id === 'cat_other' || cat.id === 'cat_debt') {
      Alert.alert('Không thể xóa', 'Đây là danh mục hệ thống và không thể xóa.');
      return;
    }

    const count = usageCounts[cat.id] ?? 0;
    const confirmMsg =
      count > 0
        ? `Bạn có chắc muốn xóa danh mục "${cat.name}"?\n${count} giao dịch trước đây thuộc danh mục này sẽ được tự động chuyển sang danh mục "Khác".`
        : `Bạn có chắc muốn xóa danh mục "${cat.name}"?`;

    Alert.alert('Xác nhận xóa danh mục', confirmMsg, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          const success = deleteCategory(cat.id);
          if (success) {
            setCategories((prev) => prev.filter((c) => c.id !== cat.id));
            if (count > 0) {
              setUsageCounts((prev) => ({
                ...prev,
                cat_other: (prev.cat_other ?? 0) + count,
              }));
            }
            hasChanged.current = true;
          }
        },
      },
    ]);
  };

  const handleOpenAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingCategory(null);
    setShowFormModal(true);
  };

  const handleOpenEdit = (cat: Category) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingCategory(cat);
    setShowFormModal(true);
  };

  const handleSaveCategory = (data: {
    name: string;
    icon: string;
    type: 'EXPENSE' | 'INCOME';
  }) => {
    if (editingCategory) {
      updateCategory(editingCategory.id, {
        name: data.name,
        icon: data.icon,
      });
    } else {
      createCategory({
        name: data.name,
        icon: data.icon,
        type: data.type,
      });
    }
    reloadCategories();
    hasChanged.current = true;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: colors.borderSubtle,
          },
        ]}
      >
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={22} color="#F97316" />
          <Text style={styles.backBtnText}>Cài đặt</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Quản lý danh mục
        </Text>
        <Pressable
          onPress={handleOpenAdd}
          hitSlop={12}
          style={[styles.addBtn, { backgroundColor: isDark ? '#FAFAFA' : '#0F172A' }]}
        >
          <Plus size={18} color={isDark ? '#09090B' : '#FFFFFF'} />
        </Pressable>
      </View>

      {/* Segmented Tabs */}
      <View style={styles.tabContainer}>
        <View style={[styles.tabBar, { backgroundColor: colors.cardSecondary }]}>
          <Pressable
            onPress={() => handleTabChange('EXPENSE')}
            style={[
              styles.tabItem,
              activeTab === 'EXPENSE' && [
                styles.tabItemActive,
                { backgroundColor: colors.card, borderColor: colors.border },
              ],
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'EXPENSE' ? '#EA580C' : colors.textMuted },
              ]}
            >
              Chi tiêu ({expenseCount})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleTabChange('INCOME')}
            style={[
              styles.tabItem,
              activeTab === 'INCOME' && [
                styles.tabItemActive,
                { backgroundColor: colors.card, borderColor: colors.border },
              ],
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'INCOME' ? '#16A34A' : colors.textMuted },
              ]}
            >
              Thu nhập ({incomeCount})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Category List */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {filteredCategories.map((cat, idx) => {
            const isHidden = Boolean(cat.is_hidden);
            const isSystemDefault = cat.id === 'cat_other';
            const count = usageCounts[cat.id] ?? 0;
            const isLast = idx === filteredCategories.length - 1;

            return (
              <View key={cat.id}>
                <View style={styles.row}>
                  {/* Left: Icon & Info */}
                  <View style={styles.rowLeft}>
                    <View
                      style={[
                        styles.iconBox,
                        {
                          backgroundColor: isHidden
                            ? (isDark ? '#27272A' : '#F1F5F9')
                            : colors.cardSecondary,
                          opacity: isHidden ? 0.6 : 1,
                        },
                      ]}
                    >
                      {renderCategoryIcon(
                        cat.icon,
                        20,
                        isHidden ? colors.textMuted : (cat.type === 'INCOME' ? '#16A34A' : '#EA580C')
                      )}
                    </View>
                    <View style={styles.infoWrap}>
                      <View style={styles.titleRow}>
                        <Text
                          style={[
                            styles.catTitle,
                            {
                              color: isHidden ? colors.textMuted : colors.textPrimary,
                              textDecorationLine: isHidden ? 'line-through' : 'none',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {cat.name}
                        </Text>
                        {isSystemDefault && (
                          <View style={[styles.defaultBadge, { backgroundColor: isDark ? '#27272A' : '#F1F5F9' }]}>
                            <Text style={[styles.defaultBadgeText, { color: colors.textMuted }]}>
                              Mặc định
                            </Text>
                          </View>
                        )}
                        {isHidden && (
                          <View style={styles.hiddenBadge}>
                            <Text style={styles.hiddenBadgeText}>Đã ẩn</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.catSubtitle, { color: colors.textMuted }]}>
                        {count > 0 ? `${count} giao dịch đã ghi` : 'Chưa có giao dịch'}
                      </Text>
                    </View>
                  </View>

                  {/* Right: Actions */}
                  <View style={styles.rowRight}>
                    {/* Edit button */}
                    <Pressable
                      onPress={() => handleOpenEdit(cat)}
                      hitSlop={8}
                      style={[styles.actionBtn, { backgroundColor: colors.cardSecondary }]}
                    >
                      <Pencil size={15} color={colors.textSecondary} />
                    </Pressable>

                    {/* Delete button (except for default category) */}
                    {!isSystemDefault && (
                      <Pressable
                        onPress={() => handleDeleteCategory(cat)}
                        hitSlop={8}
                        style={[
                          styles.actionBtn,
                          { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' },
                        ]}
                      >
                        <Trash2 size={15} color="#EF4444" />
                      </Pressable>
                    )}

                    {/* Hidden Toggle Switch */}
                    <Switch
                      value={!isHidden}
                      onValueChange={() => handleToggleHidden(cat, isHidden)}
                      disabled={isSystemDefault}
                      trackColor={{ false: colors.border, true: cat.type === 'INCOME' ? '#16A34A' : '#EA580C' }}
                      thumbColor="#FFFFFF"
                      style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                    />
                  </View>
                </View>
                {!isLast && (
                  <View style={[styles.rowDivider, { backgroundColor: colors.borderSubtle }]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Informational Guidance Box */}
        <View style={[styles.infoBox, { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle }]}>
          <Info size={16} color="#F97316" style={{ marginRight: 8, marginTop: 1 }} />
          <Text style={[styles.infoBoxText, { color: colors.textSecondary }]}>
            Gạt tắt để ẩn danh mục không còn sử dụng. Toàn bộ các giao dịch và báo cáo trong quá khứ vẫn được giữ nguyên đầy đủ.
          </Text>
        </View>
      </ScrollView>

      {/* Form Modal */}
      <CategoryFormModal
        visible={showFormModal}
        initialCategory={editingCategory}
        defaultType={activeTab}
        onSave={handleSaveCategory}
        onClose={() => {
          setShowFormModal(false);
          setEditingCategory(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 8,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F97316',
    marginLeft: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  catTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  hiddenBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  hiddenBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#DC2626',
  },
  catSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDivider: {
    height: 1,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  infoBoxText: {
    fontSize: 12.5,
    lineHeight: 18,
    flex: 1,
    fontWeight: '500',
  },
});
