// src/screens/ScannerScreen.tsx
import React, { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { X, Zap, ZapOff, Sparkles } from "lucide-react-native";
import { decodeVietQR, VietQRData } from "../services/vietqrParser";

interface ScannerScreenProps {
    onClose: () => void;
    onScanSuccess: (data: VietQRData) => void;
}

export const ScannerScreen: React.FC<ScannerScreenProps> = ({
    onClose,
    onScanSuccess,
}) => {
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const [enableTorch, setEnableTorch] = useState(false);
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        if (!permission?.granted) {
            requestPermission();
        }
    }, [permission, requestPermission]);

    const handleBarcodeScanned = ({ data }: { data: string }) => {
        if (scanned) return;
        setScanned(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const parsed = decodeVietQR(data);
        onScanSuccess(parsed);
    };

    // Sample VietQR generator for instant testing / demo without physical QR
    const handleTestSampleQR = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const mockQRData: VietQRData = {
            isValid: true,
            isDynamic: true,
            bankBin: "970407", // Techcombank
            bankCode: "TCB",
            accountNumber: "2023130298",
            amount: 200000,
            memo: "Ăn uống",
            rawPayload:
                "00020101021238540010A0000007270126000697040701102023130298530370454062000005802VN62110807An uong6304ABCD",
        };
        onScanSuccess(mockQRData);
    };

    return (
        <View style={styles.container}>
            {permission?.granted ? (
                <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    enableTorch={enableTorch}
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={
                        scanned ? undefined : handleBarcodeScanned
                    }
                />
            ) : (
                <View style={styles.permissionContainer}>
                    <Text style={styles.permissionText}>
                        Cần quyền sử dụng Camera để quét mã VietQR.
                    </Text>
                    <Pressable
                        onPress={requestPermission}
                        style={styles.permissionBtn}
                    >
                        <Text style={styles.permissionBtnText}>
                            Cấp quyền Camera
                        </Text>
                    </Pressable>
                </View>
            )}

            {/* Top Header Floating Controls */}
            <View style={[styles.topHeader, { top: insets.top + 16 }]}>
                <Pressable onPress={onClose} style={styles.iconCircle}>
                    <X size={22} color="#FFFFFF" />
                </Pressable>

                <Pressable
                    onPress={() => setEnableTorch((prev) => !prev)}
                    style={styles.iconCircle}
                >
                    {enableTorch ? (
                        <Zap size={22} color="#F97316" />
                    ) : (
                        <ZapOff size={22} color="#FFFFFF" />
                    )}
                </Pressable>
            </View>

            {/* Reticle Focus Viewfinder */}
            <View style={styles.reticleOverlay} pointerEvents="box-none">
                <View style={styles.viewfinderFrame}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />
                </View>
                <Text style={styles.instructionText}>
                    Đặt mã VietQR vào giữa khung hình
                </Text>
            </View>

            {/* Bottom Demo / Test Helper Button */}
            <View
                style={[
                    styles.bottomControlBar,
                    { bottom: insets.bottom + 24 },
                ]}
            >
                <Pressable
                    onPress={handleTestSampleQR}
                    style={styles.testQrButton}
                >
                    <Sparkles
                        size={16}
                        color="#F97316"
                        style={{ marginRight: 6 }}
                    />
                    <Text style={styles.testQrText}>
                        Mã mẫu VietQR (Demo 200.000đ)
                    </Text>
                </Pressable>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000000",
    },
    permissionContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
    },
    permissionText: {
        color: "#FFFFFF",
        fontSize: 16,
        textAlign: "center",
        marginBottom: 20,
        lineHeight: 24,
    },
    permissionBtn: {
        backgroundColor: "#111827",
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 20,
    },
    permissionBtnText: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "700",
    },
    topHeader: {
        position: "absolute",
        left: 20,
        right: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 10,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        alignItems: "center",
        justifyContent: "center",
    },
    reticleOverlay: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    viewfinderFrame: {
        width: 260,
        height: 260,
        borderRadius: 32,
        position: "relative",
        backgroundColor: "transparent",
    },
    corner: {
        position: "absolute",
        width: 36,
        height: 36,
        borderColor: "#FFFFFF",
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 3.5,
        borderLeftWidth: 3.5,
        borderTopLeftRadius: 28,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: 3.5,
        borderRightWidth: 3.5,
        borderTopRightRadius: 28,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 3.5,
        borderLeftWidth: 3.5,
        borderBottomLeftRadius: 28,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 3.5,
        borderRightWidth: 3.5,
        borderBottomRightRadius: 28,
    },
    instructionText: {
        color: "rgba(255, 255, 255, 0.85)",
        fontSize: 14,
        fontWeight: "500",
        marginTop: 24,
        textAlign: "center",
    },
    bottomControlBar: {
        position: "absolute",
        left: 0,
        right: 0,
        alignItems: "center",
    },
    testQrButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)",
    },
    testQrText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "600",
    },
});
