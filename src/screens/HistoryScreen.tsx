// src/screens/HistoryScreen.tsx
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Utensils, Coffee, Bike, Home as HomeIcon, Banknote, MoreHorizontal, HandCoins } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { getAllTransactions, Transaction } from '../storage/sqlite';
import { useTheme } from '../context/ThemeContext';

// Hoist Intl Formatter outside component scope (rule: js-hoist-intl)
const vnCurrencyFormatter = new Intl.NumberFormat('vi-VN');

type FilterType = 'ALL' | 'EXPENSE' | 'INCOME';

interface GroupedTransactionSection {
  title: string;
  data: Transaction[];
}

interface HistoryScreenProps {
  onPressTransaction?: (tx: Transaction) => void;
}

const getCategoryIcon = (iconName?: string) => {
  switch (iconName) {
    case 'Utensils':
      return <Utensils size={18} color="#64748B" />;
    case 'Coffee':
      return <Coffee size={18} color="#64748B" />;
    case 'Bike':
      return <Bike size={18} color="#64748B" />;
    case 'Home':
      return <HomeIcon size={18} color="#64748B" />;
    case 'Banknote':
      return <Banknote size={18} color="#16A34A" />;
    case 'HandCoins':
      return <HandCoins size={18} color="#EA580C" />;
    default:
      return <MoreHorizontal size={18} color="#64748B" />;
  }
};

const formatTime = (timestamp: number) => {
  const d = new Date(timestamp);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const getRelativeDateHeader = (timestamp: number): string => {
  const now = new Date();
  const txDate = new Date(timestamp);

  const diffMs = now.getTime() - txDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays <= 7) return `${diffDays} ngày trước`;
  return `${txDate.getDate()} tháng ${txDate.getMonth() + 1}`;
};

// Memoized Transaction Item (rule: list-performance-item-memo)
const HistoryTransactionItem = React.memo(({
  item,
  isLast,
  onPress,
}: {
  item: Transaction;
  isLast: boolean;
  onPress?: () => void;
}) => {
  const { colors } = useTheme();
  const isIncome = item.type === 'INCOME';
  const prefix = isIncome ? '+' : '-';
  const amountFormatted = `${prefix}${vnCurrencyFormatter.format(item.amount)}đ`;
  const isDebt = Boolean(item.debt_id) || item.category_id === 'cat_debt';
  const isAutoNote = item.note === 'Chi tiêu tiền mặt' || item.note === 'Chi tiêu ngân hàng';
  const rawNote = item.note?.trim();
  const hasUserNote = Boolean(rawNote && !isAutoNote);
  const bankSource = item.source_bank_code === 'CASH' ? 'Tiền mặt' : item.source_bank_code;

  let title = 'Giao dịch';
  let subtitle = bankSource;

  if (isDebt) {
    title = 'Nợ';
    const debtDetail = hasUserNote ? rawNote : (item.receiver_name || '');
    subtitle = debtDetail ? `${debtDetail} · ${bankSource}` : bankSource;
  } else if (hasUserNote) {
    title = rawNote!;
    subtitle = `${item.category_name || 'Chi tiêu'} · ${bankSource}`;
  } else {
    title = item.category_name || 'Chi tiêu';
    subtitle = bankSource;
  }

  return (
    <Pressable
      onPress={onPress}
      style={[styles.itemContainer, !isLast && [styles.itemBorderBottom, { borderBottomColor: colors.borderSubtle }]]}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.iconBox, { backgroundColor: colors.cardSecondary }]}>
          {getCategoryIcon(item.category_icon)}
        </View>
        <View style={styles.itemInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {title === 'Nợ' ? (
              <View style={[styles.debtBadge, { marginLeft: 0, marginBottom: 3 }]}>
                <Text style={styles.debtBadgeText}>Nợ</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.itemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {title}
                </Text>
                {Boolean(item.debt_id) && (
                  <View style={styles.debtBadge}>
                    <Text style={styles.debtBadgeText}>Nợ</Text>
                  </View>
                )}
              </>
            )}
          </View>
          <Text style={[styles.itemSubtitle, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.itemRight}>
        <Text style={[styles.itemAmount, isIncome ? styles.itemAmountIncome : styles.itemAmountExpense]}>
          {amountFormatted}
        </Text>
        <Text style={[styles.itemTime, { color: colors.textMuted }]}>{formatTime(item.created_at)}</Text>
      </View>
    </Pressable>
  );
});

// Memoized Section Card
const SectionCard = React.memo(({
  section,
  onPressTransaction,
}: {
  section: GroupedTransactionSection;
  onPressTransaction?: (tx: Transaction) => void;
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionContainer}>
      <Text style={[styles.sectionHeaderTitle, { color: colors.textSecondary }]}>{section.title}</Text>
      <View style={[styles.cardContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {section.data.map((tx, idx) => (
          <HistoryTransactionItem
            key={tx.id}
            item={tx}
            isLast={idx === section.data.length - 1}
            onPress={() => onPressTransaction && onPressTransaction(tx)}
          />
        ))}
      </View>
    </View>
  );
});

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onPressTransaction }) => {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [searchText, setSearchText] = useState('');

  const rawTransactions = useMemo(() => {
    return getAllTransactions({
      type: filterType === 'ALL' ? undefined : filterType,
      search: searchText,
    });
  }, [filterType, searchText]);

  // Group transactions by relative date headers (e.g. "2 ngày trước", "3 ngày trước")
  const groupedSections = useMemo<GroupedTransactionSection[]>(() => {
    const groups: { [key: string]: Transaction[] } = {};
    const order: string[] = [];

    rawTransactions.forEach((tx) => {
      const header = getRelativeDateHeader(tx.created_at);
      if (!groups[header]) {
        groups[header] = [];
        order.push(header);
      }
      groups[header].push(tx);
    });

    return order.map((title) => ({
      title,
      data: groups[title],
    }));
  }, [rawTransactions]);

  const handleFilterChange = (type: FilterType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilterType(type);
  };

  const renderSectionItem = useCallback(
    ({ item }: { item: GroupedTransactionSection }) => (
      <SectionCard section={item} onPressTransaction={onPressTransaction} />
    ),
    [onPressTransaction]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      {/* Title */}
      <View style={styles.titleRow}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Lịch sử</Text>
      </View>

      {/* Search Input Bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Search size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Tìm người nhận, ngày, số tiền, ghi chú..."
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.textPrimary }]}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.chipsRow}>
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

        <Pressable
          onPress={() => handleFilterChange('EXPENSE')}
          style={[
            styles.chip,
            { backgroundColor: colors.card, borderColor: colors.border },
            filterType === 'EXPENSE' && { backgroundColor: isDark ? '#FAFAFA' : '#0F172A', borderColor: isDark ? '#FAFAFA' : '#0F172A' },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              { color: colors.textSecondary },
              filterType === 'EXPENSE' && { color: isDark ? '#09090B' : '#FFFFFF' },
            ]}
          >
            Khoản chi
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleFilterChange('INCOME')}
          style={[
            styles.chip,
            { backgroundColor: colors.card, borderColor: colors.border },
            filterType === 'INCOME' && { backgroundColor: isDark ? '#FAFAFA' : '#0F172A', borderColor: isDark ? '#FAFAFA' : '#0F172A' },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              { color: colors.textSecondary },
              filterType === 'INCOME' && { color: isDark ? '#09090B' : '#FFFFFF' },
            ]}
          >
            Thu nhập
          </Text>
        </Pressable>
      </View>

      {/* Grouped Transaction List using FlashList (rule: list-performance-virtualize) */}
      <View style={styles.listFlex}>
        {groupedSections.length > 0 ? (
          <FlashList
            data={groupedSections}
            renderItem={renderSectionItem}
            keyExtractor={(item) => item.title}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 90,
            }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Không tìm thấy giao dịch nào</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  titleRow: {
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  searchBar: {
    marginHorizontal: 20,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  chipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  listFlex: {
    flex: 1,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
    marginBottom: 8,
    marginLeft: 4,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(241, 245, 249, 0.9)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  itemBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  itemRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
    marginBottom: 3,
  },
  itemAmountIncome: {
    color: '#16A34A',
  },
  itemAmountExpense: {
    color: '#EA580C',
  },
  itemTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  debtBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  debtBadgeText: {
    color: '#EA580C',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
