// src/screens/DebtDetailScreen.tsx
import React, { useState, useMemo } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ScrollView,
    Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    ChevronLeft,
    Plus,
    Pencil,
    Trash2,
    CheckCircle2,
    Sparkles,
    CircleMinus,
    CirclePlus,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import {
    Debt,
    DebtDirection,
    DebtPayment,
    DebtTimelineItem,
    getDebtsByPerson,
    getPaymentById,
    deleteDebt,
    deletePayment,
    getDebtTimelineByPerson,
    deleteAllDebtsByPerson,
} from "../storage/debts";
import { DebtFormSheet } from "../components/DebtFormSheet";
import { PaymentFormSheet } from "../components/PaymentFormSheet";
import { BatchPaymentSheet } from "../components/BatchPaymentSheet";
import { useTheme } from "../context/ThemeContext";

const vnCurrencyFormatter = new Intl.NumberFormat("vi-VN");

interface DebtDetailScreenProps {
    personName: string;
    onBack: () => void;
    onDebtChange?: () => void;
}

const formatDateTimeStr = (timestamp: number) => {
    const d = new Date(timestamp);
    const hours = d.getHours().toString().padStart(2, "0");
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${hours}:${minutes} · ${day}/${month}/${year}`;
};

export const DebtDetailScreen: React.FC<DebtDetailScreenProps> = ({
    personName,
    onBack,
    onDebtChange,
}) => {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();

    const [refreshKey, setRefreshKey] = useState(0);
    const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
    const [editingPayment, setEditingPayment] = useState<{
        debt: Debt;
        payment: DebtPayment;
    } | null>(null);
    const [batchPaymentDirection, setBatchPaymentDirection] =
        useState<DebtDirection | null>(null);
    const [showAddSheet, setShowAddSheet] = useState(false);
    const [addSheetDirection, setAddSheetDirection] = useState<
        DebtDirection | undefined
    >(undefined);

    const debts = useMemo(() => {
        return getDebtsByPerson(personName);
    }, [personName, refreshKey]);

    const timeline = useMemo(() => {
        return getDebtTimelineByPerson(personName);
    }, [personName, refreshKey]);

    // Tổng hợp nợ của người này (1 con số công nợ ròng duy nhất)
    const summary = useMemo(() => {
        let lendTotal = 0;
        let borrowTotal = 0;
        for (const d of debts) {
            if (d.settled_at === null && d.remaining > 0) {
                if (d.direction === "LEND") {
                    lendTotal += d.remaining;
                } else {
                    borrowTotal += d.remaining;
                }
            }
        }
        const net = lendTotal - borrowTotal;
        return { lendTotal, borrowTotal, net };
    }, [debts]);

    const handleRefresh = () => {
        setRefreshKey((k) => k + 1);
        if (onDebtChange) onDebtChange();
    };

    const handleDeleteDebt = (debt: Debt) => {
        Alert.alert(
            "Xóa khoản nợ",
            `Bạn chắc chắn muốn xóa khoản nợ ${vnCurrencyFormatter.format(debt.amount)}đ này?`,
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa",
                    style: "destructive",
                    onPress: () => {
                        Haptics.notificationAsync(
                            Haptics.NotificationFeedbackType.Warning,
                        );
                        deleteDebt(debt.id);
                        handleRefresh();
                    },
                },
            ],
        );
    };

    const handleDeletePayment = (paymentId: string) => {
        Alert.alert("Xóa lần trả", "Bạn muốn xóa ghi nhận lần trả nợ này?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Xóa",
                style: "destructive",
                onPress: () => {
                    Haptics.notificationAsync(
                        Haptics.NotificationFeedbackType.Warning,
                    );
                    deletePayment(paymentId);
                    handleRefresh();
                },
            },
        ]);
    };

    const handleDeleteAllDebts = () => {
        Alert.alert(
            "Xóa toàn bộ công nợ",
            `Bạn có chắc chắn muốn xóa toàn bộ sổ nợ và lịch sử của ${personName}?\n\nThao tác này sẽ xóa tất cả các khoản vay/mượn và các lần thanh toán của người này. Hành động này không thể hoàn tác.`,
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa toàn bộ",
                    style: "destructive",
                    onPress: () => {
                        Haptics.notificationAsync(
                            Haptics.NotificationFeedbackType.Warning,
                        );
                        deleteAllDebtsByPerson(personName);
                        if (onDebtChange) onDebtChange();
                        onBack();
                    },
                },
            ],
        );
    };

    const handleEditTimelineItem = (item: DebtTimelineItem) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (item.type === "LEND_CREATE" || item.type === "BORROW_CREATE") {
            const debt = debts.find((d) => d.id === item.debt_id);
            if (debt) {
                setEditingDebt(debt);
            }
        } else {
            // Payment event
            const payment = getPaymentById(item.id);
            const debt = debts.find((d) => d.id === item.debt_id);
            if (payment && debt) {
                setEditingPayment({ debt, payment });
            } else if (debt) {
                // Fallback reconstructed payment
                setEditingPayment({
                    debt,
                    payment: {
                        id: item.id,
                        debt_id: item.debt_id,
                        amount: item.amount,
                        note: item.note,
                        created_at: item.created_at,
                    },
                });
            }
        }
    };

    const handleDeleteTimelineItem = (item: DebtTimelineItem) => {
        if (item.type === "LEND_CREATE" || item.type === "BORROW_CREATE") {
            const debt = debts.find((d) => d.id === item.debt_id);
            if (debt) {
                handleDeleteDebt(debt);
            }
        } else {
            handleDeletePayment(item.id);
        }
    };

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: colors.background, paddingTop: insets.top },
            ]}
        >
            {/* Top Header */}
            <View
                style={[
                    styles.header,
                    { borderBottomColor: colors.borderSubtle },
                ]}
            >
                <Pressable
                    onPress={onBack}
                    hitSlop={12}
                    style={styles.backButton}
                >
                    <ChevronLeft size={24} color="#F97316" />
                    <Text style={styles.backButtonText}>Sổ nợ</Text>
                </Pressable>

                <Text
                    style={[styles.headerTitle, { color: colors.textPrimary }]}
                    numberOfLines={1}
                >
                    {personName}
                </Text>

                <View style={styles.headerActions}>
                    <Pressable
                        onPress={handleDeleteAllDebts}
                        hitSlop={10}
                        style={[
                            styles.headerIconBtn,
                            {
                                backgroundColor: isDark
                                    ? "rgba(239, 68, 68, 0.12)"
                                    : "rgba(239, 68, 68, 0.08)",
                                borderColor: isDark
                                    ? "rgba(239, 68, 68, 0.3)"
                                    : "rgba(239, 68, 68, 0.2)",
                            },
                        ]}
                    >
                        <Trash2 size={16} color="#EF4444" />
                    </Pressable>

                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowAddSheet(true);
                        }}
                        hitSlop={10}
                        style={[
                            styles.headerIconBtn,
                            {
                                backgroundColor: colors.cardSecondary,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <Plus size={18} color={colors.textPrimary} />
                    </Pressable>
                </View>
            </View>

            <ScrollView
                style={styles.mainScroll}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: insets.bottom + 40 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.simpleSection}>
                    {/* Hero Card: 1 Con số duy nhất */}
                    <View
                        style={[
                            styles.heroCard,
                            {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.heroSubText,
                                { color: colors.textMuted },
                            ]}
                        >
                            {summary.net > 0
                                ? `${personName} đang nợ bạn`
                                : summary.net < 0
                                  ? `Bạn đang nợ ${personName}`
                                  : `Công nợ giữa bạn & ${personName}`}
                        </Text>

                        <Text
                            style={[
                                styles.heroAmount,
                                {
                                    color:
                                        summary.net > 0
                                            ? "#16A34A"
                                            : summary.net < 0
                                              ? "#EA580C"
                                              : colors.textSecondary,
                                },
                            ]}
                        >
                            {summary.net > 0
                                ? `+${vnCurrencyFormatter.format(summary.net)}đ`
                                : summary.net < 0
                                  ? `${vnCurrencyFormatter.format(Math.abs(summary.net))}đ`
                                  : "0đ"}
                        </Text>

                        <Text
                            style={[
                                styles.heroStatusText,
                                { color: colors.textMuted },
                            ]}
                        >
                            {summary.net > 0
                                ? `(Cho mượn ${vnCurrencyFormatter.format(summary.lendTotal)}đ · Đang nợ lại ${vnCurrencyFormatter.format(summary.borrowTotal)}đ)`
                                : summary.net < 0
                                  ? `(Vay ${vnCurrencyFormatter.format(summary.borrowTotal)}đ · Cho mượn lại ${vnCurrencyFormatter.format(summary.lendTotal)}đ)`
                                  : "Đã thanh toán hết / Hòa công nợ"}
                        </Text>

                        {/* 2 Nút thao tác nhanh cốt lõi */}
                        <View style={styles.heroActionButtonsRow}>
                            <Pressable
                                onPress={() => {
                                    Haptics.impactAsync(
                                        Haptics.ImpactFeedbackStyle.Light,
                                    );
                                    // Mở sheet thêm khoản vay/mượn
                                    setAddSheetDirection(
                                        summary.net < 0 ? "BORROW" : "LEND",
                                    );
                                    setShowAddSheet(true);
                                }}
                                style={[
                                    styles.heroBtn,
                                    styles.heroBtnAdd,
                                    {
                                        backgroundColor: isDark
                                            ? "#27272A"
                                            : "#F1F5F9",
                                        borderColor: colors.border,
                                    },
                                ]}
                            >
                                <CirclePlus
                                    size={16}
                                    color={colors.textPrimary}
                                    style={{ marginRight: 6 }}
                                />
                                <Text
                                    style={[
                                        styles.heroBtnAddText,
                                        { color: colors.textPrimary },
                                    ]}
                                >
                                    {summary.net < 0 ? "Vay thêm" : "Cho mượn"}
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    Haptics.impactAsync(
                                        Haptics.ImpactFeedbackStyle.Light,
                                    );
                                    if (summary.net > 0) {
                                        setBatchPaymentDirection("LEND");
                                    } else if (summary.net < 0) {
                                        setBatchPaymentDirection("BORROW");
                                    } else if (summary.lendTotal > 0) {
                                        setBatchPaymentDirection("LEND");
                                    } else if (summary.borrowTotal > 0) {
                                        setBatchPaymentDirection("BORROW");
                                    } else {
                                        Alert.alert(
                                            "Thông báo",
                                            "Hiện tại không có khoản nợ nào cần trả.",
                                        );
                                    }
                                }}
                                style={[
                                    styles.heroBtn,
                                    styles.heroBtnPay,
                                    {
                                        backgroundColor:
                                            summary.net < 0
                                                ? "#EA580C"
                                                : summary.net > 0
                                                  ? "#16A34A"
                                                  : isDark
                                                    ? "#3F3F46"
                                                    : "#0F172A",
                                    },
                                ]}
                            >
                                <CircleMinus
                                    size={16}
                                    color="#FFFFFF"
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={styles.heroBtnPayText}>
                                    {summary.net < 0
                                        ? "Trả bớt nợ"
                                        : summary.net > 0
                                          ? "Thu hồi nợ"
                                          : "Ghi nhận trả"}
                                </Text>
                            </Pressable>
                        </View>
                    </View>

                    {/* Lịch sử giao dịch với Sửa & Xóa trực tiếp */}
                    <View style={styles.simpleHistorySection}>
                        <View style={styles.simpleHistoryHeader}>
                            <Text
                                style={[
                                    styles.sectionTitle,
                                    {
                                        color: colors.textSecondary,
                                        marginBottom: 0,
                                    },
                                ]}
                            >
                                Lịch sử giao dịch ({timeline.length})
                            </Text>
                            <Text
                                style={[
                                    styles.simpleHistorySubtitle,
                                    { color: colors.textMuted },
                                ]}
                            >
                                Chạm bút để Sửa, thùng rác để Xóa
                            </Text>
                        </View>

                        {timeline.length === 0 ? (
                            <View
                                style={[
                                    styles.emptyTimelineCard,
                                    {
                                        backgroundColor: colors.card,
                                        borderColor: colors.border,
                                    },
                                ]}
                            >
                                <Sparkles
                                    size={30}
                                    color={colors.textMuted}
                                    style={{ marginBottom: 8 }}
                                />
                                <Text
                                    style={[
                                        styles.emptyText,
                                        { color: colors.textMuted },
                                    ]}
                                >
                                    Chưa có giao dịch phát sinh nào với{" "}
                                    {personName}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.simpleHistoryList}>
                                {timeline.map((item) => {
                                    let badgeBg = "rgba(22, 163, 74, 0.12)";
                                    let badgeColor = "#16A34A";
                                    let typeLabel = "Cho mượn";
                                    let amountColor = "#16A34A";
                                    let amountPrefix = "+";

                                    if (item.type === "LEND_CREATE") {
                                        badgeBg = "rgba(22, 163, 74, 0.12)";
                                        badgeColor = "#16A34A";
                                        typeLabel = "Cho mượn";
                                        amountColor = "#16A34A";
                                        amountPrefix = "+";
                                    } else if (item.type === "BORROW_CREATE") {
                                        badgeBg = "rgba(234, 88, 12, 0.12)";
                                        badgeColor = "#EA580C";
                                        typeLabel = "Tôi đi vay";
                                        amountColor = "#EA580C";
                                        amountPrefix = "+";
                                    } else if (item.type === "LEND_PAYMENT") {
                                        badgeBg = "rgba(16, 185, 129, 0.12)";
                                        badgeColor = "#10B981";
                                        typeLabel = "Thu nợ";
                                        amountColor = "#10B981";
                                        amountPrefix = "-";
                                    } else if (item.type === "BORROW_PAYMENT") {
                                        badgeBg = "rgba(59, 130, 246, 0.12)";
                                        badgeColor = "#3B82F6";
                                        typeLabel = "Tôi trả bớt";
                                        amountColor = "#3B82F6";
                                        amountPrefix = "-";
                                    } else if (item.type === "NET_OFFSET") {
                                        badgeBg = "rgba(139, 92, 246, 0.12)";
                                        badgeColor = "#8B5CF6";
                                        typeLabel = "Cấn trừ nợ";
                                        amountColor = "#8B5CF6";
                                        amountPrefix = "↔ ";
                                    }

                                    return (
                                        <View
                                            key={item.id}
                                            style={[
                                                styles.simpleHistoryRow,
                                                {
                                                    backgroundColor:
                                                        colors.card,
                                                    borderColor: colors.border,
                                                },
                                            ]}
                                        >
                                            {/* Cột trái: Badge loại + Thời gian + Ghi chú */}
                                            <View style={styles.simpleRowLeft}>
                                                <View
                                                    style={
                                                        styles.simpleRowTypeBadgeRow
                                                    }
                                                >
                                                    <View
                                                        style={[
                                                            styles.simpleBadge,
                                                            {
                                                                backgroundColor:
                                                                    badgeBg,
                                                            },
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.simpleBadgeText,
                                                                {
                                                                    color: badgeColor,
                                                                },
                                                            ]}
                                                        >
                                                            {typeLabel}
                                                        </Text>
                                                    </View>
                                                    <Text
                                                        style={[
                                                            styles.simpleRowTime,
                                                            {
                                                                color: colors.textMuted,
                                                            },
                                                        ]}
                                                    >
                                                        {formatDateTimeStr(
                                                            item.created_at,
                                                        )}
                                                    </Text>
                                                </View>

                                                {item.note ? (
                                                    <Text
                                                        style={[
                                                            styles.simpleRowNote,
                                                            {
                                                                color: colors.textSecondary,
                                                            },
                                                        ]}
                                                        numberOfLines={2}
                                                    >
                                                        {item.note}
                                                    </Text>
                                                ) : null}

                                                <Text
                                                    style={[
                                                        styles.simpleRowRunning,
                                                        {
                                                            color: colors.textMuted,
                                                        },
                                                    ]}
                                                >
                                                    Dư nợ sau đó:{" "}
                                                    <Text
                                                        style={{
                                                            color:
                                                                item.runningNet >
                                                                0
                                                                    ? "#16A34A"
                                                                    : item.runningNet <
                                                                        0
                                                                      ? "#EA580C"
                                                                      : colors.textSecondary,
                                                            fontWeight: "700",
                                                        }}
                                                    >
                                                        {item.runningNet > 0
                                                            ? `+${vnCurrencyFormatter.format(item.runningNet)}đ`
                                                            : item.runningNet <
                                                                0
                                                              ? `-${vnCurrencyFormatter.format(Math.abs(item.runningNet))}đ`
                                                              : "0đ"}
                                                    </Text>
                                                </Text>
                                            </View>

                                            {/* Cột phải: Số tiền + Nút Sửa + Nút Xóa */}
                                            <View style={styles.simpleRowRight}>
                                                <Text
                                                    style={[
                                                        styles.simpleRowAmount,
                                                        { color: amountColor },
                                                    ]}
                                                >
                                                    {amountPrefix}
                                                    {vnCurrencyFormatter.format(
                                                        item.amount,
                                                    )}
                                                    đ
                                                </Text>

                                                {/* Bộ nút Sửa / Xóa */}
                                                <View
                                                    style={
                                                        styles.simpleRowActions
                                                    }
                                                >
                                                    <Pressable
                                                        onPress={() =>
                                                            handleEditTimelineItem(
                                                                item,
                                                            )
                                                        }
                                                        hitSlop={8}
                                                        style={[
                                                            styles.simpleIconBtn,
                                                            {
                                                                backgroundColor:
                                                                    colors.cardSecondary,
                                                                borderColor:
                                                                    colors.borderSubtle,
                                                            },
                                                        ]}
                                                    >
                                                        <Pencil
                                                            size={13}
                                                            color={
                                                                colors.textSecondary
                                                            }
                                                        />
                                                    </Pressable>

                                                    <Pressable
                                                        onPress={() =>
                                                            handleDeleteTimelineItem(
                                                                item,
                                                            )
                                                        }
                                                        hitSlop={8}
                                                        style={[
                                                            styles.simpleIconBtn,
                                                            {
                                                                backgroundColor:
                                                                    "rgba(239, 68, 68, 0.08)",
                                                                borderColor:
                                                                    "rgba(239, 68, 68, 0.2)",
                                                            },
                                                        ]}
                                                    >
                                                        <Trash2
                                                            size={13}
                                                            color="#EF4444"
                                                        />
                                                    </Pressable>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Add Debt Sheet */}
            {showAddSheet && (
                <DebtFormSheet
                    defaultPersonName={personName}
                    defaultDirection={addSheetDirection}
                    onDone={handleRefresh}
                    onClose={() => {
                        setShowAddSheet(false);
                        setAddSheetDirection(undefined);
                    }}
                />
            )}

            {/* Edit Debt Sheet */}
            {editingDebt && (
                <DebtFormSheet
                    initialDebt={editingDebt}
                    onDone={handleRefresh}
                    onClose={() => setEditingDebt(null)}
                />
            )}

            {/* Edit Payment Sheet */}
            {editingPayment && (
                <PaymentFormSheet
                    debt={editingPayment.debt}
                    initialPayment={editingPayment.payment}
                    onDone={handleRefresh}
                    onClose={() => setEditingPayment(null)}
                />
            )}

            {/* Batch Payment Sheet */}
            {batchPaymentDirection !== null && (
                <BatchPaymentSheet
                    personName={personName}
                    direction={batchPaymentDirection}
                    maxAmount={
                        batchPaymentDirection === "BORROW"
                            ? summary.borrowTotal
                            : summary.lendTotal
                    }
                    onDone={handleRefresh}
                    onClose={() => setBatchPaymentDirection(null)}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8F9FA",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backButton: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 4,
        paddingRight: 8,
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#F97316",
        marginLeft: 2,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "800",
        flex: 1,
        textAlign: "center",
        marginHorizontal: 10,
    },
    headerActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    headerIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    mainScroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    // SIMPLE MODE STYLES
    simpleSection: {
        marginBottom: 20,
    },
    heroCard: {
        borderRadius: 24,
        borderWidth: 1,
        padding: 20,
        alignItems: "center",
        marginBottom: 20,
    },
    heroSubText: {
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 6,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    heroAmount: {
        fontSize: 32,
        fontWeight: "900",
        fontVariant: ["tabular-nums"],
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    heroStatusText: {
        fontSize: 12,
        fontWeight: "500",
        textAlign: "center",
        marginBottom: 18,
    },
    heroActionButtonsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        width: "100%",
    },
    heroBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        borderRadius: 16,
    },
    heroBtnAdd: {
        borderWidth: 1,
    },
    heroBtnAddText: {
        fontSize: 14,
        fontWeight: "700",
    },
    heroBtnPay: {},
    heroBtnPayText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    simpleHistorySection: {
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "700",
    },
    emptyTimelineCard: {
        padding: 32,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 10,
    },
    emptyText: {
        fontSize: 13,
        fontWeight: "500",
        textAlign: "center",
    },
    simpleHistoryHeader: {
        marginBottom: 12,
        marginLeft: 4,
    },
    simpleHistorySubtitle: {
        fontSize: 11,
        fontWeight: "500",
        marginTop: 2,
    },
    simpleHistoryList: {
        gap: 10,
    },
    simpleHistoryRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 14,
        borderRadius: 18,
        borderWidth: 1,
    },
    simpleRowLeft: {
        flex: 1,
        marginRight: 12,
    },
    simpleRowTypeBadgeRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 4,
    },
    simpleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginRight: 8,
    },
    simpleBadgeText: {
        fontSize: 11,
        fontWeight: "700",
    },
    simpleRowTime: {
        fontSize: 11,
        fontWeight: "500",
    },
    simpleRowNote: {
        fontSize: 13,
        fontWeight: "500",
        marginBottom: 4,
    },
    simpleRowRunning: {
        fontSize: 11,
        fontWeight: "500",
    },
    simpleRowRight: {
        alignItems: "flex-end",
    },
    simpleRowAmount: {
        fontSize: 15,
        fontWeight: "900",
        fontVariant: ["tabular-nums"],
        marginBottom: 8,
    },
    simpleRowActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    simpleIconBtn: {
        width: 28,
        height: 28,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
});
