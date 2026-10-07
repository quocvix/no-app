// src/storage/sqlite.ts
import * as SQLite from 'expo-sqlite';
import { updateDashboardCache, storage, STORAGE_KEYS } from './mmkv';

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: 'EXPENSE' | 'INCOME';
  sort_order: number;
  is_hidden?: number;
}

export interface Transaction {
  id: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  category_id: string;
  category_name?: string;
  category_icon?: string;
  source_bank_code: string;
  receiver_name?: string;
  receiver_account?: string;
  receiver_bank_code?: string;
  note?: string;
  raw_qr?: string;
  created_at: number;
  debt_id?: string | null;
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync('transactions.db');
  }
  return dbInstance;
}

export function initDatabase() {
  const db = getDb();
  db.execSync('PRAGMA foreign_keys = ON;');
  db.execSync('PRAGMA journal_mode = WAL;');

  // Bảng Categories
  db.execSync(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('EXPENSE', 'INCOME')),
      sort_order INTEGER DEFAULT 0
    );
  `);

  // Bảng Transactions
  db.execSync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('EXPENSE', 'INCOME')),
      category_id TEXT NOT NULL,
      source_bank_code TEXT NOT NULL,
      receiver_name TEXT,
      receiver_account TEXT,
      receiver_bank_code TEXT,
      note TEXT,
      raw_qr TEXT,
      created_at INTEGER NOT NULL,
      debt_id TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);

  // Migration: Kiểm tra và thêm cột debt_id nếu bảng đã tồn tại từ trước mà chưa có cột debt_id
  const cols: any[] = db.getAllSync(`PRAGMA table_info(transactions);`);
  if (!cols.some((c) => c.name === 'debt_id')) {
    db.execSync(`ALTER TABLE transactions ADD COLUMN debt_id TEXT;`);
  }

  // Migration: Kiểm tra và thêm cột is_hidden nếu bảng categories chưa có
  const catCols: any[] = db.getAllSync(`PRAGMA table_info(categories);`);
  if (!catCols.some((c) => c.name === 'is_hidden')) {
    db.execSync(`ALTER TABLE categories ADD COLUMN is_hidden INTEGER DEFAULT 0;`);
  }

  // B-Tree Indexes
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_trans_created ON transactions(created_at DESC);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_trans_type ON transactions(type);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_trans_cat ON transactions(category_id);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_trans_debt ON transactions(debt_id);`);

  // Seed danh mục nếu chưa có
  const catRows: any[] = db.getAllSync(`SELECT COUNT(*) as count FROM categories;`);
  if (catRows[0]?.count === 0) {
    db.execSync(`
      INSERT INTO categories (id, name, icon, type, sort_order) VALUES
      ('cat_food', 'Ăn uống', 'Utensils', 'EXPENSE', 1),
      ('cat_coffee', 'Cà phê', 'Coffee', 'EXPENSE', 2),
      ('cat_transport', 'Di chuyển', 'Bike', 'EXPENSE', 3),
      ('cat_living', 'Sinh hoạt', 'Home', 'EXPENSE', 4),
      ('cat_salary', 'Lương', 'Banknote', 'INCOME', 5),
      ('cat_other', 'Khác', 'MoreHorizontal', 'EXPENSE', 6);
    `);
  }

  // Luôn đảm bảo category 'cat_debt' tồn tại cho các giao dịch nợ liên kết
  db.execSync(`
    INSERT OR IGNORE INTO categories (id, name, icon, type, sort_order) VALUES
    ('cat_debt', 'Nợ', 'HandCoins', 'EXPENSE', 99);
  `);

  // Seed ban đầu hoàn tất, tính toán lại thống kê (0 nếu mới cài đặt)
  recalculateStats();
}

export function getCategories(opts?: {
  includeHidden?: boolean;
  type?: 'EXPENSE' | 'INCOME';
  includeDebt?: boolean;
}): Category[] {
  const db = getDb();
  let query = `SELECT * FROM categories WHERE 1=1`;
  const params: any[] = [];

  if (!opts?.includeDebt) {
    query += ` AND id != 'cat_debt'`;
  }

  if (!opts?.includeHidden) {
    query += ` AND (is_hidden IS NULL OR is_hidden = 0)`;
  }

  if (opts?.type) {
    query += ` AND type = ?`;
    params.push(opts.type);
  }

  query += ` ORDER BY sort_order ASC, name ASC;`;
  return db.getAllSync(query, params);
}

export function createCategory(input: {
  name: string;
  icon: string;
  type: 'EXPENSE' | 'INCOME';
}): Category {
  const db = getDb();
  const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const maxRow: any[] = db.getAllSync(
    `SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM categories WHERE type = ?;`,
    [input.type]
  );
  const nextSort = (maxRow[0]?.max_sort ?? 0) + 1;

  db.runSync(
    `INSERT INTO categories (id, name, icon, type, sort_order, is_hidden)
     VALUES (?, ?, ?, ?, ?, 0);`,
    [id, input.name.trim(), input.icon, input.type, nextSort]
  );

  return {
    id,
    name: input.name.trim(),
    icon: input.icon,
    type: input.type,
    sort_order: nextSort,
    is_hidden: 0,
  };
}

export function updateCategory(
  id: string,
  patch: { name?: string; icon?: string }
): void {
  const db = getDb();
  if (id === 'cat_debt') return; // Cannot modify system debt category

  const fields: string[] = [];
  const params: any[] = [];

  if (patch.name !== undefined && patch.name.trim()) {
    fields.push('name = ?');
    params.push(patch.name.trim());
  }

  if (patch.icon !== undefined && patch.icon.trim()) {
    fields.push('icon = ?');
    params.push(patch.icon.trim());
  }

  if (fields.length === 0) return;

  params.push(id);
  db.runSync(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?;`, params);
}

export function toggleCategoryHidden(id: string, isHidden: boolean): void {
  const db = getDb();
  // Prevent hiding system debt and other category
  if (id === 'cat_debt' || id === 'cat_other') return;

  db.runSync(`UPDATE categories SET is_hidden = ? WHERE id = ?;`, [isHidden ? 1 : 0, id]);
}

export function getCategoryUsageCount(categoryId: string): number {
  const db = getDb();
  const rows: any[] = db.getAllSync(
    `SELECT COUNT(*) as count FROM transactions WHERE category_id = ?;`,
    [categoryId]
  );
  return rows[0]?.count ?? 0;
}

export function deleteCategory(id: string): boolean {
  const db = getDb();
  if (id === 'cat_debt' || id === 'cat_other') return false;

  db.withTransactionSync(() => {
    // Reassign existing transactions of this category to 'cat_other'
    db.runSync(
      `UPDATE transactions SET category_id = 'cat_other' WHERE category_id = ?;`,
      [id]
    );
    // Delete the category
    db.runSync(`DELETE FROM categories WHERE id = ?;`, [id]);
  });

  return true;
}

export function getRecentTransactions(limit = 4): Transaction[] {
  const db = getDb();
  return db.getAllSync(
    `SELECT t.*, c.name as category_name, c.icon as category_icon
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     ORDER BY t.created_at DESC
     LIMIT ?;`,
    [limit]
  );
}

export function getAllTransactions(filter?: { type?: string; search?: string }): Transaction[] {
  const db = getDb();
  let query = `
    SELECT t.*, c.name as category_name, c.icon as category_icon
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filter?.type && filter.type !== 'ALL') {
    query += ` AND t.type = ?`;
    params.push(filter.type);
  }

  if (filter?.search && filter.search.trim().length > 0) {
    query += ` AND (t.note LIKE ? OR t.receiver_name LIKE ? OR t.receiver_account LIKE ? OR c.name LIKE ?)`;
    const s = `%${filter.search.trim()}%`;
    params.push(s, s, s, s);
  }

  query += ` ORDER BY t.created_at DESC;`;
  return db.getAllSync(query, params);
}

export function getTransactionById(id: string): Transaction | null {
  const db = getDb();
  const rows: any[] = db.getAllSync(
    `SELECT t.*, c.name as category_name, c.icon as category_icon
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.id = ?;`,
    [id]
  );
  return rows[0] || null;
}

export function insertTransaction(tx: Omit<Transaction, 'created_at'> & { created_at?: number }): void {
  const db = getDb();
  const createdAt = tx.created_at || Date.now();
  db.runSync(
    `INSERT INTO transactions (id, amount, type, category_id, source_bank_code, receiver_name, receiver_account, receiver_bank_code, note, raw_qr, created_at, debt_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      tx.id,
      tx.amount,
      tx.type,
      tx.category_id,
      tx.source_bank_code,
      tx.receiver_name || '',
      tx.receiver_account || '',
      tx.receiver_bank_code || '',
      tx.note || '',
      tx.raw_qr || '',
      createdAt,
      tx.debt_id || null,
    ]
  );
  recalculateStats();
}

export function updateTransaction(
  id: string,
  patch: Partial<Pick<Transaction, 'amount' | 'type' | 'category_id' | 'source_bank_code' | 'note' | 'receiver_name' | 'receiver_account' | 'receiver_bank_code' | 'created_at'>>
): void {
  const db = getDb();
  const current = getTransactionById(id);
  if (!current) return;

  const newAmount = patch.amount !== undefined ? patch.amount : current.amount;
  const newType = patch.type !== undefined ? patch.type : current.type;
  const newCat = patch.category_id !== undefined ? patch.category_id : current.category_id;
  const newBank = patch.source_bank_code !== undefined ? patch.source_bank_code : current.source_bank_code;
  const newNote = patch.note !== undefined ? patch.note : (current.note || '');
  const newReceiver = patch.receiver_name !== undefined ? patch.receiver_name : (current.receiver_name || '');
  const newAccount = patch.receiver_account !== undefined ? patch.receiver_account : (current.receiver_account || '');
  const newReceiverBank = patch.receiver_bank_code !== undefined ? patch.receiver_bank_code : (current.receiver_bank_code || '');
  const newCreatedAt = patch.created_at !== undefined ? patch.created_at : current.created_at;

  db.runSync(
    `UPDATE transactions
     SET amount = ?, type = ?, category_id = ?, source_bank_code = ?, note = ?, receiver_name = ?, receiver_account = ?, receiver_bank_code = ?, created_at = ?
     WHERE id = ?;`,
    [
      newAmount,
      newType,
      newCat,
      newBank,
      newNote || '',
      newReceiver || '',
      newAccount || '',
      newReceiverBank || '',
      newCreatedAt,
      id,
    ]
  );

  recalculateStats();
}

export function deleteTransaction(id: string): Transaction | null {
  const db = getDb();
  const tx = getTransactionById(id);
  if (!tx) return null;

  db.runSync(`DELETE FROM transactions WHERE id = ?;`, [id]);
  recalculateStats();
  return tx;
}

export function restoreTransaction(tx: Transaction): void {
  const db = getDb();
  db.runSync(
    `INSERT OR REPLACE INTO transactions (id, amount, type, category_id, source_bank_code, receiver_name, receiver_account, receiver_bank_code, note, raw_qr, created_at, debt_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      tx.id,
      tx.amount,
      tx.type,
      tx.category_id,
      tx.source_bank_code,
      tx.receiver_name || '',
      tx.receiver_account || '',
      tx.receiver_bank_code || '',
      tx.note || '',
      tx.raw_qr || '',
      tx.created_at,
      tx.debt_id || null,
    ]
  );
  recalculateStats();
}

export function recalculateStats() {
  const db = getDb();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

  // Spent today
  const todayRow: any[] = db.getAllSync(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'EXPENSE' AND created_at >= ?;`,
    [startOfDay]
  );
  const spentToday = todayRow[0]?.total ?? 0;

  // Spent this month
  const monthRow: any[] = db.getAllSync(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'EXPENSE' AND created_at >= ?;`,
    [startOfMonth]
  );
  const spentMonth = monthRow[0]?.total ?? 0;

  // Income this month
  const incomeRow: any[] = db.getAllSync(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'INCOME' AND created_at >= ?;`,
    [startOfMonth]
  );
  const totalIncomeMonth = incomeRow[0]?.total ?? 0;

  const monthlyBudget = storage.getNumber(STORAGE_KEYS.MONTHLY_BUDGET) ?? 0;
  const remainingBudget = monthlyBudget > 0 ? Math.max(0, monthlyBudget - spentMonth) : 0;
  const spentPercent = monthlyBudget > 0 ? Math.round((spentMonth / monthlyBudget) * 100) : 0;

  updateDashboardCache({
    remainingBudget,
    spentPercent,
    spentToday,
    spentMonth,
    totalIncomeMonth,
  });
}

/**
 * Xóa sạch toàn bộ giao dịch và sổ nợ người dùng
 * (Giữ lại danh mục chi tiêu và cấu hình cá nhân)
 */
export function clearAllUserData(): void {
  const db = getDb();
  db.execSync(`
    DELETE FROM transactions;
    DELETE FROM debt_payments;
    DELETE FROM debts;
  `);
  recalculateStats();
}

export interface FullDatabaseBackup {
  version: number;
  app: string;
  exported_at: number;
  categories: Category[];
  transactions: Transaction[];
  debts: any[];
  debt_payments: any[];
  settings: {
    monthly_budget?: number;
    default_source_bank?: string;
    is_balance_hidden?: boolean;
    is_dark_mode?: boolean;
  };
}

/**
 * Xuất toàn bộ dữ liệu database để sao lưu
 */
export function getAllDatabaseData(): FullDatabaseBackup {
  const db = getDb();
  const categories: Category[] = db.getAllSync(`SELECT * FROM categories ORDER BY sort_order ASC;`);
  const transactions: Transaction[] = db.getAllSync(`SELECT * FROM transactions ORDER BY created_at DESC;`);
  const debts: any[] = db.getAllSync(`SELECT * FROM debts ORDER BY created_at DESC;`);
  const debt_payments: any[] = db.getAllSync(`SELECT * FROM debt_payments ORDER BY created_at DESC;`);

  return {
    version: 1,
    app: 'no-app',
    exported_at: Date.now(),
    categories,
    transactions,
    debts,
    debt_payments,
    settings: {
      monthly_budget: storage.getNumber(STORAGE_KEYS.MONTHLY_BUDGET) ?? 0,
      default_source_bank: storage.getString(STORAGE_KEYS.DEFAULT_SOURCE_BANK) ?? 'BIDV',
      is_balance_hidden: storage.getBoolean(STORAGE_KEYS.IS_BALANCE_HIDDEN) ?? false,
      is_dark_mode: storage.getBoolean(STORAGE_KEYS.IS_DARK_MODE) ?? false,
    },
  };
}

/**
 * Khôi phục dữ liệu từ bản sao lưu JSON
 * @param backup Dữ liệu sao lưu
 * @param mode 'replace' (xóa cũ nạp mới) hoặc 'merge' (giữ cũ, thêm mới)
 */
export function restoreDatabaseData(
  backup: FullDatabaseBackup,
  mode: 'replace' | 'merge' = 'replace'
): void {
  const db = getDb();

  db.withTransactionSync(() => {
    if (mode === 'replace') {
      db.execSync(`
        DELETE FROM transactions;
        DELETE FROM debt_payments;
        DELETE FROM debts;
      `);
    }

    // 1. Phục hồi Categories
    if (Array.isArray(backup.categories)) {
      const verb = mode === 'replace' ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE';
      for (const cat of backup.categories) {
        db.runSync(
          `${verb} INTO categories (id, name, icon, type, sort_order, is_hidden) VALUES (?, ?, ?, ?, ?, ?);`,
          [cat.id, cat.name, cat.icon, cat.type, cat.sort_order ?? 0, cat.is_hidden ?? 0]
        );
      }
    }

    // 2. Phục hồi Debts
    if (Array.isArray(backup.debts)) {
      const verb = mode === 'replace' ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE';
      for (const d of backup.debts) {
        db.runSync(
          `${verb} INTO debts (id, person_name, direction, amount, note, track_in_expense, transaction_id, created_at, settled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            d.id,
            d.person_name,
            d.direction,
            d.amount,
            d.note ?? null,
            d.track_in_expense ?? 0,
            d.transaction_id ?? null,
            d.created_at,
            d.settled_at ?? null,
          ]
        );
      }
    }

    // 3. Phục hồi Debt Payments
    if (Array.isArray(backup.debt_payments)) {
      const verb = mode === 'replace' ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE';
      for (const p of backup.debt_payments) {
        db.runSync(
          `${verb} INTO debt_payments (id, debt_id, amount, note, created_at, transaction_id) VALUES (?, ?, ?, ?, ?, ?);`,
          [p.id, p.debt_id, p.amount, p.note ?? null, p.created_at, p.transaction_id ?? null]
        );
      }
    }

    // 4. Phục hồi Transactions
    if (Array.isArray(backup.transactions)) {
      const verb = mode === 'replace' ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE';
      for (const tx of backup.transactions) {
        db.runSync(
          `${verb} INTO transactions (id, amount, type, category_id, source_bank_code, receiver_name, receiver_account, receiver_bank_code, note, raw_qr, created_at, debt_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            tx.id,
            tx.amount,
            tx.type,
            tx.category_id,
            tx.source_bank_code,
            tx.receiver_name ?? '',
            tx.receiver_account ?? '',
            tx.receiver_bank_code ?? '',
            tx.note ?? '',
            tx.raw_qr ?? '',
            tx.created_at,
            tx.debt_id ?? null,
          ]
        );
      }
    }

    // 5. Phục hồi Cài đặt (nếu có và ở chế độ replace)
    if (mode === 'replace' && backup.settings) {
      if (typeof backup.settings.monthly_budget === 'number') {
        storage.setNumber(STORAGE_KEYS.MONTHLY_BUDGET, backup.settings.monthly_budget);
      }
      if (typeof backup.settings.default_source_bank === 'string') {
        storage.setString(STORAGE_KEYS.DEFAULT_SOURCE_BANK, backup.settings.default_source_bank);
      }
      if (typeof backup.settings.is_balance_hidden === 'boolean') {
        storage.setBoolean(STORAGE_KEYS.IS_BALANCE_HIDDEN, backup.settings.is_balance_hidden);
      }
    }
  });

  recalculateStats();
}

