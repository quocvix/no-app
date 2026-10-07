// src/services/qrImageShareService.ts
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';

export interface QrShareParams {
  bankBin: string;
  accountNo: string;
  amount: number;
  memo?: string;
  packageName?: string;
}

/**
 * Tải ảnh QR động VietQR (kèm số tiền và nội dung) về bộ nhớ tạm của thiết bị
 */
export async function downloadQrImage(params: QrShareParams): Promise<string | null> {
  const { bankBin, accountNo, amount, memo } = params;
  const cleanMemo = encodeURIComponent(
    (memo || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .trim()
  );

  const roundedAmount = Math.round(amount);
  const imageUrl = `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact2.png?amount=${roundedAmount}&addInfo=${cleanMemo}`;
  const localTarget = `${FileSystem.cacheDirectory}vietqr_transfer_${Date.now()}.png`;

  try {
    const downloadRes = await FileSystem.downloadAsync(imageUrl, localTarget);
    if (downloadRes.status === 200) {
      return downloadRes.uri;
    }
  } catch (err) {
    console.warn('Lỗi khi tải ảnh QR VietQR:', err);
  }
  return null;
}

/**
 * Chia sẻ trực tiếp ảnh QR vào ứng dụng ngân hàng qua Android Intent (ACTION_SEND)
 */
export async function shareQrImageToBank(params: QrShareParams): Promise<boolean> {
  const localImageUri = await downloadQrImage(params);
  if (!localImageUri) return false;

  const targetPackage = params.packageName || 'com.mbmobile';

  if (Platform.OS === 'android') {
    try {
      // 1. Chuyển đổi sang Content URI (chuẩn FileProvider để các app khác có quyền đọc)
      const contentUri = await FileSystem.getContentUriAsync(localImageUri);

      // 2. Bắn Intent ACTION_SEND trực tiếp đến app ngân hàng
      await IntentLauncher.startActivityAsync('android.intent.action.SEND', {
        type: 'image/png',
        packageName: targetPackage,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        extra: {
          'android.intent.extra.STREAM': contentUri,
        },
      });
      return true;
    } catch (err) {
      console.warn('Không thể gửi Intent trực tiếp đến package, chuyển sang Sharing dialog:', err);
    }
  }

  // Fallback: Mở Android/iOS Share Sheet cho người dùng chọn app ngân hàng
  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(localImageUri, {
        mimeType: 'image/png',
        dialogTitle: 'Chia sẻ mã QR sang ngân hàng',
      });
      return true;
    }
  } catch (err) {
    console.warn('Lỗi Sharing fallback:', err);
  }

  return false;
}
