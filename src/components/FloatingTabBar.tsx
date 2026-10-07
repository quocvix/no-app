// src/components/FloatingTabBar.tsx
import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import {
    Home,
    Clock,
    BarChart3,
    HandCoins,
    ScanQrCode,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../context/ThemeContext";

export type TabName = "home" | "history" | "report" | "debt";

export interface FloatingTabBarProps {
    currentTab: TabName;
    onSelectTab: (tab: TabName) => void;
    onOpenScanner: () => void;
}

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
    currentTab,
    onSelectTab,
    onOpenScanner,
}) => {
    const { isDark, colors } = useTheme();

    const handleTabPress = (tab: TabName) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelectTab(tab);
    };

    const handleScanPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onOpenScanner();
    };

    return (
        <View style={styles.wrapper} pointerEvents="box-none">
            <View style={[styles.pillContainer, { backgroundColor: colors.tabBarBg, borderColor: colors.tabBarBorder }]}>
                {/* Tab 1: Trang chủ */}
                <Pressable
                    accessibilityRole="tab"
                    accessibilityLabel="Trang chủ"
                    onPress={() => handleTabPress("home")}
                    style={styles.tabButton}
                >
                    <Home
                        size={22}
                        color={currentTab === "home" ? colors.textPrimary : colors.textMuted}
                        strokeWidth={currentTab === "home" ? 2.4 : 1.8}
                    />
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.tabLabel,
                            currentTab === "home" ? styles.tabLabelActive : styles.tabLabelInactive,
                            { color: currentTab === "home" ? colors.textPrimary : colors.textMuted },
                        ]}
                    >
                        Trang chủ
                    </Text>
                </Pressable>

                {/* Tab 2: Lịch sử */}
                <Pressable
                    accessibilityRole="tab"
                    accessibilityLabel="Lịch sử"
                    onPress={() => handleTabPress("history")}
                    style={styles.tabButton}
                >
                    <Clock
                        size={22}
                        color={currentTab === "history" ? colors.textPrimary : colors.textMuted}
                        strokeWidth={currentTab === "history" ? 2.4 : 1.8}
                    />
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.tabLabel,
                            currentTab === "history" ? styles.tabLabelActive : styles.tabLabelInactive,
                            { color: currentTab === "history" ? colors.textPrimary : colors.textMuted },
                        ]}
                    >
                        Lịch sử
                    </Text>
                </Pressable>

                {/* Center Floating QR Scan Button (Nổi nhô lên trên mép viền) */}
                <View style={styles.centerScanWrapper}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Quét mã VietQR"
                        onPress={handleScanPress}
                    >
                        <View style={[styles.centerScanButton, { backgroundColor: colors.scanBtnBg }]}>
                            <ScanQrCode
                                size={23}
                                color={colors.scanBtnText}
                                strokeWidth={2.3}
                            />
                        </View>
                    </Pressable>
                </View>

                {/* Tab 3: Báo cáo */}
                <Pressable
                    accessibilityRole="tab"
                    accessibilityLabel="Báo cáo"
                    onPress={() => handleTabPress("report")}
                    style={styles.tabButton}
                >
                    <BarChart3
                        size={22}
                        color={currentTab === "report" ? colors.textPrimary : colors.textMuted}
                        strokeWidth={currentTab === "report" ? 2.4 : 1.8}
                    />
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.tabLabel,
                            currentTab === "report" ? styles.tabLabelActive : styles.tabLabelInactive,
                            { color: currentTab === "report" ? colors.textPrimary : colors.textMuted },
                        ]}
                    >
                        Báo cáo
                    </Text>
                </Pressable>

                {/* Tab 4: Sổ nợ */}
                <Pressable
                    accessibilityRole="tab"
                    accessibilityLabel="Sổ nợ"
                    onPress={() => handleTabPress("debt")}
                    style={styles.tabButton}
                >
                    <HandCoins
                        size={22}
                        color={currentTab === "debt" ? colors.textPrimary : colors.textMuted}
                        strokeWidth={currentTab === "debt" ? 2.4 : 1.8}
                    />
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.tabLabel,
                            currentTab === "debt" ? styles.tabLabelActive : styles.tabLabelInactive,
                            { color: currentTab === "debt" ? colors.textPrimary : colors.textMuted },
                        ]}
                    >
                        Sổ nợ
                    </Text>
                </Pressable>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: "absolute",
        bottom: Platform.OS === "ios" ? 28 : 18,
        left: 0,
        right: 0,
        alignItems: "center",
        paddingHorizontal: 16,
        zIndex: 99,
    },
    pillContainer: {
        width: "100%",
        maxWidth: 390,
        height: 64,
        backgroundColor: "#FFFFFF",
        borderRadius: 36,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: "rgba(241, 245, 249, 0.9)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
        elevation: 8,
        overflow: "visible",
    },
    tabButton: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 4,
        paddingHorizontal: 2,
        flex: 1,
        minWidth: 56,
    },
    tabLabel: {
        fontSize: 11,
        marginTop: 4,
        fontWeight: "500",
        textAlign: "center",
        includeFontPadding: false,
    },
    tabLabelActive: {
        fontWeight: "700",
    },
    tabLabelInactive: {
        fontWeight: "500",
    },
    centerScanWrapper: {
        alignItems: "center",
        justifyContent: "center",
        marginTop: -32,
        zIndex: 10,
        marginHorizontal: 2,
    },
    centerScanButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: "#161618",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.32,
        shadowRadius: 8,
        elevation: 8,
    },
});
