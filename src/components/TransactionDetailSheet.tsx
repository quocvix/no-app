// src/components/TransactionDetailSheet.tsx
import React, { useMemo, useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import BottomSheet, {
    BottomSheetView,
    BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import {
    Pencil,
    Trash2,
    ExternalLink,
    Calendar,
    CreditCard,
    User,
    FileText,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Transaction } from "../storage/sqlite";
import { getCategoryIcon } from "./CategoryPickerModal";
import { useTheme } from "../context/ThemeContext";

const vnCurrencyFormatter = new Intl.NumberFormat("vi-VN");

interface TransactionDetailSheetProps {
    transaction: Transaction | null;
    onEdit: (tx: Transaction) => void;
    onDelete: (tx: Transaction) => void;
    onOpenDebt?: (debtId: string) => void;
    onClose: () => void;
}

const formatDetailDateTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const hours = d.getHours().toString().padStart(2, "0");
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${hours}:${minutes} · ${day}/${month}/${year}`;
};

export const TransactionDetailSheet: React.FC<TransactionDetailSheetProps> = ({
    transaction,
    onEdit,
    onDelete,
    onOpenDebt,
    onClose,
}) => {
    const { colors, isDark } = useTheme();
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ["52%"], []);

    useEffect(() => {
        if (transaction) {
            bottomSheetRef.current?.expand();
        }
    }, [transaction]);

    if (!transaction) return null;

    const isIncome = transaction.type === "INCOME";
    const prefix = isIncome ? "+" : "-";
    const amountFormatted = `${prefix}${vnCurrencyFormatter.format(transaction.amount)}đ`;
    const isDebtLinked =
        Boolean(transaction.debt_id) || transaction.category_id === "cat_debt";
    const isAutoNote =
        transaction.note === "Chi tiêu tiền mặt" ||
        transaction.note === "Chi tiêu ngân hàng";
    const displayNote =
        transaction.note && !isAutoNote ? transaction.note.trim() : "";

    const handleEditPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onEdit(transaction);
        onClose();
    };

    const handleDeletePress = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        onDelete(transaction);
        onClose();
    };

    const handleOpenDebtPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (transaction.debt_id && onOpenDebt) {
            onOpenDebt(transaction.debt_id);
        }
        onClose();
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
            backgroundStyle={[
                styles.sheetBackground,
                { backgroundColor: colors.card },
            ]}
            handleIndicatorStyle={[
                styles.handleIndicator,
                { backgroundColor: colors.border },
            ]}
        >
            <BottomSheetView style={styles.contentContainer}>
                {/* Header with Category & Amount */}
                <View style={styles.topHeader}>
                    <View
                        style={[
                            styles.iconBox,
                            { backgroundColor: colors.cardSecondary },
                        ]}
                    >
                        {getCategoryIcon(
                            transaction.category_icon || "MoreHorizontal",
                            22,
                            colors.textPrimary,
                        )}
                    </View>
                    <View style={styles.headerInfo}>
                        <View style={styles.categoryBadgeRow}>
                            {isDebtLinked ? (
                                <View
                                    style={[
                                        styles.debtBadge,
                                        { marginLeft: 0 },
                                    ]}
                                >
                                    <Text style={styles.debtBadgeText}>Nợ</Text>
                                </View>
                            ) : (
                                <Text
                                    style={[
                                        styles.categoryName,
                                        { color: colors.textPrimary },
                                    ]}
                                >
                                    {transaction.category_name || "Chi tiêu"}
                                </Text>
                            )}
                        </View>
                        <Text
                            style={[
                                styles.amountText,
                                isIncome
                                    ? styles.incomeAmountText
                                    : styles.expenseAmountText,
                            ]}
                        >
                            {amountFormatted}
                        </Text>
                    </View>
                </View>

                {/* Details Card */}
                <View
                    style={[
                        styles.detailsCard,
                        {
                            backgroundColor: colors.cardSecondary,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    {/* Time */}
                    <View style={styles.detailRow}>
                        <View style={styles.detailLabelWrap}>
                            <Calendar
                                size={15}
                                color={colors.textMuted}
                                style={{ marginRight: 8 }}
                            />
                            <Text
                                style={[
                                    styles.detailLabel,
                                    { color: colors.textMuted },
                                ]}
                            >
                                Thời gian
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.detailValue,
                                { color: colors.textPrimary },
                            ]}
                        >
                            {formatDetailDateTime(transaction.created_at)}
                        </Text>
                    </View>

                    {/* Bank / Payment Method */}
                    <View
                        style={[
                            styles.detailRow,
                            {
                                borderTopWidth: 1,
                                borderTopColor: colors.borderSubtle,
                            },
                        ]}
                    >
                        <View style={styles.detailLabelWrap}>
                            <CreditCard
                                size={15}
                                color={colors.textMuted}
                                style={{ marginRight: 8 }}
                            />
                            <Text
                                style={[
                                    styles.detailLabel,
                                    { color: colors.textMuted },
                                ]}
                            >
                                {transaction.source_bank_code === "CASH"
                                    ? "Nguồn tiền"
                                    : "Ngân hàng"}
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.detailValue,
                                { color: colors.textPrimary },
                            ]}
                        >
                            {transaction.source_bank_code === "CASH"
                                ? "Tiền mặt"
                                : transaction.source_bank_code}
                        </Text>
                    </View>

                    {/* Receiver / Partner only for Debt transactions */}
                    {isDebtLinked &&
                    (transaction.receiver_name ||
                        transaction.receiver_account) ? (
                        <View
                            style={[
                                styles.detailRow,
                                {
                                    borderTopWidth: 1,
                                    borderTopColor: colors.borderSubtle,
                                },
                            ]}
                        >
                            <View style={styles.detailLabelWrap}>
                                <User
                                    size={15}
                                    color={colors.textMuted}
                                    style={{ marginRight: 8 }}
                                />
                                <Text
                                    style={[
                                        styles.detailLabel,
                                        { color: colors.textMuted },
                                    ]}
                                >
                                    Đối tác
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.detailValue,
                                    { color: colors.textPrimary },
                                ]}
                                numberOfLines={1}
                            >
                                {transaction.receiver_name ||
                                    transaction.receiver_account}
                            </Text>
                        </View>
                    ) : null}

                    {/* Note row (always visible) */}
                    <View
                        style={[
                            styles.detailRow,
                            {
                                borderTopWidth: 1,
                                borderTopColor: colors.borderSubtle,
                            },
                        ]}
                    >
                        <View style={styles.detailLabelWrap}>
                            <FileText
                                size={15}
                                color={colors.textMuted}
                                style={{ marginRight: 8 }}
                            />
                            <Text
                                style={[
                                    styles.detailLabel,
                                    { color: colors.textMuted },
                                ]}
                            >
                                Ghi chú
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.detailValue,
                                {
                                    color: displayNote
                                        ? colors.textPrimary
                                        : colors.textMuted,
                                    flex: 1,
                                    textAlign: "right",
                                },
                            ]}
                            numberOfLines={2}
                        >
                            {displayNote || "Chưa có ghi chú"}
                        </Text>
                    </View>
                </View>

                {/* Action Buttons */}
                {isDebtLinked ? (
                    <View style={styles.debtActionsWrap}>
                        <Pressable
                            onPress={handleOpenDebtPress}
                            style={[
                                styles.openDebtBtn,
                                {
                                    backgroundColor: isDark
                                        ? "#FAFAFA"
                                        : "#0F172A",
                                },
                            ]}
                        >
                            <ExternalLink
                                size={16}
                                color={isDark ? "#09090B" : "#FFFFFF"}
                                style={{ marginRight: 8 }}
                            />
                            <Text
                                style={[
                                    styles.openDebtBtnText,
                                    { color: isDark ? "#09090B" : "#FFFFFF" },
                                ]}
                            >
                                Mở trong Sổ nợ
                            </Text>
                        </Pressable>
                        <Text
                            style={[
                                styles.debtHintText,
                                { color: colors.textMuted },
                            ]}
                        >
                            Giao dịch này sinh ra từ Sổ nợ, quản lý tại Sổ nợ để
                            đồng bộ số dư.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.buttonRow}>
                        <Pressable
                            onPress={handleDeletePress}
                            style={[
                                styles.deleteBtn,
                                {
                                    backgroundColor: isDark
                                        ? "rgba(239, 68, 68, 0.15)"
                                        : "#FEE2E2",
                                },
                            ]}
                        >
                            <Trash2
                                size={18}
                                color="#DC2626"
                                style={{ marginRight: 8 }}
                            />
                            <Text style={styles.deleteBtnText}>Xóa</Text>
                        </Pressable>

                        <Pressable
                            onPress={handleEditPress}
                            style={[
                                styles.editBtn,
                                {
                                    backgroundColor: isDark
                                        ? "#FAFAFA"
                                        : "#0F172A",
                                },
                            ]}
                        >
                            <Pencil
                                size={18}
                                color={isDark ? "#09090B" : "#FFFFFF"}
                                style={{ marginRight: 8 }}
                            />
                            <Text
                                style={[
                                    styles.editBtnText,
                                    { color: isDark ? "#09090B" : "#FFFFFF" },
                                ]}
                            >
                                Sửa giao dịch
                            </Text>
                        </Pressable>
                    </View>
                )}
            </BottomSheetView>
        </BottomSheet>
    );
};

const styles = StyleSheet.create({
    sheetBackground: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
        elevation: 20,
    },
    handleIndicator: {
        backgroundColor: "#E2E8F0",
        width: 44,
        height: 4,
        borderRadius: 2,
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: 24,
        justifyContent: "space-between",
    },
    topHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    headerInfo: {
        flex: 1,
    },
    categoryBadgeRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 2,
    },
    categoryName: {
        fontSize: 14,
        fontWeight: "600",
    },
    debtBadge: {
        marginLeft: 8,
        backgroundColor: "rgba(249, 115, 22, 0.12)",
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 8,
    },
    debtBadgeText: {
        color: "#EA580C",
        fontSize: 13.5,
        fontWeight: "700",
    },
    amountText: {
        fontSize: 26,
        fontWeight: "900",
        fontVariant: ["tabular-nums"],
        letterSpacing: -0.5,
    },
    incomeAmountText: {
        color: "#16A34A",
    },
    expenseAmountText: {
        color: "#EA580C",
    },
    detailsCard: {
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderWidth: 1,
        marginBottom: 18,
    },
    detailRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
    },
    detailLabelWrap: {
        flexDirection: "row",
        alignItems: "center",
    },
    detailLabel: {
        fontSize: 13,
        fontWeight: "500",
    },
    detailValue: {
        fontSize: 13,
        fontWeight: "600",
    },
    buttonRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    deleteBtn: {
        flex: 1,
        height: 52,
        borderRadius: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    deleteBtnText: {
        color: "#DC2626",
        fontSize: 15,
        fontWeight: "700",
    },
    editBtn: {
        flex: 2,
        height: 52,
        borderRadius: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    editBtnText: {
        fontSize: 15,
        fontWeight: "700",
    },
    debtActionsWrap: {
        alignItems: "center",
    },
    openDebtBtn: {
        width: "100%",
        height: 52,
        borderRadius: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    openDebtBtnText: {
        fontSize: 15,
        fontWeight: "700",
    },
    debtHintText: {
        fontSize: 12,
        textAlign: "center",
        paddingHorizontal: 8,
    },
});
