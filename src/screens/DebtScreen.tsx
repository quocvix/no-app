// src/screens/DebtScreen.tsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { ArrowUpRight, ArrowDownLeft, Plus, ChevronRight, BookOpen } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  getDebtTotals,
  getPersonSummaries,
  PersonDebtSummary,
} from '../storage/debts';
import { DebtFormSheet } from '../components/DebtFormSheet';
import { useTheme } from '../context/ThemeContext';

const vnCurrencyFormatter = new Intl.NumberFormat('vi-VN');

type FilterType = 'OPEN' | 'SETTLED' | 'ALL';

interface DebtScreenProps {
  onSelectPerson: (personName: string) => void;
  refreshTrigger?: number;
  onSheetVisibilityChange?: (isOpen: boolean) => void;
}

export const DebtScreen: React.FC<DebtScreenProps> = ({
  onSelectPerson,
  refreshTrigger,
  onSheetVisibilityChange,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [filterType, setFilterType] = useState<FilterType>('OPEN');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);

  const handleOpenAddSheet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAddSheet(true);
    onSheetVisibilityChange?.(true);
  }, [onSheetVisibilityChange]);

  const handleCloseAddSheet = useCallback(() => {
    setShowAddSheet(false);
    onSheetVisibilityChange?.(false);
  }, [onSheetVisibilityChange]);

  useEffect(() => {
    return () => {
      onSheetVisibilityChange?.(false);
    };
  }, [onSheetVisibilityChange]);

  const totals = useMemo(() => {
    return getDebtTotals();
  }, [refreshTrigger, localRefreshKey]);

  const personSummaries = useMemo(() => {
    return getPersonSummaries({ filter: filterType });
  }, [filterType, refreshTrigger, localRefreshKey]);

  const handleFilterChange = (type: FilterType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilterType(type);
  };

  const handlePersonPress = (personName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectPerson(personName);
  };

  const renderPersonItem = useCallback(
    ({ item }: { item: PersonDebtSummary }) => {
      const firstLetter = item.person_name.charAt(0).toUpperCase();
      const hasLend = item.lend_remaining > 0;
      const hasBorrow = item.borrow_remaining > 0;

      return (
        <Pressable
          onPress={() => handlePersonPress(item.person_name)}
          style={[styles.personCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.personCardLeft}>
            <View style={[styles.avatar, { backgroundColor: colors.cardSecondary }]}>
              <Text style={[styles.avatarText, { color: colors.textPrimary }]}>{firstLetter}</Text>
            </View>
            <View style={styles.personInfo}>
              <Text style={[styles.personName, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.person_name}
              </Text>
              <Text style={[styles.personSubtitle, { color: colors.textMuted }]}>
                {item.open_count > 0 ? `${item.open_count} khoản nợ đang mở` : 'Đã thanh toán hết'}
              </Text>
            </View>
          </View>

          <View style={styles.personCardRight}>
            {hasLend && (
              <View style={styles.amountBadgeRow}>
                <Text style={styles.lendAmountText}>
                  +{vnCurrencyFormatter.format(item.lend_remaining)}đ
                </Text>
              </View>
            )}
            {hasBorrow && (
              <View style={styles.amountBadgeRow}>
                <Text style={styles.borrowAmountText}>
                  -{vnCurrencyFormatter.format(item.borrow_remaining)}đ
                </Text>
              </View>
            )}
            {!hasLend && !hasBorrow && (
              <Text style={[styles.settledText, { color: colors.textMuted }]}>0đ</Text>
            )}
            <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />
          </View>
        </Pressable>
      );
    },
    [colors]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Sổ nợ</Text>
          <Text style={[styles.screenSubtitle, { color: colors.textMuted }]}>
            Theo dõi nợ cá nhân 100% offline
          </Text>
        </View>

        <Pressable
          onPress={handleOpenAddSheet}
          style={[styles.addBtn, { backgroundColor: isDark ? '#FAFAFA' : '#0F172A' }]}
        >
          <Plus size={18} color={isDark ? '#09090B' : '#FFFFFF'} />
          <Text style={[styles.addBtnText, { color: isDark ? '#09090B' : '#FFFFFF' }]}>Ghi nợ</Text>
        </Pressable>
      </View>

      {/* Summary Cards */}
      <View style={styles.totalsRow}>
        {/* Người ta nợ tôi */}
        <View style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.totalHeader}>
            <View style={[styles.totalIconWrap, { backgroundColor: 'rgba(22, 163, 74, 0.1)' }]}>
              <ArrowUpRight size={16} color="#16A34A" />
            </View>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Họ nợ tôi</Text>
          </View>
          <Text style={styles.totalAmountLend}>
            {vnCurrencyFormatter.format(totals.owedToMe)}đ
          </Text>
        </View>

        {/* Tôi nợ người ta */}
        <View style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.totalHeader}>
            <View style={[styles.totalIconWrap, { backgroundColor: 'rgba(234, 88, 12, 0.1)' }]}>
              <ArrowDownLeft size={16} color="#EA580C" />
            </View>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Tôi nợ họ</Text>
          </View>
          <Text style={styles.totalAmountBorrow}>
            {vnCurrencyFormatter.format(totals.iOwe)}đ
          </Text>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        <Pressable
          onPress={() => handleFilterChange('OPEN')}
          style={[
            styles.chip,
            { backgroundColor: colors.card, borderColor: colors.border },
            filterType === 'OPEN' && { backgroundColor: isDark ? '#FAFAFA' : '#0F172A', borderColor: isDark ? '#FAFAFA' : '#0F172A' },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              { color: colors.textSecondary },
              filterType === 'OPEN' && { color: isDark ? '#09090B' : '#FFFFFF' },
            ]}
          >
            Còn nợ
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleFilterChange('SETTLED')}
          style={[
            styles.chip,
            { backgroundColor: colors.card, borderColor: colors.border },
            filterType === 'SETTLED' && { backgroundColor: isDark ? '#FAFAFA' : '#0F172A', borderColor: isDark ? '#FAFAFA' : '#0F172A' },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              { color: colors.textSecondary },
              filterType === 'SETTLED' && { color: isDark ? '#09090B' : '#FFFFFF' },
            ]}
          >
            Đã thanh toán
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleFilterChange('ALL')}
          style={[
            styles.chip,
            { backgroundColor: colors.card, borderColor: colors.border },
            filterType === 'ALL' && { backgroundColor: isDark ? '#FAFAFA' : '#0F172A', borderColor: isDark ? '#FAFAFA' : '#0F172A' },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              { color: colors.textSecondary },
              filterType === 'ALL' && { color: isDark ? '#09090B' : '#FFFFFF' },
            ]}
          >
            Tất cả
          </Text>
        </Pressable>
      </View>

      {/* Person List */}
      <View style={styles.listFlex}>
        {personSummaries.length > 0 ? (
          <FlashList
            data={personSummaries}
            renderItem={renderPersonItem}
            keyExtractor={(item) => item.person_name}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 90,
            }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <BookOpen size={48} color={colors.textMuted} style={{ marginBottom: 12, opacity: 0.5 }} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {filterType === 'OPEN' ? 'Không có khoản nợ nào' : 'Không có dữ liệu'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Bấm "+ Ghi nợ" để ghi nhớ ai đang mượn tiền hoặc bạn vay ai
            </Text>
          </View>
        )}
      </View>

      {/* Add Debt Sheet */}
      {showAddSheet && (
        <DebtFormSheet
          onDone={() => setLocalRefreshKey((k) => k + 1)}
          onClose={handleCloseAddSheet}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  totalsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  totalCard: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
  },
  totalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  totalAmountLend: {
    fontSize: 18,
    fontWeight: '900',
    color: '#16A34A',
    fontVariant: ['tabular-nums'],
  },
  totalAmountBorrow: {
    fontSize: 18,
    fontWeight: '900',
    color: '#EA580C',
    fontVariant: ['tabular-nums'],
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listFlex: {
    flex: 1,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
  },
  personCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  personSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  personCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountBadgeRow: {
    alignItems: 'flex-end',
  },
  lendAmountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16A34A',
    fontVariant: ['tabular-nums'],
  },
  borrowAmountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EA580C',
    fontVariant: ['tabular-nums'],
  },
  settledText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
