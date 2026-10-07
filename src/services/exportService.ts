// src/services/exportService.ts
import { getDb } from '../storage/sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export async function exportTransactionsToCSV(): Promise<boolean> {
  try {
    const db = getDb();
    const rows: any[] = db.getAllSync(`
      SELECT t.id, t.amount, t.type, c.name as category, t.source_bank_code,
             t.receiver_name, t.receiver_account, t.receiver_bank_code, t.note,
             datetime(t.created_at / 1000, 'unixepoch', 'localtime') as created_at_vn
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      ORDER BY t.created_at DESC;
    `);

    let csv = '\uFEFFID,SoTien,Loai,DanhMuc,NganHangNguon,NguoiNhan,STK,NganHangNhan,GhiChu,ThoiGian\n';
    rows.forEach((row: any) => {
      csv += `"${row.id}",${row.amount},"${row.type}","${row.category || ''}","${row.source_bank_code}","${row.receiver_name || ''}","${row.receiver_account || ''}","${row.receiver_bank_code || ''}","${row.note || ''}","${row.created_at_vn}"\n`;
    });

    const fileUri = `${FileSystem.documentDirectory || ''}so_thu_chi_${Date.now()}.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Sao lưu sổ thu chi cá nhân',
        UTI: 'public.comma-separated-values-text',
      });
      return true;
    }
  } catch (error) {
    console.error('Failed to export CSV with Expo Sharing:', error);
  }
  return false;
}
