// src/services/vietqrParser.ts
import { getBankByBin, BankMeta } from '../constants/banks';

export interface VietQRData {
  isValid: boolean;
  isDynamic: boolean;
  bankBin?: string;
  bankMeta?: BankMeta;
  bankCode?: string;
  accountNumber?: string;
  amount?: number;
  memo?: string;
  rawPayload: string;
}

export function parseTLV(raw: string): Map<string, string> {
  const result = new Map<string, string>();
  let cursor = 0;
  while (cursor < raw.length) {
    if (cursor + 4 > raw.length) break;
    const tag = raw.substring(cursor, cursor + 2);
    const length = parseInt(raw.substring(cursor + 2, cursor + 4), 10);
    cursor += 4;
    if (isNaN(length) || cursor + length > raw.length) break;
    const value = raw.substring(cursor, cursor + length);
    cursor += length;
    result.set(tag, value);
  }
  return result;
}

export function decodeVietQR(qrPayload: string): VietQRData {
  const tlv = parseTLV(qrPayload);
  const result: VietQRData = {
    isValid: false,
    isDynamic: false,
    rawPayload: qrPayload,
  };

  // EMVCo check: Tag 00 format indicator and Tag 58 country code
  if (!tlv.has('00') && !tlv.has('58')) {
    // Fallback if raw text has bank/account info or URL format
    return result;
  }

  result.isValid = true;
  result.isDynamic = tlv.get('01') === '12';

  // Tag 54: Transaction Amount
  if (tlv.has('54')) {
    const parsedAmount = parseFloat(tlv.get('54') || '0');
    if (!isNaN(parsedAmount) && parsedAmount > 0) {
      result.amount = parsedAmount;
    }
  }

  // Tag 26 or Tag 38: Napas / VietQR merchant info
  const merchantInfo = tlv.get('38') || tlv.get('26');
  if (merchantInfo) {
    const subTlv = parseTLV(merchantInfo);
    const sub01 = subTlv.get('01');
    if (sub01) {
      const bankTlv = parseTLV(sub01);
      result.bankBin = bankTlv.get('00');
      result.accountNumber = bankTlv.get('01');
    }
  }

  // Tag 62: Additional Data Field (Memo / Purpose)
  const additionalData = tlv.get('62');
  if (additionalData) {
    const addTlv = parseTLV(additionalData);
    result.memo = addTlv.get('08');
  }

  if (result.bankBin) {
    result.bankMeta = getBankByBin(result.bankBin);
    if (result.bankMeta) {
      result.bankCode = result.bankMeta.code;
    }
  }

  return result;
}
