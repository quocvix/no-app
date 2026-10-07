import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

export interface BankMeta {
  code: string;
  name: string;
  shortName: string;
  bin: string;
  scheme: string;
  packageName: string;
  vietQrEndpointPrefix?: string;
}

export const SUPPORTED_BANKS: Record<string, BankMeta> = {
  BIDV: {
    code: 'BIDV',
    name: 'Ngân hàng TMCP Đầu tư và Phát triển VN',
    shortName: 'BIDV',
    bin: '970418',
    scheme: 'bidvsmartbanking://',
    packageName: 'com.vnpay.bidv',
    vietQrEndpointPrefix: 'bidvsmartbanking://vietqr?data=',
  },
  TCB: {
    code: 'TCB',
    name: 'Ngân hàng Kỹ thương Việt Nam',
    shortName: 'Techcombank',
    bin: '970407',
    scheme: 'tcb://',
    packageName: 'vn.com.techcombank.bb.app',
    vietQrEndpointPrefix: 'tcb://qr?data=',
  },
  MB: {
    code: 'MB',
    name: 'Ngân hàng Quân đội',
    shortName: 'MB Bank',
    bin: '970422',
    scheme: 'mbmobile://',
    packageName: 'com.mbmobile',
    vietQrEndpointPrefix: 'mbmobile://vietqr?data=',
  },
  VCB: {
    code: 'VCB',
    name: 'Ngân hàng Ngoại thương Việt Nam',
    shortName: 'Vietcombank',
    bin: '970436',
    scheme: 'vcbdigibank://',
    packageName: 'com.VCB',
    vietQrEndpointPrefix: 'vcb://qr?data=',
  },
  CTG: {
    code: 'CTG',
    name: 'Ngân hàng Công thương Việt Nam',
    shortName: 'VietinBank',
    bin: '970415',
    scheme: 'vietinbankipay://',
    packageName: 'com.vietinbank.ipay',
    vietQrEndpointPrefix: 'vietinbankipay://vietqr?data=',
  },
  VPB: {
    code: 'VPB',
    name: 'Ngân hàng Việt Nam Thịnh Vượng',
    shortName: 'VPBank',
    bin: '970432',
    scheme: 'vpbankneo://',
    packageName: 'com.vnpay.vpbankonline',
    vietQrEndpointPrefix: 'vpbank://qr?data=',
  },
  TPB: {
    code: 'TPB',
    name: 'Ngân hàng Tiên Phong',
    shortName: 'TPBank',
    bin: '970423',
    scheme: 'tpbankmobile://',
    packageName: 'com.tpb.mb.gprsandroid',
    vietQrEndpointPrefix: 'tpbank://vietqr?data=',
  },
  ACB: {
    code: 'ACB',
    name: 'Ngân hàng Á Châu',
    shortName: 'ACB',
    bin: '970416',
    scheme: 'acbone://',
    packageName: 'mobile.acb.com.vn',
    vietQrEndpointPrefix: 'acbone://qr?data=',
  },
  MOMO: {
    code: 'MOMO',
    name: 'Ví MoMo',
    shortName: 'MoMo',
    bin: '970470',
    scheme: 'momo://',
    packageName: 'com.mservice.momotransfer',
  },
  CASH: {
    code: 'CASH',
    name: 'Tiền mặt',
    shortName: 'Tiền mặt',
    bin: '',
    scheme: '',
    packageName: '',
  },
};

export function getBankByBin(bin?: string): BankMeta | undefined {
  if (!bin) return undefined;
  return Object.values(SUPPORTED_BANKS).find((b) => b.bin === bin);
}

export function getBankByCode(code?: string): BankMeta {
  if (!code) return SUPPORTED_BANKS.BIDV;
  return SUPPORTED_BANKS[code] || SUPPORTED_BANKS.BIDV;
}

export const launchBankingApp = async (
  bankCode: string,
  rawQrCode?: string
): Promise<boolean> => {
  const bank = getBankByCode(bankCode);
  if (!bank || bank.code === 'CASH') return false;

  // 1. Nếu có chuỗi EMVCo raw VietQR: Thử kích hoạt App-to-App chuyển khoản tự động
  if (rawQrCode && rawQrCode.trim()) {
    const encodedPayload = encodeURIComponent(rawQrCode.trim());
    const qrCandidates: string[] = [];

    if (bank.code === 'MB') {
      qrCandidates.push(`mbmobile://vietqr?data=${encodedPayload}`);
      qrCandidates.push(`mbmobile://qr?data=${encodedPayload}`);
      qrCandidates.push(`mbbank://vietqr?data=${encodedPayload}`);
      qrCandidates.push(`mbbank://qr?data=${encodedPayload}`);
      if (Platform.OS === 'android') {
        qrCandidates.push(
          `intent://vietqr?data=${encodedPayload}#Intent;scheme=mbmobile;package=com.mbmobile;end`,
          `intent://qr?data=${encodedPayload}#Intent;scheme=mbmobile;package=com.mbmobile;end`,
          `intent://vietqr?data=${encodedPayload}#Intent;scheme=mbbank;package=com.mbmobile;end`
        );
      }
    } else if (bank.code === 'VCB') {
      qrCandidates.push(`vcb://qr?data=${encodedPayload}`);
      qrCandidates.push(`vcbdigibank://qr?data=${encodedPayload}`);
      if (Platform.OS === 'android') {
        qrCandidates.push(
          `intent://qr?data=${encodedPayload}#Intent;scheme=vcb;package=com.VCB;end`
        );
      }
    } else if (bank.code === 'TCB') {
      qrCandidates.push(`tcb://qr?data=${encodedPayload}`);
      if (Platform.OS === 'android') {
        qrCandidates.push(
          `intent://qr?data=${encodedPayload}#Intent;scheme=tcb;package=vn.com.techcombank.bb.app;end`
        );
      }
    } else if (bank.code === 'BIDV') {
      qrCandidates.push(`bidvsmartbanking://vietqr?data=${encodedPayload}`);
      if (Platform.OS === 'android') {
        qrCandidates.push(
          `intent://vietqr?data=${encodedPayload}#Intent;scheme=bidvsmartbanking;package=com.vnpay.bidv;end`
        );
      }
    } else if (bank.vietQrEndpointPrefix) {
      qrCandidates.push(`${bank.vietQrEndpointPrefix}${encodedPayload}`);
    }

    for (const url of qrCandidates) {
      try {
        await Linking.openURL(url);
        return true;
      } catch {
        // Thử ứng viên tiếp theo
      }
    }
  }

  // 2. Fallback thông thường: Mở màn hình chính của ứng dụng ngân hàng
  const fallbackUrls: string[] = [];

  if (bank.scheme) {
    fallbackUrls.push(bank.scheme);
  }

  if (bank.code === 'MB') {
    fallbackUrls.push('mbbank://', 'mbmobile://');
  }

  if (Platform.OS === 'android' && bank.packageName) {
    fallbackUrls.push(
      `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${bank.packageName};end`,
      `intent://#Intent;package=${bank.packageName};end`
    );
  }

  for (const url of fallbackUrls) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // Tiếp tục thử
    }
  }

  // 3. Fallback cuối cùng: Mở Google Play Store hoặc App Store nếu chưa cài đặt
  if (Platform.OS === 'android' && bank.packageName) {
    try {
      await Linking.openURL(`market://details?id=${bank.packageName}`);
      return true;
    } catch {
      try {
        await Linking.openURL(`https://play.google.com/store/apps/details?id=${bank.packageName}`);
        return true;
      } catch {
        return false;
      }
    }
  } else if (Platform.OS === 'ios') {
    console.warn(`Cannot open bank app for ${bank.code} on iOS`);
  }

  return false;
};
