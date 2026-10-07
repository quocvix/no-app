// src/services/backupService.ts
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { storage } from '../storage/mmkv';
import {
  getAllDatabaseData,
  restoreDatabaseData,
  FullDatabaseBackup,
} from '../storage/sqlite';

export interface ExportResult {
  success: boolean;
  savedToDownloads?: boolean;
  fileName?: string;
  error?: string;
}

/**
 * Đọc nội dung file text/JSON an toàn từ bất kỳ URI nào (file:// hoặc content://)
 * Sử dụng nhiều tầng đọc dữ liệu để tương thích tối đa với mọi máy Android:
 * 1. FileSystem.readAsStringAsync (nhanh nhất với file:// và cache)
 * 2. fetch + blob + FileReader (React Native native content resolver cho content://)
 * 3. Modern File API của expo-file-system nếu có
 */
async function readBackupFileContent(uri: string): Promise<string> {
  let content = '';

  // Tầng 1: Thử đọc trực tiếp qua FileSystem (rất nhanh với file:// và cache)
  try {
    content = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (content && content.trim().length > 0) {
      return content;
    }
  } catch (fsErr) {
    console.log('FileSystem.readAsStringAsync không đọc được URI này, chuyển tầng 2:', fsErr);
  }

  // Tầng 2: Thử đọc qua Modern File API của expo-file-system (native streaming, không dùng RN blob)
  try {
    const { File: ModernFile } = require('expo-file-system');
    if (ModernFile) {
      const modernFile = new ModernFile(uri);
      content = await modernFile.text();
      if (content && content.trim().length > 0) {
        return content;
      }
    }
  } catch (modernErr) {
    console.log('Modern File API không đọc được URI này, chuyển tầng 3:', modernErr);
  }

  // Tầng 3: Thử đọc qua React Native fetch + blob + FileReader (hỗ trợ mọi content:// và file://)
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = () => reject(new Error('FileReader không đọc được blob'));
      reader.readAsText(blob);
    });
    if (content && content.trim().length > 0) {
      return content;
    }
  } catch (fetchErr) {
    console.log('fetch/blob FileReader không đọc được URI này:', fetchErr);
  }


  if (!content || content.trim().length === 0) {
    throw new Error('Nội dung file sao lưu rỗng hoặc thiết bị không cấp quyền đọc.');
  }

  return content;
}

/**
 * Xuất toàn bộ cơ sở dữ liệu ra file JSON
 * Trên Android: Tải và lưu trực tiếp vào thư mục được người dùng chọn (Download/Tài liệu)
 * Fallback / iOS: Mở hộp thoại chia sẻ để lưu vào Tệp/Drive
 */
export async function exportDatabaseToJson(): Promise<ExportResult> {
  try {
    const backupData = getAllDatabaseData();
    const jsonString = JSON.stringify(backupData, null, 2);

    const now = new Date();
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '_',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('');

    const fileName = `no_app_backup_${dateStr}.json`;
    const baseNameWithoutExt = `no_app_backup_${dateStr}`;

    // 1. Luôn tạo sẵn một bản sao lưu cục bộ để đảm bảo an toàn và làm nguồn chia sẻ
    const localFileUri = `${FileSystem.documentDirectory || ''}${fileName}`;
    await FileSystem.writeAsStringAsync(localFileUri, jsonString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // 2. Trên Android: Thử lưu trực tiếp vào thư mục được chọn qua StorageAccessFramework
    if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
      const { StorageAccessFramework } = FileSystem;
      let dirUri = storage.getString('settings.backup_directory_uri');

      // Nếu chưa có quyền truy cập thư mục, mở trình chọn thư mục
      if (!dirUri) {
        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          dirUri = permissions.directoryUri;
          storage.setString('settings.backup_directory_uri', dirUri);
        }
      }

      if (dirUri) {
        try {
          const newFileUri = await StorageAccessFramework.createFileAsync(
            dirUri,
            baseNameWithoutExt,
            'application/json'
          );
          await FileSystem.writeAsStringAsync(newFileUri, jsonString, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          return {
            success: true,
            savedToDownloads: true,
            fileName,
          };
        } catch (safErr) {
          console.warn('Lỗi ghi vào cached dirUri, yêu cầu chọn lại:', safErr);
          storage.delete('settings.backup_directory_uri');
          try {
            const retryPerm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (retryPerm.granted) {
              storage.setString('settings.backup_directory_uri', retryPerm.directoryUri);
              const newFileUri = await StorageAccessFramework.createFileAsync(
                retryPerm.directoryUri,
                baseNameWithoutExt,
                'application/json'
              );
              await FileSystem.writeAsStringAsync(newFileUri, jsonString, {
                encoding: FileSystem.EncodingType.UTF8,
              });
              return {
                success: true,
                savedToDownloads: true,
                fileName,
              };
            }
          } catch (retryErr) {
            console.warn('Không thể ghi qua SAF, sẽ chuyển sang chia sẻ file:', retryErr);
          }
        }
      }
    }

    // 3. Fallback (trên iOS hoặc khi người dùng không dùng SAF): Mở bảng chia sẻ
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(localFileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Lưu hoặc chia sẻ file sao lưu Nợ (JSON)',
        UTI: 'public.json',
      });
      return {
        success: true,
        savedToDownloads: false,
        fileName,
      };
    }

    return {
      success: true,
      savedToDownloads: false,
      fileName,
    };
  } catch (error: any) {
    console.error('Lỗi khi xuất file sao lưu JSON:', error);
    return {
      success: false,
      error: error?.message || 'Có lỗi xảy ra khi tạo file sao lưu.',
    };
  }
}

/**
 * Mở bộ chọn file để người dùng chọn file backup JSON và kiểm tra tính hợp lệ
 */
export async function pickAndValidateBackupFile(): Promise<{
  success: boolean;
  data?: FullDatabaseBackup;
  error?: string;
}> {
  try {
    const pickResult = await DocumentPicker.getDocumentAsync({
      type: ['*/*', 'application/json', 'text/*'],
      copyToCacheDirectory: true,
    });

    if (pickResult.canceled || !pickResult.assets || pickResult.assets.length === 0) {
      return { success: false };
    }

    const asset = pickResult.assets[0];
    const rawContent = await readBackupFileContent(asset.uri);
    
    // Loại bỏ UTF-8 BOM nếu có và cắt khoảng trắng đầu/cuối
    const sanitized = rawContent.replace(/^\uFEFF/, '').trim();
    if (!sanitized) {
      return {
        success: false,
        error: 'File sao lưu đã chọn có nội dung trống (0 bytes).',
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(sanitized);
    } catch (parseErr: any) {
      return {
        success: false,
        error: `File được chọn không phải là định dạng JSON hợp lệ: ${parseErr?.message || ''}`,
      };
    }

    // Kiểm tra cấu trúc bản sao lưu
    const hasTransactions = Array.isArray(parsed?.transactions);
    const hasDebts = Array.isArray(parsed?.debts);
    const hasCategories = Array.isArray(parsed?.categories);

    if (!parsed || typeof parsed !== 'object' || (!hasTransactions && !hasDebts && !hasCategories)) {
      return {
        success: false,
        error: 'Nội dung file không đúng cấu trúc bản sao lưu của ứng dụng Nợ.',
      };
    }

    // Đảm bảo các mảng luôn tồn tại nếu bản sao lưu từ các phiên bản cũ hơn
    parsed.categories = parsed.categories || [];
    parsed.transactions = parsed.transactions || [];
    parsed.debts = parsed.debts || [];
    parsed.debt_payments = parsed.debt_payments || [];

    return {
      success: true,
      data: parsed as FullDatabaseBackup,
    };
  } catch (err: any) {
    console.error('Lỗi khi đọc file sao lưu:', err);
    return {
      success: false,
      error: err?.message || 'Không thể đọc nội dung file đã chọn.',
    };
  }
}

/**
 * Nạp dữ liệu sao lưu vào cơ sở dữ liệu
 */
export function applyRestore(
  backup: FullDatabaseBackup,
  mode: 'replace' | 'merge' = 'replace'
): boolean {
  try {
    restoreDatabaseData(backup, mode);
    return true;
  } catch (err) {
    console.error('Lỗi khi khôi phục dữ liệu:', err);
    return false;
  }
}
