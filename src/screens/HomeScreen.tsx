// src/screens/HomeScreen.tsx
import React, { useState, useCallback, useMemo } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ScrollView,
    Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    Eye,
    EyeOff,
    Utensils,
    Coffee,
    Bike,
    Home as HomeIcon,
    Banknote,
    MoreHorizontal,
    Settings,
    HandCoins,
    ChevronRight,
    Plus,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { getCachedDashboardData, storage, STORAGE_KEYS } from "../storage/mmkv";
import { getRecentTransactions, Transaction } from "../storage/sqlite";
import { getDebtTotals } from "../storage/debts";
import { useTheme } from "../context/ThemeContext";

// Hoist Intl Currency Formatter outside component scope (rule: js-hoist-intl)
const vnCurrencyFormatter = new Intl.NumberFormat("vi-VN");

interface HomeScreenProps {
    onOpenScanner: () => void;
    onManualEntry: () => void;
    onViewAllHistory: () => void;
    onOpenSettings: () => void;
    onOpenDebtTab: () => void;
    onPressTransaction: (tx: Transaction) => void;
}

const getCategoryIcon = (iconName?: string) => {
    switch (iconName) {
        case "Utensils":
            return <Utensils size={18} color="#64748B" />;
        case "Coffee":
            return <Coffee size={18} color="#64748B" />;
        case "Bike":
            return <Bike size={18} color="#64748B" />;
        case "Home":
            return <HomeIcon size={18} color="#64748B" />;
        case "Banknote":
            return <Banknote size={18} color="#16A34A" />;
        case "HandCoins":
            return <HandCoins size={18} color="#EA580C" />;
        default:
            return <MoreHorizontal size={18} color="#64748B" />;
    }
};

const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const hours = d.getHours().toString().padStart(2, "0");
    const minutes = d.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
};

// Memoized Transaction Item Component (rule: list-performance-item-memo)
const TransactionRow = React.memo(
    ({ item, onPress }: { item: Transaction; onPress: () => void }) => {
        const { colors } = useTheme();
        const isIncome = item.type === "INCOME";
        const prefix = isIncome ? "+" : "-";
        const amountFormatted = `${prefix}${vnCurrencyFormatter.format(item.amount)}đ`;
        const isDebt = Boolean(item.debt_id) || item.category_id === "cat_debt";
        const isAutoNote =
            item.note === "Chi tiêu tiền mặt" ||
            item.note === "Chi tiêu ngân hàng";
        const rawNote = item.note?.trim();
        const hasUserNote = Boolean(rawNote && !isAutoNote);
        const bankSource =
            item.source_bank_code === "CASH"
                ? "Tiền mặt"
                : item.source_bank_code;

        let title = "Giao dịch";
        let subtitle = bankSource;

        if (isDebt) {
            title = "Nợ";
            const debtDetail = hasUserNote ? rawNote : item.receiver_name || "";
            subtitle = debtDetail
                ? `${debtDetail} · ${bankSource}`
                : bankSource;
        } else if (hasUserNote) {
            title = rawNote!;
            subtitle = `${item.category_name || "Chi tiêu"} · ${bankSource}`;
        } else {
            title = item.category_name || "Chi tiêu";
            subtitle = bankSource;
        }

        return (
            <Pressable
                onPress={onPress}
                style={[
                    styles.transRow,
                    { borderBottomColor: colors.borderSubtle },
                ]}
            >
                <View style={styles.transLeft}>
                    <View
                        style={[
                            styles.iconBox,
                            { backgroundColor: colors.cardSecondary },
                        ]}
                    >
                        {getCategoryIcon(item.category_icon)}
                    </View>
                    <View style={styles.transInfo}>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                            }}
                        >
                            {title === "Nợ" ? (
                                <View
                                    style={[
                                        styles.debtMiniBadge,
                                        { marginLeft: 0, marginBottom: 3 },
                                    ]}
                                >
                                    <Text style={styles.debtMiniBadgeText}>
                                        Nợ
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    <Text
                                        style={[
                                            styles.transTitle,
                                            { color: colors.textPrimary },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {title}
                                    </Text>
                                    {Boolean(item.debt_id) && (
                                        <View style={styles.debtMiniBadge}>
                                            <Text
                                                style={styles.debtMiniBadgeText}
                                            >
                                                Nợ
                                            </Text>
                                        </View>
                                    )}
                                </>
                            )}
                        </View>
                        <Text
                            style={[
                                styles.transSubtitle,
                                { color: colors.textMuted },
                            ]}
                        >
                            {subtitle}
                        </Text>
                    </View>
                </View>

                <View style={styles.transRight}>
                    <Text
                        style={[
                            styles.transAmount,
                            isIncome
                                ? styles.transAmountIncome
                                : styles.transAmountExpense,
                        ]}
                    >
                        {amountFormatted}
                    </Text>
                    <Text
                        style={[styles.transTime, { color: colors.textMuted }]}
                    >
                        {formatTime(item.created_at)}
                    </Text>
                </View>
            </Pressable>
        );
    },
);

export const HomeScreen: React.FC<HomeScreenProps> = ({
    onOpenScanner,
    onManualEntry,
    onViewAllHistory,
    onOpenSettings,
    onOpenDebtTab,
    onPressTransaction,
}) => {
    const insets = useSafeAreaInsets();
    const { isDark, colors } = useTheme();
    const [cachedData, setCachedData] = useState(() =>
        getCachedDashboardData(),
    );
    const [isBalanceHidden, setIsBalanceHidden] = useState(
        cachedData.isBalanceHidden,
    );
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
        () => getRecentTransactions(5),
    );

    const debtTotals = useMemo(() => {
        return getDebtTotals();
    }, [recentTransactions]);

    const toggleHideBalance = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsBalanceHidden((prev) => {
            const next = !prev;
            storage.setBoolean(STORAGE_KEYS.IS_BALANCE_HIDDEN, next);
            return next;
        });
    }, []);

    const refreshData = useCallback(() => {
        setCachedData(getCachedDashboardData());
        setRecentTransactions(getRecentTransactions(5));
    }, []);

    // Format today's date in Vietnamese: "Thứ Ba, 22 tháng 9"
    const formattedDate = useMemo(() => {
        const days = [
            "Chủ Nhật",
            "Thứ Hai",
            "Thứ Ba",
            "Thứ Tư",
            "Thứ Năm",
            "Thứ Sáu",
            "Thứ Bảy",
        ];
        const now = new Date();
        const dayName = days[now.getDay()];
        const dateNum = now.getDate();
        const monthNum = now.getMonth() + 1;
        return `${dayName}, ${dateNum} tháng ${monthNum}`;
    }, []);

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={[
                styles.scrollContent,
                {
                    paddingTop: insets.top + 12,
                    paddingBottom: insets.bottom + 90,
                },
            ]}
            showsVerticalScrollIndicator={false}
        >
            {/* App Header: Geometric N Logo, Settings & Date */}
            <View style={styles.header}>
                <View style={styles.headerTopRow}>
                    {/* Stylized 'Иợ' Money Bag Logo & Brand Title */}
                    <View style={styles.logoRow}>
                        <Image
                            source={require("../../assets/logo.png")}
                            style={styles.logoImage}
                            resizeMode="cover"
                        />
                        {/* <Text
                            style={[
                                styles.logoBrandTitle,
                                { color: colors.textPrimary },
                            ]}
                        >
                            Иợ
                        </Text> */}
                    </View>

                    {/* Settings Button on the right */}
                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Light,
                            );
                            onOpenSettings();
                        }}
                        hitSlop={10}
                        style={[
                            styles.settingsBtn,
                            {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <Settings size={20} color={colors.textPrimary} />
                    </Pressable>
                </View>

                <Text style={[styles.dateText, { color: colors.textPrimary }]}>
                    {formattedDate}
                </Text>
            </View>

            {/* Main Budget Card */}
            <View
                style={[
                    styles.budgetCard,
                    {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                    },
                ]}
            >
                {/* Subtitle & Privacy Toggle */}
                <View style={styles.budgetSubHeader}>
                    <Text
                        style={[
                            styles.budgetSubTitle,
                            { color: colors.textSecondary },
                        ]}
                    >
                        Còn lại tháng {new Date().getMonth() + 1} · theo sổ Nếp
                    </Text>
                    <Pressable
                        onPress={toggleHideBalance}
                        hitSlop={10}
                        style={styles.eyeButton}
                    >
                        {isBalanceHidden ? (
                            <EyeOff size={16} color={colors.textMuted} />
                        ) : (
                            <Eye size={16} color={colors.textMuted} />
                        )}
                    </Pressable>
                </View>

                {/* Big Remaining Budget Amount */}
                <Text
                    style={[styles.budgetAmount, { color: colors.textPrimary }]}
                >
                    {isBalanceHidden
                        ? "••••••••đ"
                        : `${vnCurrencyFormatter.format(cachedData.remainingBudget)}đ`}
                </Text>

                {/* Progress Bar with dot indicator */}
                <View style={styles.progressContainer}>
                    <View
                        style={[
                            styles.progressBarTrack,
                            { backgroundColor: colors.cardSecondary },
                        ]}
                    >
                        <View
                            style={[
                                styles.progressBarFill,
                                {
                                    backgroundColor: colors.accent,
                                    width: `${Math.min(cachedData.spentPercent, 100)}%`,
                                },
                            ]}
                        />
                        <View
                            style={[
                                styles.progressDot,
                                {
                                    backgroundColor: colors.accent,
                                    left: `${Math.min(cachedData.spentPercent, 98)}%`,
                                },
                            ]}
                        />
                    </View>
                    <Text
                        style={[
                            styles.progressLabel,
                            { color: colors.textMuted },
                        ]}
                    >
                        Đã dùng {cachedData.spentPercent}%
                    </Text>
                </View>

                {/* Bottom Stats: Hôm nay & Tháng này */}
                <View
                    style={[
                        styles.statsRow,
                        { borderTopColor: colors.borderSubtle },
                    ]}
                >
                    <View style={styles.statCol}>
                        <Text
                            style={[
                                styles.statLabel,
                                { color: colors.textMuted },
                            ]}
                        >
                            Hôm nay
                        </Text>
                        <Text
                            style={[
                                styles.statValue,
                                { color: colors.textPrimary },
                            ]}
                        >
                            {isBalanceHidden
                                ? "••••"
                                : `${vnCurrencyFormatter.format(cachedData.spentToday)}đ`}
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.statDivider,
                            { backgroundColor: colors.borderSubtle },
                        ]}
                    />
                    <View style={styles.statCol}>
                        <Text
                            style={[
                                styles.statLabel,
                                { color: colors.textMuted },
                            ]}
                        >
                            Tháng này
                        </Text>
                        <Text
                            style={[
                                styles.statValue,
                                { color: colors.textPrimary },
                            ]}
                        >
                            {isBalanceHidden
                                ? "••••"
                                : `${vnCurrencyFormatter.format(cachedData.spentMonth)}đ`}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Widget: Sổ nợ cá nhân tóm tắt */}
            <Pressable
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onOpenDebtTab();
                }}
                style={[
                    styles.debtWidgetCard,
                    {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                    },
                ]}
            >
                <View style={styles.debtWidgetHeader}>
                    <View style={styles.debtWidgetTitleWrap}>
                        <HandCoins
                            size={16}
                            color="#EA580C"
                            style={{ marginRight: 6 }}
                        />
                        <Text
                            style={[
                                styles.debtWidgetTitle,
                                { color: colors.textPrimary },
                            ]}
                        >
                            Sổ nợ
                        </Text>
                    </View>
                    <ChevronRight size={16} color={colors.textMuted} />
                </View>

                <View style={styles.debtWidgetBody}>
                    <View style={styles.debtWidgetItem}>
                        <Text
                            style={[
                                styles.debtWidgetLabel,
                                { color: colors.textMuted },
                            ]}
                        >
                            Họ nợ tôi
                        </Text>
                        <Text style={styles.debtWidgetLend}>
                            {isBalanceHidden
                                ? "••••"
                                : `+${vnCurrencyFormatter.format(debtTotals.owedToMe)}đ`}
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.debtWidgetDivider,
                            { backgroundColor: colors.borderSubtle },
                        ]}
                    />
                    <View style={styles.debtWidgetItem}>
                        <Text
                            style={[
                                styles.debtWidgetLabel,
                                { color: colors.textMuted },
                            ]}
                        >
                            Tôi nợ họ
                        </Text>
                        <Text style={styles.debtWidgetBorrow}>
                            {isBalanceHidden
                                ? "••••"
                                : `-${vnCurrencyFormatter.format(debtTotals.iOwe)}đ`}
                        </Text>
                    </View>
                </View>
            </Pressable>

            {/* Quick Action: Ghi thủ công (Được phóng to làm nút chính theo yêu cầu) */}
            <Pressable
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onManualEntry();
                }}
                style={styles.primaryActionWrapper}
            >
                <View
                    style={[
                        styles.primaryActionBtn,
                        { backgroundColor: isDark ? "#FAFAFA" : "#161616" },
                    ]}
                >
                    <Plus
                        size={20}
                        color={isDark ? "#09090B" : "#FFFFFF"}
                        strokeWidth={2.4}
                        style={{ marginRight: 8 }}
                    />
                    <Text
                        style={[
                            styles.primaryActionText,
                            { color: isDark ? "#09090B" : "#FFFFFF" },
                        ]}
                    >
                        Ghi khoản chi mới
                    </Text>
                </View>
            </Pressable>

            {/* Section: Gần đây */}
            <View style={styles.recentSectionHeader}>
                <Text
                    style={[styles.recentTitle, { color: colors.textPrimary }]}
                >
                    Gần đây
                </Text>
                <Pressable onPress={onViewAllHistory} hitSlop={8}>
                    <Text
                        style={[
                            styles.seeAllText,
                            { color: colors.textSecondary },
                        ]}
                    >
                        Xem tất cả
                    </Text>
                </Pressable>
            </View>

            {/* Recent Transactions List */}
            <View
                style={[
                    styles.recentListContainer,
                    {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                    },
                ]}
            >
                {recentTransactions.map((tx) => (
                    <TransactionRow
                        key={tx.id}
                        item={tx}
                        onPress={() => onPressTransaction(tx)}
                    />
                ))}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8F9FA",
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    header: {
        marginBottom: 20,
    },
    headerTopRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    logoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    logoImage: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: "#000000",
    },
    logoBrandTitle: {
        fontSize: 22,
        fontWeight: "900",
        letterSpacing: -0.5,
    },
    settingsBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    dateText: {
        fontSize: 26,
        fontWeight: "800",
        color: "#0F172A",
        letterSpacing: -0.5,
    },
    debtWidgetCard: {
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        marginBottom: 20,
    },
    debtWidgetHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    debtWidgetTitleWrap: {
        flexDirection: "row",
        alignItems: "center",
    },
    debtWidgetTitle: {
        fontSize: 14,
        fontWeight: "700",
    },
    debtWidgetBody: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    debtWidgetItem: {
        flex: 1,
        alignItems: "center",
    },
    debtWidgetDivider: {
        width: 1,
        height: 32,
    },
    debtWidgetLabel: {
        fontSize: 12,
        fontWeight: "500",
        marginBottom: 4,
    },
    debtWidgetLend: {
        fontSize: 16,
        fontWeight: "800",
        color: "#16A34A",
        fontVariant: ["tabular-nums"],
    },
    debtWidgetBorrow: {
        fontSize: 16,
        fontWeight: "800",
        color: "#EA580C",
        fontVariant: ["tabular-nums"],
    },
    debtMiniBadge: {
        backgroundColor: "rgba(249, 115, 22, 0.12)",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginLeft: 6,
    },
    debtMiniBadgeText: {
        color: "#EA580C",
        fontSize: 12.5,
        fontWeight: "700",
    },
    budgetCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 28,
        padding: 24,
        borderWidth: 1,
        borderColor: "rgba(241, 245, 249, 0.8)",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 2,
        marginBottom: 20,
    },
    budgetSubHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    budgetSubTitle: {
        fontSize: 13,
        color: "#64748B",
        fontWeight: "500",
    },
    eyeButton: {
        padding: 4,
    },
    budgetAmount: {
        fontSize: 34,
        fontWeight: "900",
        color: "#0F172A",
        fontVariant: ["tabular-nums"],
        letterSpacing: -0.5,
        marginBottom: 16,
    },
    progressContainer: {
        marginBottom: 20,
    },
    progressBarTrack: {
        height: 3,
        backgroundColor: "#F1F5F9",
        borderRadius: 2,
        position: "relative",
        marginBottom: 8,
    },
    progressBarFill: {
        height: 3,
        backgroundColor: "#0F172A",
        borderRadius: 2,
    },
    progressDot: {
        position: "absolute",
        top: -3.5,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#0F172A",
    },
    progressLabel: {
        fontSize: 12,
        color: "#94A3B8",
        fontWeight: "500",
    },
    statsRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: "#F8F9FA",
    },
    statCol: {
        flex: 1,
    },
    statDivider: {
        width: 1,
        height: 36,
        backgroundColor: "#F1F5F9",
        marginHorizontal: 16,
    },
    statLabel: {
        fontSize: 12,
        color: "#94A3B8",
        marginBottom: 4,
        fontWeight: "500",
    },
    statValue: {
        fontSize: 17,
        fontWeight: "700",
        color: "#0F172A",
        fontVariant: ["tabular-nums"],
    },
    primaryActionWrapper: {
        width: "100%",
        marginBottom: 20,
    },
    primaryActionBtn: {
        backgroundColor: "#161616",
        borderRadius: 18,
        height: 54,
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
    },
    scanIconBox: {
        width: 20,
        height: 20,
        borderRadius: 5.5,
        borderWidth: 2,
        borderColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
    },
    scanIconCenter: {
        width: 8,
        height: 8,
        borderRadius: 2,
        backgroundColor: "#FFFFFF",
    },
    secondaryActionWrapper: {
        alignSelf: "center",
        marginBottom: 24,
    },
    secondaryActionBtn: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        paddingHorizontal: 22,
        height: 40,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    plusIcon: {
        marginRight: 6,
    },
    primaryActionText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "600",
        letterSpacing: -0.2,
    },
    secondaryActionText: {
        color: "#18181B",
        fontSize: 14.5,
        fontWeight: "600",
    },
    recentSectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    recentTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#0F172A",
    },
    seeAllText: {
        fontSize: 13,
        color: "#64748B",
        fontWeight: "600",
    },
    recentListContainer: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: "rgba(241, 245, 249, 0.8)",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 1,
    },
    transRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F8F9FA",
    },
    transLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    iconBox: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: "#F8F9FA",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    transInfo: {
        flex: 1,
    },
    transTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 3,
    },
    transSubtitle: {
        fontSize: 12,
        color: "#94A3B8",
        fontWeight: "500",
    },
    transRight: {
        alignItems: "flex-end",
        marginLeft: 8,
    },
    transAmount: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0F172A",
        fontVariant: ["tabular-nums"],
        marginBottom: 3,
    },
    transAmountIncome: {
        color: "#16A34A",
    },
    transAmountExpense: {
        color: "#EA580C",
    },
    transTime: {
        fontSize: 12,
        color: "#94A3B8",
    },
});
