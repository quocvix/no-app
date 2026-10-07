---
name: vietqr-expense-ux
description: UI/UX design patterns, screen flows, components, and architectural standards for ultra-fast offline VietQR payment launchers and personal expense trackers (React Native / Android).
---

# VietQR Offline Expense Tracker UX & UI Standard

This skill encapsulates the battle-tested design patterns, screen flows, and component blueprints for personal finance apps built around the **"Quét là ghi" (Scan & Record)** workflow in Vietnam.

---

## 1. Core Principles

1. **"Quét là ghi" (Scan & Record) in < 2 Seconds:**
   - The logging flow must never impede or slow down checkout payment at a physical counter.
   - Flow: Scan VietQR -> Check expense / quick edit -> Handoff to Bank App -> Return to updated Home Dashboard.
2. **100% Offline & Private ("Sổ ghi trong máy - Không đẩy lên mây"):**
   - No login, no cloud dependency, no accounts required.
   - All data stays locally in device storage via SQLite and MMKV.
3. **Clean Light Minimalist Aesthetic:**
   - Soft off-white / light slate canvas (`#F8F9FA` or `#FFFFFF`).
   - Deep tactile black CTA elements (`#111111` or `#1E293B`).
   - Warm terracotta / orange accent (`#F97316` or `#EA580C`) for active highlights and titles.
   - Generous border radiuses (`rounded-2xl` 16px, `rounded-3xl` 24px) with subtle card borders (`border-slate-100` / `border-black/5`).
   - Monospace / Tabular Figures typography for monetary amounts to prevent layout shifts.

---

## 2. Information Architecture & Navigation

The navigation is centered around a **Floating Pill Bottom Navigation Bar** with a prominent, elevated circular **QR Scanner** button in the center:

- **Tab 1: Trang chủ (Dashboard / Home):**
  - **Budget Summary Widget:** Monthly remaining budget, % spent progress bar, quick stats ("Hôm nay", "Tháng này"), and a privacy toggle to hide/reveal balance.
  - **Quick Action Row:** Primary high-contrast button `[ ⬛ Quét QR thanh toán ]` and secondary ghost button `[ + Ghi thủ công ]`.
  - **Recent Transactions (`Gần đây`):** 3-5 latest transactions with direct link to History.
- **Tab 2: Lịch sử (History / Ledger):**
  - Full-text search bar: recipient, note, bank, amount.
  - Filter chips: `Tất cả` | `Khoản chi` (-đ) | `Thu nhập` (+đ).
  - Transactions grouped by relative time headers: "Hôm nay", "2 ngày trước", "Tuần trước".
- **Center Floating Button: Quét QR (Quick Scan):**
  - Instant camera activation with custom Reticle overlay and torch toggle.
- **Tab 3: Báo cáo (Reports & Analytics):**
  - Period selector: `Tuần` | `Tháng`.
  - Period navigation: `< Tháng này >`.
  - Total expense & income summary cards.
  - Minimalist Bar Chart (Skia / Victory Native) showing expenditure per week/day.
- **Tab 4: Cài đặt (Settings):**
  - Default payment source bank selector (BIDV, VCB, MB, TCB, etc.).
  - Monthly budget limit configuration.
  - Categories management.
  - Offline Export / Backup (CSV / JSON via Android Share Sheet).

---

## 3. The 3-Step Payment & Recording Flow

### Step 1: Scan QR or Tap "Ghi thủ công"
- Uses React Native VisionCamera with built-in Code Scanner.
- Immediately parses VietQR TLV (Tag-Length-Value):
  - **Tag 26 / Tag 38:** Beneficiary Bank BIN / Napas code + Account Number.
  - **Tag 54:** Transaction Amount (if dynamic QR).
  - **Tag 62:** Additional transaction reference / note.

### Step 2: "Kiểm tra khoản chi" (Check Expense Screen)
- Displays recipient details: `Người nhận: [Bank Code] · [Account Number]`.
- Huge currency display with animated cursor: `200.000|đ`.
- Interactive category picker: `Danh mục: Ăn uống >`.
- Optional memo field: `Ghi chú: Thêm ghi chú`.
- **Integrated Custom In-App Numpad:**
  - Layout: `1 2 3`, `4 5 6`, `7 8 9`, `0 000 [Backspace]`.
  - Key `000` is essential for rapid entry of Vietnamese Dong denominations.
  - Bottom bar with Bank selector pill `[BIDV v]` and CTA `[ Chuyển khoản ]`.

### Step 3: "Bank mở sẵn tiền" (Bottom Sheet Handoff)
- Activated on pressing "Chuyển khoản".
- Uses `@gorhom/bottom-sheet` displaying:
  - Bank icon + `Mở [Tên Bank] - [Tên Bank] sẽ điền sẵn thông tin`.
  - Highlighted amount: `200.000đ`.
  - Primary button: `[ Mở [Bank] để chuyển ]`.
- Actions on trigger:
  1. Writes transaction asynchronously to local SQLite.
  2. Updates instant cache in MMKV.
  3. Copies account/payload to clipboard.
  4. Triggers Android Intent Package / Deep Link to open the selected banking app.

---

## 4. Design System Tokens (Tailwind / NativeWind)

```typescript
// src/theme/tokens.ts
export const themeColors = {
  canvas: '#F8F9FA',
  card: '#FFFFFF',
  cardBorder: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  ctaPrimary: '#111827',
  ctaText: '#FFFFFF',
  accentOrange: '#F97316',
  incomeGreen: '#16A34A',
  expenseRed: '#DC2626',
};

export const typographyTokens = {
  currency: {
    fontVariant: ['tabular-nums'] as const,
    fontWeight: '700' as const,
    letterSpacing: -1,
  },
};
```

---

## 5. Reusable Component Patterns

### Custom In-App Numpad with `000` Key
```tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Delete } from 'lucide-react-native';

interface NumpadProps {
  onPressDigit: (digit: string) => void;
  onPressBackspace: () => void;
}

export const CustomNumpad: React.FC<NumpadProps> = ({ onPressDigit, onPressBackspace }) => {
  const handlePress = (val: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPressDigit(val);
  };

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['0', '000', 'backspace'],
  ];

  return (
    <View className="w-full px-6 py-4">
      {keys.map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row justify-between mb-4">
          {row.map((key) => {
            if (key === 'backspace') {
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onPressBackspace();
                  }}
                  className="w-24 h-14 items-center justify-center rounded-2xl active:bg-slate-100"
                >
                  <Delete size={26} color="#0F172A" />
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                key={key}
                onPress={() => handlePress(key)}
                className="w-24 h-14 items-center justify-center rounded-2xl active:bg-slate-100"
              >
                <Text className="text-2xl font-semibold text-slate-900">{key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};
```

### VietQR-to-Banking Deep Link Launcher
```typescript
import * as Linking from 'expo-linking';

export interface BankConfig {
  code: string;
  name: string;
  scheme: string;
  packageName: string;
}

export const BANK_DICTIONARY: Record<string, BankConfig> = {
  BIDV: {
    code: 'BIDV',
    name: 'BIDV SmartBanking',
    scheme: 'bidvsmartbanking://',
    packageName: 'com.vnpay.bidv',
  },
  TCB: {
    code: 'TCB',
    name: 'Techcombank Mobile',
    scheme: 'tcb://',
    packageName: 'vn.com.techcombank.bb.app',
  },
  MB: {
    code: 'MB',
    name: 'MB Bank',
    scheme: 'mbbank://',
    packageName: 'com.mbmobile',
  },
  VCB: {
    code: 'VCB',
    name: 'Vietcombank Digibank',
    scheme: 'vcbdigibank://',
    packageName: 'com.VCB',
  },
  VTB: {
    code: 'VTB',
    name: 'VietinBank iPay',
    scheme: 'vietinbankipay://',
    packageName: 'com.vietinbank.ipay',
  },
};

export const launchBankingApp = async (bankCode: string, payload?: string) => {
  const bank = BANK_DICTIONARY[bankCode];
  if (!bank) return false;

  try {
    const supported = await Linking.canOpenURL(bank.scheme);
    if (supported) {
      await Linking.openURL(bank.scheme);
      return true;
    }
  } catch (e) {
    console.warn('Cannot open bank via scheme, falling back to package intent', e);
  }
  return false;
};
```

---

## 6. Official Expo Ecosystem Standard (Auto-Resolution via Expo CLI)
- **Core Runtime:** React Native + Expo (Latest version generated via `npx create-expo-app@latest`, New Architecture Fabric enabled).
- **Package Installation Rule:** Always use `npx expo install <package>` without pinned version tags to allow Expo CLI to auto-resolve matching peer dependencies.
- **Camera Scanning:** `expo-camera` (`CameraView` with built-in `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}`).
- **Local Storage:** `expo-sqlite` (Synchronous Next-Gen API `openDatabaseSync`, `execSync`, `getAllSync`) + `react-native-mmkv`.
- **Sensory & System:** `expo-haptics`, `expo-clipboard`, `expo-linking`, `expo-sharing`, `expo-file-system`.
- **UI & Graphics:** NativeWind v4, Reanimated v3, `@gorhom/bottom-sheet`, `@shopify/react-native-skia`, `victory-native`, `lucide-react-native`.
- **AI Coding Standard:** Optimized for Google Antigravity (AGY) and Gemini assistants.
