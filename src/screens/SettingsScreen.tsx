// src/screens/SettingsScreen.tsx
import React, { useState } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ScrollView,
    Switch,
    Alert,
    ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    Building2,
    Wallet,
    ShieldCheck,
    ChevronRight,
    ChevronLeft,
    Database,
    Info,
    Moon,
    Sun,
    FolderKanban,
    FileDown,
    FileUp,
    Trash2,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../context/ThemeContext";
import { BankPickerModal } from "../components/BankPickerModal";
import { SUPPORTED_BANKS, getBankByCode, BankMeta } from "../constants/banks";
import { storage, STORAGE_KEYS, getCachedDashboardData } from "../storage/mmkv";
import { exportDatabaseToJson, pickAndValidateBackupFile, applyRestore } from "../services/backupService";
import { clearAllUserData } from "../storage/sqlite";

const vnCurrencyFormatter = new Intl.NumberFormat("vi-VN");

interface SettingsScreenProps {
    onBack?: () => void;
    onOpenCategoryManagement?: () => void;
    onDataChanged?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
    onBack,
    onOpenCategoryManagement,
    onDataChanged,
}) => {
    const insets = useSafeAreaInsets();
    const { isDark, colors, toggleTheme } = useTheme();
    const cached = getCachedDashboardData();

    const [defaultBank, setDefaultBank] = useState<BankMeta>(() =>
        getBankByCode(cached.defaultBank),
    );
    const [isBalanceHidden, setIsBalanceHidden] = useState(
        cached.isBalanceHidden,
    );
    const [monthlyBudget, setMonthlyBudget] = useState(cached.monthlyBudget);
    const [showBankModal, setShowBankModal] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    const handleBankChange = (bank: BankMeta) => {
        setDefaultBank(bank);
        storage.setString(STORAGE_KEYS.DEFAULT_SOURCE_BANK, bank.code);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const handleTogglePrivacy = (val: boolean) => {
        setIsBalanceHidden(val);
        storage.setBoolean(STORAGE_KEYS.IS_BALANCE_HIDDEN, val);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleExportJSON = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsBackingUp(true);
        const result = await exportDatabaseToJson();
        setIsBackingUp(false);
        if (result.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (result.savedToDownloads) {
                Alert.alert(
                    "Đã tải về thành công",
                    `File sao lưu "${result.fileName}" đã được lưu vào thư mục Tải về (Download) trên máy của bạn.`
                );
            }
        } else if (result.error) {
            Alert.alert("Lỗi sao lưu", result.error);
        }
    };

    const handleImportJSON = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsRestoring(true);
        try {
            const res = await pickAndValidateBackupFile();
            setIsRestoring(false);

            if (!res.success) {
                if (res.error) {
                    Alert.alert("Lỗi đọc file sao lưu", res.error);
                }
                return;
            }

            const backup = res.data!;
            const transCount = backup.transactions?.length || 0;
            const debtCount = backup.debts?.length || 0;

            Alert.alert(
                "Khôi phục dữ liệu",
                `Đã đọc thành công file sao lưu:\n• ${transCount} giao dịch\n• ${debtCount} khoản nợ\n\nBạn muốn áp dụng theo phương thức nào?`,
                [
                    { text: "Hủy", style: "cancel" },
                    {
                        text: "Gộp thêm dữ liệu",
                        onPress: () => {
                            const ok = applyRestore(backup, "merge");
                            if (ok) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                onDataChanged?.();
                                Alert.alert("Thành công", "Đã gộp dữ liệu từ bản sao lưu.");
                            }
                        },
                    },
                    {
                        text: "Ghi đè toàn bộ",
                        style: "destructive",
                        onPress: () => {
                            const ok = applyRestore(backup, "replace");
                            if (ok) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                onDataChanged?.();
                                Alert.alert("Thành công", "Đã khôi phục toàn bộ dữ liệu từ bản sao lưu.");
                            }
                        },
                    },
                ]
            );
        } catch {
            setIsRestoring(false);
        }
    };

    const handleClearAllData = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
            "Xóa toàn bộ dữ liệu",
            "Bạn có chắc chắn muốn xóa toàn bộ lịch sử chi tiêu và sổ nợ? Danh mục chi tiêu và cài đặt cá nhân vẫn được giữ lại.",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Tiếp tục",
                    style: "destructive",
                    onPress: () => {
                        Alert.alert(
                            "Xác nhận lần cuối",
                            "Toàn bộ dữ liệu giao dịch và sổ nợ sẽ bị xóa vĩnh viễn và không thể hoàn tác. Bạn chắc chắn muốn xóa?",
                            [
                                { text: "Hủy", style: "cancel" },
                                {
                                    text: "Xóa vĩnh viễn",
                                    style: "destructive",
                                    onPress: () => {
                                        clearAllUserData();
                                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                        onDataChanged?.();
                                        Alert.alert("Đã làm sạch", "Toàn bộ giao dịch và sổ nợ đã được xóa.");
                                    },
                                },
                            ]
                        );
                    },
                },
            ]
        );
    };

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={[
                styles.scrollContent,
                {
                    paddingTop: insets.top + 8,
                    paddingBottom: insets.bottom + 90,
                },
            ]}
            showsVerticalScrollIndicator={false}
        >
            {onBack ? (
                <View style={styles.headerWithBack}>
                    <Pressable
                        onPress={onBack}
                        hitSlop={12}
                        style={styles.backButton}
                    >
                        <ChevronLeft size={22} color="#F97316" />
                        <Text style={styles.backButtonText}>Quay lại</Text>
                    </Pressable>
                    <Text
                        style={[
                            styles.screenTitleBack,
                            { color: colors.textPrimary },
                        ]}
                    >
                        Cài đặt
                    </Text>
                    <View style={{ width: 60 }} />
                </View>
            ) : (
                <Text
                    style={[styles.screenTitle, { color: colors.textPrimary }]}
                >
                    Cài đặt
                </Text>
            )}

            {/* Group: Giao diện & Hiển thị */}
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>
                GIAO DIỆN & HIỂN THỊ
            </Text>
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                    },
                ]}
            >
                <View style={styles.row}>
                    <View style={styles.rowLeft}>
                        <View
                            style={[
                                styles.iconBox,
                                { backgroundColor: colors.cardSecondary },
                            ]}
                        >
                            {isDark ? (
                                <Moon size={20} color={colors.textPrimary} />
                            ) : (
                                <Sun size={20} color={colors.textPrimary} />
                            )}
                        </View>
                        <View>
                            <Text
                                style={[
                                    styles.rowTitle,
                                    { color: colors.textPrimary },
                                ]}
                            >
                                Chế độ tối (Dark Mode)
                            </Text>
                            <Text
                                style={[
                                    styles.rowSubtitle,
                                    { color: colors.textSecondary },
                                ]}
                            >
                                {isDark
                                    ? "Giao diện Sleek OLED Charcoal"
                                    : "Giao diện Clean Light Minimalist"}
                            </Text>
                        </View>
                    </View>
                    <Switch
                        value={isDark}
                        onValueChange={() => {
                            toggleTheme();
                            Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Light,
                            );
                        }}
                        trackColor={{ false: "#E2E8F0", true: "#FAFAFA" }}
                        thumbColor={isDark ? "#09090B" : "#FFFFFF"}
                    />
                </View>
            </View>

            {/* Group: Cấu hình thanh toán */}
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>
                THANH TOÁN & NGÂN SÁCH
            </Text>
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                    },
                ]}
            >
                <Pressable
                    onPress={() => setShowBankModal(true)}
                    style={styles.row}
                >
                    <View style={styles.rowLeft}>
                        <View
                            style={[
                                styles.iconBox,
                                { backgroundColor: colors.cardSecondary },
                            ]}
                        >
                            <Building2 size={20} color={colors.textPrimary} />
                        </View>
                        <View>
                            <Text
                                style={[
                                    styles.rowTitle,
                                    { color: colors.textPrimary },
                                ]}
                            >
                                Ngân hàng mặc định
                            </Text>
                            <Text
                                style={[
                                    styles.rowSubtitle,
                                    { color: colors.textSecondary },
                                ]}
                            >
                                Tự động mở khi bấm Chuyển khoản
                            </Text>
                        </View>
                    </View>
                    <View style={styles.rowRight}>
                        <Text
                            style={[
                                styles.bankValueBadge,
                                {
                                    backgroundColor: colors.cardSecondary,
                                    color: colors.textPrimary,
                                },
                            ]}
                        >
                            {defaultBank.code}
                        </Text>
                        <ChevronRight size={18} color={colors.textMuted} />
                    </View>
                </Pressable>

                <View
                    style={[
                        styles.rowDivider,
                        { backgroundColor: colors.borderSubtle },
                    ]}
                />

                <View style={styles.row}>
                    <View style={styles.rowLeft}>
                        <View
                            style={[
                                styles.iconBox,
                                { backgroundColor: colors.cardSecondary },
                            ]}
                        >
                            <Wallet size={20} color={colors.textPrimary} />
                        </View>
                        <View>
                            <Text
                                style={[
                                    styles.rowTitle,
                                    { color: colors.textPrimary },
                                ]}
                            >
                                Hạn mức tháng
                            </Text>
                            <Text
                                style={[
                                    styles.rowSubtitle,
                                    { color: colors.textSecondary },
                                ]}
                            >
                                Dùng tính tỷ lệ % chi tiêu
                            </Text>
                        </View>
                    </View>
                    <View style={styles.rowRight}>
                        <Text
                            style={[
                                styles.rowValue,
                                { color: colors.textPrimary },
                            ]}
                        >
                            {vnCurrencyFormatter.format(monthlyBudget)}đ
                        </Text>
                    </View>
                </View>

                <View
                    style={[
                        styles.rowDivider,
                        { backgroundColor: colors.borderSubtle },
                    ]}
                />

                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onOpenCategoryManagement?.();
                    }}
                    style={styles.row}
                >
                    <View style={styles.rowLeft}>
                        <View
                            style={[
                                styles.iconBox,
                                { backgroundColor: colors.cardSecondary },
                            ]}
                        >
                            <FolderKanban size={20} color={colors.textPrimary} />
                        </View>
                        <View>
                            <Text
                                style={[
                                    styles.rowTitle,
                                    { color: colors.textPrimary },
                                ]}
                            >
                                Quản lý danh mục
                            </Text>
                            <Text
                                style={[
                                    styles.rowSubtitle,
                                    { color: colors.textSecondary },
                                ]}
                            >
                                Thêm, sửa, đổi icon và ẩn/hiện danh mục
                            </Text>
                        </View>
                    </View>
                    <View style={styles.rowRight}>
                        <ChevronRight size={18} color={colors.textMuted} />
                    </View>
                </Pressable>
            </View>

            {/* Group: Quyền riêng tư & Dữ liệu */}
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>
                DỮ LIỆU & BẢO MẬT
            </Text>
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                    },
                ]}
            >
                <View style={styles.row}>
                    <View style={styles.rowLeft}>
                        <View
                            style={[
                                styles.iconBox,
                                { backgroundColor: colors.cardSecondary },
                            ]}
                        >
                            <ShieldCheck size={20} color={colors.textPrimary} />
                        </View>
                        <View>
                            <Text
                                style={[
                                    styles.rowTitle,
                                    { color: colors.textPrimary },
                                ]}
                            >
                                Ẩn số dư mặc định
                            </Text>
                            <Text
                                style={[
                                    styles.rowSubtitle,
                                    { color: colors.textSecondary },
                                ]}
                            >
                                Che giấu số tiền khi ở nơi công cộng
                            </Text>
                        </View>
                    </View>
                    <Switch
                        value={isBalanceHidden}
                        onValueChange={handleTogglePrivacy}
                        trackColor={{
                            false: "#E2E8F0",
                            true: isDark ? "#FAFAFA" : "#0F172A",
                        }}
                        thumbColor={
                            isDark && isBalanceHidden ? "#09090B" : "#FFFFFF"
                        }
                    />
                </View>

                <View
                    style={[
                        styles.rowDivider,
                        { backgroundColor: colors.borderSubtle },
                    ]}
                />

                {/* 1. Sao lưu dữ liệu (Xuất file JSON) */}
                <Pressable
                    onPress={handleExportJSON}
                    disabled={isBackingUp || isRestoring}
                    style={styles.row}
                >
                    <View style={styles.rowLeft}>
                        <View
                            style={[
                                styles.iconBox,
                                { backgroundColor: colors.cardSecondary },
                            ]}
                        >
                            <FileUp size={20} color={colors.textPrimary} />
                        </View>
                        <View>
                            <Text
                                style={[
                                    styles.rowTitle,
                                    { color: colors.textPrimary },
                                ]}
                            >
                                Sao lưu dữ liệu (Xuất JSON)
                            </Text>
                            <Text
                                style={[
                                    styles.rowSubtitle,
                                    { color: colors.textSecondary },
                                ]}
                            >
                                Lưu trọn vẹn chi tiêu & sổ nợ để đổi thiết bị
                            </Text>
                        </View>
                    </View>
                    {isBackingUp ? (
                        <ActivityIndicator size="small" color={colors.textPrimary} />
                    ) : (
                        <ChevronRight size={18} color={colors.textMuted} />
                    )}
                </Pressable>

                <View
                    style={[
                        styles.rowDivider,
                        { backgroundColor: colors.borderSubtle },
                    ]}
                />

                {/* 2. Khôi phục dữ liệu (Nhập file JSON) */}
                <Pressable
                    onPress={handleImportJSON}
                    disabled={isBackingUp || isRestoring}
                    style={styles.row}
                >
                    <View style={styles.rowLeft}>
                        <View
                            style={[
                                styles.iconBox,
                                { backgroundColor: colors.cardSecondary },
                            ]}
                        >
                            <FileDown size={20} color={colors.textPrimary} />
                        </View>
                        <View>
                            <Text
                                style={[
                                    styles.rowTitle,
                                    { color: colors.textPrimary },
                                ]}
                            >
                                Khôi phục dữ liệu (Nhập JSON)
                            </Text>
                            <Text
                                style={[
                                    styles.rowSubtitle,
                                    { color: colors.textSecondary },
                                ]}
                            >
                                Nạp lại dữ liệu từ file sao lưu đã có
                            </Text>
                        </View>
                    </View>
                    {isRestoring ? (
                        <ActivityIndicator size="small" color={colors.textPrimary} />
                    ) : (
                        <ChevronRight size={18} color={colors.textMuted} />
                    )}
                </Pressable>

                <View
                    style={[
                        styles.rowDivider,
                        { backgroundColor: colors.borderSubtle },
                    ]}
                />

                {/* 3. Xóa toàn bộ dữ liệu */}
                <Pressable
                    onPress={handleClearAllData}
                    disabled={isBackingUp || isRestoring}
                    style={styles.row}
                >
                    <View style={styles.rowLeft}>
                        <View
                            style={[
                                styles.iconBox,
                                { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2" },
                            ]}
                        >
                            <Trash2 size={20} color="#EF4444" />
                        </View>
                        <View>
                            <Text
                                style={[
                                    styles.rowTitle,
                                    { color: "#EF4444", fontWeight: "700" },
                                ]}
                            >
                                Xóa toàn bộ dữ liệu
                            </Text>
                            <Text
                                style={[
                                    styles.rowSubtitle,
                                    { color: colors.textSecondary },
                                ]}
                            >
                                Xóa sạch lịch sử giao dịch và sổ nợ về 0
                            </Text>
                        </View>
                    </View>
                    <ChevronRight size={18} color="#EF4444" />
                </Pressable>
            </View>

            {/* Group: Về ứng dụng */}
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>
                VỀ ỨNG DỤNG "NỢ"
            </Text>
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                    },
                ]}
            >
                <View style={styles.row}>
                    <View style={styles.rowLeft}>
                        <View
                            style={[
                                styles.iconBox,
                                { backgroundColor: colors.cardSecondary },
                            ]}
                        >
                            <Database size={20} color={colors.textPrimary} />
                        </View>
                        <View>
                            <Text
                                style={[
                                    styles.rowTitle,
                                    { color: colors.textPrimary },
                                ]}
                            >
                                Lưu trữ trên thiết bị
                            </Text>
                            <Text
                                style={[
                                    styles.rowSubtitle,
                                    { color: colors.textSecondary },
                                ]}
                            >
                                SQLite + MMKV (100% Offline)
                            </Text>
                        </View>
                    </View>
                    <Text
                        style={[
                            styles.versionBadge,
                            {
                                backgroundColor: colors.cardSecondary,
                                color: colors.textSecondary,
                            },
                        ]}
                    >
                        An toàn
                    </Text>
                </View>

                <View
                    style={[
                        styles.rowDivider,
                        { backgroundColor: colors.borderSubtle },
                    ]}
                />

                <View style={styles.row}>
                    <View style={styles.rowLeft}>
                        <View
                            style={[
                                styles.iconBox,
                                { backgroundColor: colors.cardSecondary },
                            ]}
                        >
                            <Info size={20} color={colors.textPrimary} />
                        </View>
                        <View>
                            <Text
                                style={[
                                    styles.rowTitle,
                                    { color: colors.textPrimary },
                                ]}
                            >
                                Phiên bản
                            </Text>
                            <Text
                                style={[
                                    styles.rowSubtitle,
                                    { color: colors.textSecondary },
                                ]}
                            >
                                Quét là ghi · Trả xong vào sổ
                            </Text>
                        </View>
                    </View>
                    <Text
                        style={[
                            styles.versionBadge,
                            {
                                backgroundColor: colors.cardSecondary,
                                color: colors.textSecondary,
                            },
                        ]}
                    >
                        v1.0
                    </Text>
                </View>
            </View>

            {/* Bank Picker Modal */}
            <BankPickerModal
                visible={showBankModal}
                selectedCode={defaultBank.code}
                onSelect={handleBankChange}
                onClose={() => setShowBankModal(false)}
            />
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
    screenTitle: {
        fontSize: 28,
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 20,
        letterSpacing: -0.5,
    },
    headerWithBack: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
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
    screenTitleBack: {
        fontSize: 20,
        fontWeight: "800",
    },
    groupLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#94A3B8",
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 4,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: "rgba(241, 245, 249, 0.9)",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 1,
        marginBottom: 24,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
    },
    rowDivider: {
        height: 1,
        backgroundColor: "#F8F9FA",
    },
    rowLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: "#F8F9FA",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    rowTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 3,
    },
    rowSubtitle: {
        fontSize: 12,
        color: "#94A3B8",
    },
    rowRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    rowValue: {
        fontSize: 14,
        fontWeight: "700",
        color: "#0F172A",
        fontVariant: ["tabular-nums"],
    },
    bankValueBadge: {
        fontSize: 13,
        fontWeight: "800",
        color: "#0F172A",
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 4,
    },
    versionBadge: {
        fontSize: 12,
        fontWeight: "600",
        color: "#64748B",
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
});
