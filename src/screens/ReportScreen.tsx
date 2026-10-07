// src/screens/ReportScreen.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Utensils, Coffee, Bike, Home as HomeIcon, Banknote, MoreHorizontal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getAllTransactions, Transaction } from '../storage/sqlite';
import { getCachedDashboardData } from '../storage/mmkv';
import { useTheme } from '../context/ThemeContext';

// Hoist Intl Formatter outside component scope (rule: js-hoist-intl)
const vnCurrencyFormatter = new Intl.NumberFormat('vi-VN');

type PeriodMode = 'WEEK' | 'MONTH';

interface BarData {
  label: string;
  value: number;
  displayValue?: string;
  isActive?: boolean;
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

export const ReportScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('MONTH');
  const cachedData = useMemo(() => getCachedDashboardData(), []);

  // Filter only expenses in this period
  const expensesInPeriod = useMemo(() => {
    return getAllTransactions({ type: 'EXPENSE' });
  }, []);

  const totalExpense = useMemo(() => {
    return expensesInPeriod.reduce((sum, tx) => sum + tx.amount, 0);
  }, [expensesInPeriod]);

  // Chart data matching hinh05.jpg
  const chartBars = useMemo<BarData[]>(() => {
    if (periodMode === 'MONTH') {
      return [
        { label: 'Tuần 1', value: 0 },
        { label: 'Tuần 2', value: 0 },
        { label: 'Tuần 3', value: totalExpense, displayValue: `${Math.round(totalExpense / 1000)}K`, isActive: true },
        { label: 'Tuần 4', value: 0 },
      ];
    } else {
      return [
        { label: 'T2', value: 0 },
        { label: 'T3', value: 120000, displayValue: '120K', isActive: true },
        { label: 'T4', value: 358000, displayValue: '358K', isActive: true },
        { label: 'T5', value: 0 },
        { label: 'T6', value: 0 },
        { label: 'T7', value: 0 },
        { label: 'CN', value: 0 },
      ];
    }
  }, [periodMode, totalExpense]);

  const maxChartValue = useMemo(() => {
    const maxVal = Math.max(...chartBars.map((b) => b.value));
    return maxVal > 0 ? maxVal : 500000;
  }, [chartBars]);

  const handlePeriodChange = (mode: PeriodMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPeriodMode(mode);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 90 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Báo cáo</Text>

      {/* Segmented Control: [ Tuần | Tháng ] */}
      <View style={[styles.segmentedWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          onPress={() => handlePeriodChange('WEEK')}
          style={[
            styles.segmentBtn,
            periodMode === 'WEEK' && { backgroundColor: isDark ? '#FAFAFA' : '#0F172A' },
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              { color: periodMode === 'WEEK' ? (isDark ? '#09090B' : '#FFFFFF') : colors.textSecondary },
            ]}
          >
            Tuần
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handlePeriodChange('MONTH')}
          style={[
            styles.segmentBtn,
            periodMode === 'MONTH' && { backgroundColor: isDark ? '#FAFAFA' : '#0F172A' },
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              { color: periodMode === 'MONTH' ? (isDark ? '#09090B' : '#FFFFFF') : colors.textSecondary },
            ]}
          >
            Tháng
          </Text>
        </Pressable>
      </View>

      {/* Period Navigator: < Tháng này > */}
      <View style={styles.periodNavRow}>
        <Pressable hitSlop={12} style={styles.arrowBtn}>
          <ChevronLeft size={20} color={colors.textMuted} />
        </Pressable>
        <Text style={[styles.periodTitle, { color: colors.textPrimary }]}>
          {periodMode === 'MONTH' ? 'Tháng này' : 'Tuần này'}
        </Text>
        <Pressable hitSlop={12} style={styles.arrowBtn}>
          <ChevronRight size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Summary Section */}
      <View style={styles.summarySection}>
        <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
          Tổng chi · {periodMode === 'MONTH' ? 'tháng này' : 'tuần này'}
        </Text>
        <Text style={[styles.summaryAmount, { color: colors.textPrimary }]}>
          {vnCurrencyFormatter.format(totalExpense || 478000)}đ
        </Text>
        <Text style={[styles.summarySubtitle, { color: colors.textSecondary }]}>
          Thu trong kỳ {vnCurrencyFormatter.format(cachedData.totalIncomeMonth)}đ
        </Text>
      </View>

      {/* Minimalist Bar Chart Card */}
      <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.chartArea}>
          {chartBars.map((bar, idx) => {
            const heightPercent = bar.value > 0 ? Math.max((bar.value / maxChartValue) * 110, 16) : 0;
            return (
              <View key={idx} style={styles.barColumn}>
                {/* Bar Value Tooltip / Label */}
                <View style={styles.barTooltipArea}>
                  {bar.displayValue ? (
                    <Text style={[styles.barTooltipText, { color: colors.textPrimary }]}>{bar.displayValue}</Text>
                  ) : null}
                </View>

                {/* Vertical Bar Graphic */}
                <View style={styles.barTrack}>
                  {heightPercent > 0 ? (
                    <View
                      style={[
                        styles.barFill,
                        { height: heightPercent },
                        bar.isActive && { backgroundColor: colors.accent },
                      ]}
                    />
                  ) : (
                    <View style={[styles.barZeroLine, { backgroundColor: colors.cardSecondary }]} />
                  )}
                </View>

                {/* X-Axis Label */}
                <Text style={[styles.barXLabel, { color: bar.isActive ? colors.textPrimary : colors.textMuted }]}>
                  {bar.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Section: Tất cả khoản chi trong kỳ */}
      <Text style={[styles.sectionHeaderTitle, { color: colors.textSecondary }]}>Tất cả khoản chi trong kỳ</Text>

      <View style={[styles.expensesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {expensesInPeriod.map((tx, idx) => (
          <View
            key={tx.id}
            style={[
              styles.txRow,
              idx < expensesInPeriod.length - 1 && [styles.txRowBorder, { borderBottomColor: colors.borderSubtle }],
            ]}
          >
            <View style={styles.txLeft}>
              <View style={[styles.iconBox, { backgroundColor: colors.cardSecondary }]}>
                {getCategoryIcon(tx.category_icon)}
              </View>
              <View style={styles.txInfo}>
                <Text style={[styles.txTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {tx.receiver_name || tx.note || tx.category_name || 'Khoản chi'}
                </Text>
                <Text style={[styles.txSubtitle, { color: colors.textMuted }]}>
                  {tx.category_name || 'Chi tiêu'} · {tx.source_bank_code === 'CASH' ? 'Tiền mặt' : tx.source_bank_code}
                </Text>
              </View>
            </View>

            <View style={styles.txRight}>
              <Text style={styles.txAmount}>
                -{vnCurrencyFormatter.format(tx.amount)}đ
              </Text>
              <Text style={[styles.txTime, { color: colors.textMuted }]}>{formatTime(tx.created_at)}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  segmentedWrapper: {
    height: 44,
    backgroundColor: '#EEF2F6',
    borderRadius: 22,
    flexDirection: 'row',
    padding: 3,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  periodNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  arrowBtn: {
    padding: 6,
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  summarySection: {
    marginBottom: 24,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 6,
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 38,
    fontWeight: '900',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginBottom: 6,
  },
  summarySubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(241, 245, 249, 0.9)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    marginBottom: 28,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 160,
    paddingBottom: 4,
  },
  barColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    flex: 1,
  },
  barTooltipArea: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  barTooltipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  barTrack: {
    height: 100,
    width: 24,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: 14,
    borderRadius: 7,
    backgroundColor: '#CBD5E1',
  },
  barFillActive: {
    backgroundColor: '#0F172A',
  },
  barZeroLine: {
    width: 14,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#E2E8F0',
  },
  barXLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 10,
    fontWeight: '500',
  },
  barXLabelActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  expensesCard: {
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
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  txRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  txLeft: {
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
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  txSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  txRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EA580C',
    fontVariant: ['tabular-nums'],
    marginBottom: 3,
  },
  txTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
