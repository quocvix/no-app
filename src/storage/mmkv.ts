// src/storage/mmkv.ts
// Dual-engine architecture:
// 1. Native MMKV C++ TurboModule on Prebuild / Standalone APK / EAS Builds
// 2. Synchronous in-memory cache backed by Expo SQLite on Expo Go (prevents NitroModules crash)
import * as SQLite from 'expo-sqlite';

let nativeMMKV: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createMMKV } = require('react-native-mmkv');
  nativeMMKV = createMMKV({ id: 'offline-qr-tracker-storage' });
} catch {
  // Gracefully caught when NitroModules is not bundled (e.g. Expo Go runtime)
  nativeMMKV = null;
}

let kvDb: SQLite.SQLiteDatabase | null = null;
function getKvDatabase(): SQLite.SQLiteDatabase | null {
  try {
    if (!kvDb) {
      kvDb = SQLite.openDatabaseSync('transactions.db');
      kvDb.execSync(`
        CREATE TABLE IF NOT EXISTS kv_cache (
          key TEXT PRIMARY KEY,
          val TEXT NOT NULL
        );
      `);
    }
    return kvDb;
  } catch {
    return null;
  }
}

export const STORAGE_KEYS = {
  MONTHLY_BUDGET: 'settings.monthly_budget',
  DEFAULT_SOURCE_BANK: 'settings.default_source_bank',
  IS_BALANCE_HIDDEN: 'settings.is_balance_hidden',
  IS_DARK_MODE: 'settings.is_dark_mode',
  // Instant Dashboard Cache
  CACHE_REMAINING_BUDGET: 'cache.remaining_budget',
  CACHE_SPENT_PERCENT: 'cache.spent_percent',
  CACHE_SPENT_TODAY: 'cache.spent_today',
  CACHE_SPENT_MONTH: 'cache.spent_month',
  CACHE_TOTAL_INCOME_MONTH: 'cache.total_income_month',
};

// In-memory cache map for synchronous 0ms read/write
const memoryCache = new Map<string, any>();

// Seed default baseline values (Clean state)
memoryCache.set(STORAGE_KEYS.CACHE_REMAINING_BUDGET, 0);
memoryCache.set(STORAGE_KEYS.CACHE_SPENT_PERCENT, 0);
memoryCache.set(STORAGE_KEYS.CACHE_SPENT_TODAY, 0);
memoryCache.set(STORAGE_KEYS.CACHE_SPENT_MONTH, 0);
memoryCache.set(STORAGE_KEYS.CACHE_TOTAL_INCOME_MONTH, 0);
memoryCache.set(STORAGE_KEYS.IS_BALANCE_HIDDEN, false);
memoryCache.set(STORAGE_KEYS.IS_DARK_MODE, false);
memoryCache.set(STORAGE_KEYS.DEFAULT_SOURCE_BANK, 'BIDV');
memoryCache.set(STORAGE_KEYS.MONTHLY_BUDGET, 0);

// Preload persisted values from SQLite
try {
  const db = getKvDatabase();
  if (db) {
    const rows: any[] = db.getAllSync(`SELECT key, val FROM kv_cache;`);
    for (const r of rows) {
      if (r.val === 'true') {
        memoryCache.set(r.key, true);
      } else if (r.val === 'false') {
        memoryCache.set(r.key, false);
      } else if (!isNaN(Number(r.val)) && r.val.trim() !== '') {
        memoryCache.set(r.key, Number(r.val));
      } else {
        memoryCache.set(r.key, r.val);
      }
    }
  }
} catch (e) {
  console.warn('KV cache preload notice:', e);
}

export const storage = {
  getNumber: (key: string): number | undefined => {
    try {
      if (nativeMMKV) {
        const val = nativeMMKV.getNumber(key);
        if (typeof val === 'number') return val;
      }
    } catch {}
    const mem = memoryCache.get(key);
    return typeof mem === 'number' ? mem : undefined;
  },

  setNumber: (key: string, val: number): void => {
    memoryCache.set(key, val);
    try {
      if (nativeMMKV) nativeMMKV.set(key, val);
    } catch {}
    try {
      const db = getKvDatabase();
      db?.runSync(`INSERT OR REPLACE INTO kv_cache (key, val) VALUES (?, ?);`, [key, String(val)]);
    } catch {}
  },

  getBoolean: (key: string): boolean | undefined => {
    try {
      if (nativeMMKV) {
        const val = nativeMMKV.getBoolean(key);
        if (typeof val === 'boolean') return val;
      }
    } catch {}
    const mem = memoryCache.get(key);
    return typeof mem === 'boolean' ? mem : undefined;
  },

  setBoolean: (key: string, val: boolean): void => {
    memoryCache.set(key, val);
    try {
      if (nativeMMKV) nativeMMKV.set(key, val);
    } catch {}
    try {
      const db = getKvDatabase();
      db?.runSync(`INSERT OR REPLACE INTO kv_cache (key, val) VALUES (?, ?);`, [key, String(val)]);
    } catch {}
  },

  getString: (key: string): string | undefined => {
    try {
      if (nativeMMKV) {
        const val = nativeMMKV.getString(key);
        if (typeof val === 'string') return val;
      }
    } catch {}
    const mem = memoryCache.get(key);
    return typeof mem === 'string' ? mem : undefined;
  },

  setString: (key: string, val: string): void => {
    memoryCache.set(key, val);
    try {
      if (nativeMMKV) nativeMMKV.set(key, val);
    } catch {}
    try {
      const db = getKvDatabase();
      db?.runSync(`INSERT OR REPLACE INTO kv_cache (key, val) VALUES (?, ?);`, [key, val]);
    } catch {}
  },

  delete: (key: string): void => {
    memoryCache.delete(key);
    try {
      if (nativeMMKV) nativeMMKV.delete(key);
    } catch {}
    try {
      const db = getKvDatabase();
      db?.runSync(`DELETE FROM kv_cache WHERE key = ?;`, [key]);
    } catch {}
  },
};

export const getCachedDashboardData = () => ({
  remainingBudget: storage.getNumber(STORAGE_KEYS.CACHE_REMAINING_BUDGET) ?? 0,
  spentPercent: storage.getNumber(STORAGE_KEYS.CACHE_SPENT_PERCENT) ?? 0,
  spentToday: storage.getNumber(STORAGE_KEYS.CACHE_SPENT_TODAY) ?? 0,
  spentMonth: storage.getNumber(STORAGE_KEYS.CACHE_SPENT_MONTH) ?? 0,
  totalIncomeMonth: storage.getNumber(STORAGE_KEYS.CACHE_TOTAL_INCOME_MONTH) ?? 0,
  isBalanceHidden: storage.getBoolean(STORAGE_KEYS.IS_BALANCE_HIDDEN) ?? false,
  isDarkMode: storage.getBoolean(STORAGE_KEYS.IS_DARK_MODE) ?? false,
  defaultBank: storage.getString(STORAGE_KEYS.DEFAULT_SOURCE_BANK) ?? 'BIDV',
  monthlyBudget: storage.getNumber(STORAGE_KEYS.MONTHLY_BUDGET) ?? 0,
});

export const updateDashboardCache = (data: {
  remainingBudget?: number;
  spentPercent?: number;
  spentToday?: number;
  spentMonth?: number;
  totalIncomeMonth?: number;
  isBalanceHidden?: boolean;
  defaultBank?: string;
  monthlyBudget?: number;
}) => {
  if (data.remainingBudget !== undefined) storage.setNumber(STORAGE_KEYS.CACHE_REMAINING_BUDGET, data.remainingBudget);
  if (data.spentPercent !== undefined) storage.setNumber(STORAGE_KEYS.CACHE_SPENT_PERCENT, data.spentPercent);
  if (data.spentToday !== undefined) storage.setNumber(STORAGE_KEYS.CACHE_SPENT_TODAY, data.spentToday);
  if (data.spentMonth !== undefined) storage.setNumber(STORAGE_KEYS.CACHE_SPENT_MONTH, data.spentMonth);
  if (data.totalIncomeMonth !== undefined) storage.setNumber(STORAGE_KEYS.CACHE_TOTAL_INCOME_MONTH, data.totalIncomeMonth);
  if (data.isBalanceHidden !== undefined) storage.setBoolean(STORAGE_KEYS.IS_BALANCE_HIDDEN, data.isBalanceHidden);
  if (data.defaultBank !== undefined) storage.setString(STORAGE_KEYS.DEFAULT_SOURCE_BANK, data.defaultBank);
  if (data.monthlyBudget !== undefined) storage.setNumber(STORAGE_KEYS.MONTHLY_BUDGET, data.monthlyBudget);
};
