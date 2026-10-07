// src/storage/debts.ts
import { getDb, recalculateStats, insertTransaction, deleteTransaction } from './sqlite';

export type DebtDirection = 'LEND' | 'BORROW';

export interface Debt {
  id: string;
  person_name: string;
  direction: DebtDirection;
  amount: number;
  note?: string;
  track_in_expense: 0 | 1;
  transaction_id?: string | null;
  created_at: number;
  settled_at: number | null;
  paid: number;
  remaining: number;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  note?: string;
  created_at: number;
  transaction_id?: string | null;
}

export interface PersonDebtSummary {
  person_name: string;
  lend_remaining: number;
  borrow_remaining: number;
  net: number; // lend_remaining - borrow_remaining
  open_count: number;
  last_activity: number;
}

export function initDebtTables() {
  const db = getDb();
  db.execSync(`
    CREATE TABLE IF NOT EXISTS debts (
      id TEXT PRIMARY KEY,
      person_name TEXT NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('LEND', 'BORROW')),
      amount REAL NOT NULL,
      note TEXT,
      track_in_expense INTEGER NOT NULL DEFAULT 0,
      transaction_id TEXT,
      created_at INTEGER NOT NULL,
      settled_at INTEGER
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS debt_payments (
      id TEXT PRIMARY KEY,
      debt_id TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL,
      transaction_id TEXT,
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
    );
  `);

  db.execSync(`CREATE INDEX IF NOT EXISTS idx_debts_person ON debts(person_name);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_debts_settled ON debts(settled_at);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);`);
}

export function getDebtTotals(): { owedToMe: number; iOwe: number } {
  const db = getDb();
  initDebtTables();

  const query = `
    SELECT 
      d.direction,
      COALESCE(SUM(d.amount - COALESCE(p.paid, 0)), 0) as remaining_total
    FROM debts d
    LEFT JOIN (
      SELECT debt_id, SUM(amount) as paid
      FROM debt_payments
      GROUP BY debt_id
    ) p ON d.id = p.debt_id
    WHERE d.settled_at IS NULL
    GROUP BY d.direction;
  `;

  const rows: any[] = db.getAllSync(query);
  let owedToMe = 0;
  let iOwe = 0;

  for (const r of rows) {
    if (r.direction === 'LEND') {
      owedToMe = Math.max(0, r.remaining_total);
    } else if (r.direction === 'BORROW') {
      iOwe = Math.max(0, r.remaining_total);
    }
  }

  return { owedToMe, iOwe };
}

export function getPersonSummaries(opts?: { filter?: 'OPEN' | 'SETTLED' | 'ALL' }): PersonDebtSummary[] {
  const db = getDb();
  initDebtTables();

  const filter = opts?.filter || 'OPEN';

  const query = `
    SELECT 
      d.person_name,
      d.direction,
      d.created_at,
      d.settled_at,
      d.amount,
      COALESCE(p.paid, 0) as paid
    FROM debts d
    LEFT JOIN (
      SELECT debt_id, SUM(amount) as paid
      FROM debt_payments
      GROUP BY debt_id
    ) p ON d.id = p.debt_id
    ORDER BY d.created_at DESC;
  `;

  const rows: any[] = db.getAllSync(query);
  const map = new Map<string, PersonDebtSummary>();

  for (const r of rows) {
    const name = r.person_name.trim();
    if (!map.has(name)) {
      map.set(name, {
        person_name: name,
        lend_remaining: 0,
        borrow_remaining: 0,
        net: 0,
        open_count: 0,
        last_activity: r.created_at,
      });
    }

    const summary = map.get(name)!;
    summary.last_activity = Math.max(summary.last_activity, r.created_at);

    const remaining = Math.max(0, r.amount - r.paid);
    const isOpen = r.settled_at === null && remaining > 0;

    if (isOpen) {
      summary.open_count += 1;
      if (r.direction === 'LEND') {
        summary.lend_remaining += remaining;
      } else {
        summary.borrow_remaining += remaining;
      }
    }
  }

  // Calculate net and filter
  const list: PersonDebtSummary[] = [];
  for (const item of map.values()) {
    item.net = item.lend_remaining - item.borrow_remaining;
    if (filter === 'OPEN' && item.open_count === 0) continue;
    if (filter === 'SETTLED' && item.open_count > 0) continue;
    list.push(item);
  }

  return list.sort((a, b) => b.last_activity - a.last_activity);
}

export function getDebtsByPerson(personName: string): Debt[] {
  const db = getDb();
  initDebtTables();

  const query = `
    SELECT 
      d.*,
      COALESCE(p.paid, 0) as paid
    FROM debts d
    LEFT JOIN (
      SELECT debt_id, SUM(amount) as paid
      FROM debt_payments
      GROUP BY debt_id
    ) p ON d.id = p.debt_id
    WHERE d.person_name = ?
    ORDER BY d.created_at DESC;
  `;

  const rows: any[] = db.getAllSync(query, [personName.trim()]);
  return rows.map((r) => {
    const paid = r.paid ?? 0;
    const remaining = Math.max(0, r.amount - paid);
    return {
      ...r,
      paid,
      remaining,
    };
  });
}

export function getDebtById(id: string): Debt | null {
  const db = getDb();
  initDebtTables();

  const query = `
    SELECT 
      d.*,
      COALESCE(p.paid, 0) as paid
    FROM debts d
    LEFT JOIN (
      SELECT debt_id, SUM(amount) as paid
      FROM debt_payments
      GROUP BY debt_id
    ) p ON d.id = p.debt_id
    WHERE d.id = ?;
  `;

  const rows: any[] = db.getAllSync(query, [id]);
  if (rows.length === 0) return null;
  const r = rows[0];
  const paid = r.paid ?? 0;
  return {
    ...r,
    paid,
    remaining: Math.max(0, r.amount - paid),
  };
}

export function getPayments(debtId: string): DebtPayment[] {
  const db = getDb();
  initDebtTables();
  return db.getAllSync(
    `SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY created_at DESC;`,
    [debtId]
  );
}

export function getPaymentById(paymentId: string): DebtPayment | null {
  const db = getDb();
  initDebtTables();
  const rows: any[] = db.getAllSync(
    `SELECT * FROM debt_payments WHERE id = ?;`,
    [paymentId]
  );
  if (rows.length === 0) return null;
  return rows[0] as DebtPayment;
}

export function getPersonNameSuggestions(prefix?: string): string[] {
  const db = getDb();
  initDebtTables();

  let query = `SELECT DISTINCT person_name FROM debts`;
  const params: any[] = [];
  if (prefix && prefix.trim()) {
    query += ` WHERE person_name LIKE ?`;
    params.push(`%${prefix.trim()}%`);
  }
  query += ` ORDER BY created_at DESC LIMIT 10;`;

  const rows: any[] = db.getAllSync(query, params);
  return rows.map((r) => r.person_name);
}

export function createDebt(input: {
  person_name: string;
  direction: DebtDirection;
  amount: number;
  note?: string;
  track_in_expense?: boolean;
  source_bank_code?: string;
  created_at?: number;
}): string {
  const db = getDb();
  initDebtTables();

  const debtId = `debt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = input.created_at || Date.now();
  const trackInExpense = input.track_in_expense ? 1 : 0;
  let txId: string | null = null;

  db.withTransactionSync(() => {
    if (trackInExpense) {
      txId = `tx_debt_${debtId}`;
      const isLend = input.direction === 'LEND';
      const txType = isLend ? 'EXPENSE' : 'INCOME';
      const defaultNote = isLend
        ? `Cho ${input.person_name} mượn`
        : `Vay từ ${input.person_name}`;
      const fullNote = input.note ? `${defaultNote}: ${input.note}` : defaultNote;

      insertTransaction({
        id: txId,
        amount: input.amount,
        type: txType,
        category_id: 'cat_debt',
        source_bank_code: input.source_bank_code || 'BIDV',
        receiver_name: input.person_name,
        note: fullNote,
        created_at: createdAt,
        debt_id: debtId,
      });
    }

    db.runSync(
      `INSERT INTO debts (id, person_name, direction, amount, note, track_in_expense, transaction_id, created_at, settled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL);`,
      [
        debtId,
        input.person_name.trim(),
        input.direction,
        input.amount,
        input.note || '',
        trackInExpense,
        txId,
        createdAt,
      ]
    );
  });

  recalculateStats();
  return debtId;
}

export function updateDebt(
  debtId: string,
  patch: {
    person_name?: string;
    amount?: number;
    note?: string;
    created_at?: number;
  }
): void {
  const db = getDb();
  initDebtTables();

  const current = getDebtById(debtId);
  if (!current) return;

  const newName = patch.person_name !== undefined ? patch.person_name.trim() : current.person_name;
  const newAmount = patch.amount !== undefined ? patch.amount : current.amount;
  const newNote = patch.note !== undefined ? patch.note : current.note;
  const newCreatedAt = patch.created_at !== undefined ? patch.created_at : current.created_at;

  db.withTransactionSync(() => {
    // Check if new amount settles or unsettles
    const remaining = newAmount - current.paid;
    const settledAt = remaining <= 0 ? (current.settled_at || Date.now()) : null;

    db.runSync(
      `UPDATE debts 
       SET person_name = ?, amount = ?, note = ?, created_at = ?, settled_at = ?
       WHERE id = ?;`,
      [newName, newAmount, newNote || '', newCreatedAt, settledAt, debtId]
    );

    // If there is an associated transaction, update it
    if (current.transaction_id) {
      const isLend = current.direction === 'LEND';
      const defaultNote = isLend ? `Cho ${newName} mượn` : `Vay từ ${newName}`;
      const fullNote = newNote ? `${defaultNote}: ${newNote}` : defaultNote;

      db.runSync(
        `UPDATE transactions
         SET amount = ?, note = ?, receiver_name = ?, created_at = ?
         WHERE id = ?;`,
        [newAmount, fullNote, newName, newCreatedAt, current.transaction_id]
      );
    }
  });

  recalculateStats();
}

export function deleteDebt(debtId: string): void {
  const db = getDb();
  initDebtTables();

  db.withTransactionSync(() => {
    // Delete all linked transactions for this debt (including payments)
    db.runSync(`DELETE FROM transactions WHERE debt_id = ?;`, [debtId]);
    // Delete payments
    db.runSync(`DELETE FROM debt_payments WHERE debt_id = ?;`, [debtId]);
    // Delete debt
    db.runSync(`DELETE FROM debts WHERE id = ?;`, [debtId]);
  });

  recalculateStats();
}

export function deleteAllDebtsByPerson(personName: string): void {
  const db = getDb();
  initDebtTables();

  const name = personName.trim();

  db.withTransactionSync(() => {
    // Delete transactions linked to any debt of this person
    db.runSync(
      `DELETE FROM transactions 
       WHERE debt_id IN (SELECT id FROM debts WHERE person_name = ?)
          OR (receiver_name = ? AND category_id = 'cat_debt');`,
      [name, name]
    );

    // Delete all payments belonging to debts of this person
    db.runSync(
      `DELETE FROM debt_payments 
       WHERE debt_id IN (SELECT id FROM debts WHERE person_name = ?);`,
      [name]
    );

    // Delete all debts of this person
    db.runSync(`DELETE FROM debts WHERE person_name = ?;`, [name]);
  });

  recalculateStats();
}

export function addPayment(input: {
  debt_id: string;
  amount: number;
  note?: string;
  source_bank_code?: string;
  created_at?: number;
}): string {
  const db = getDb();
  initDebtTables();

  const debt = getDebtById(input.debt_id);
  if (!debt) throw new Error('Debt not found');

  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = input.created_at || Date.now();
  let txId: string | null = null;

  db.withTransactionSync(() => {
    if (debt.track_in_expense) {
      txId = `tx_pay_${paymentId}`;
      // Quy tắc:
      // LEND (Cho mượn): người ta trả cho tôi => INCOME
      // BORROW (Đi vay): tôi trả nợ người ta => EXPENSE
      const isLend = debt.direction === 'LEND';
      const txType = isLend ? 'INCOME' : 'EXPENSE';
      const defaultNote = isLend
        ? `${debt.person_name} trả nợ`
        : `Trả nợ cho ${debt.person_name}`;
      const fullNote = input.note ? `${defaultNote}: ${input.note}` : defaultNote;

      insertTransaction({
        id: txId,
        amount: input.amount,
        type: txType,
        category_id: 'cat_debt',
        source_bank_code: input.source_bank_code || 'BIDV',
        receiver_name: debt.person_name,
        note: fullNote,
        created_at: createdAt,
        debt_id: debt.id,
      });
    }

    db.runSync(
      `INSERT INTO debt_payments (id, debt_id, amount, note, created_at, transaction_id)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [paymentId, debt.id, input.amount, input.note || '', createdAt, txId]
    );

    // Kiểm tra xem đã trả hết chưa
    const newPaid = debt.paid + input.amount;
    if (newPaid >= debt.amount) {
      db.runSync(`UPDATE debts SET settled_at = ? WHERE id = ?;`, [createdAt, debt.id]);
    }
  });

  recalculateStats();
  return paymentId;
}

export function updatePayment(
  paymentId: string,
  patch: { amount?: number; note?: string; created_at?: number }
): void {
  const db = getDb();
  initDebtTables();

  const rows: any[] = db.getAllSync(`SELECT * FROM debt_payments WHERE id = ?;`, [paymentId]);
  if (rows.length === 0) return;
  const current = rows[0];

  const newAmount = patch.amount !== undefined ? patch.amount : current.amount;
  const newNote = patch.note !== undefined ? patch.note : current.note;
  const newCreatedAt = patch.created_at !== undefined ? patch.created_at : current.created_at;

  db.withTransactionSync(() => {
    db.runSync(
      `UPDATE debt_payments SET amount = ?, note = ?, created_at = ? WHERE id = ?;`,
      [newAmount, newNote || '', newCreatedAt, paymentId]
    );

    // Update linked transaction if any
    if (current.transaction_id) {
      db.runSync(
        `UPDATE transactions SET amount = ?, note = ?, created_at = ? WHERE id = ?;`,
        [newAmount, newNote || '', newCreatedAt, current.transaction_id]
      );
    }

    // Check debt settled status
    const debt = getDebtById(current.debt_id);
    if (debt) {
      const remaining = debt.amount - debt.paid;
      const settledAt = remaining <= 0 ? (debt.settled_at || Date.now()) : null;
      db.runSync(`UPDATE debts SET settled_at = ? WHERE id = ?;`, [settledAt, debt.id]);
    }
  });

  recalculateStats();
}

export function deletePayment(paymentId: string): void {
  const db = getDb();
  initDebtTables();

  const rows: any[] = db.getAllSync(`SELECT * FROM debt_payments WHERE id = ?;`, [paymentId]);
  if (rows.length === 0) return;
  const payment = rows[0];

  db.withTransactionSync(() => {
    if (payment.transaction_id) {
      deleteTransaction(payment.transaction_id);
    }
    db.runSync(`DELETE FROM debt_payments WHERE id = ?;`, [paymentId]);

    // Mở lại debt nếu đã settled
    const debt = getDebtById(payment.debt_id);
    if (debt && debt.settled_at !== null && debt.remaining > 0) {
      db.runSync(`UPDATE debts SET settled_at = NULL WHERE id = ?;`, [debt.id]);
    }
  });

  recalculateStats();
}

export interface BatchPaymentResult {
  totalPaid: number;
  paymentsCount: number;
  settledDebtsCount: number;
  transactionId?: string | null;
}

export function addBatchPaymentByPerson(input: {
  person_name: string;
  direction: DebtDirection;
  amount: number;
  note?: string;
  track_in_expense?: boolean;
  source_bank_code?: string;
  created_at?: number;
}): BatchPaymentResult {
  const db = getDb();
  initDebtTables();

  const personName = input.person_name.trim();
  const createdAt = input.created_at || Date.now();
  const isLend = input.direction === 'LEND';

  // Lấy các khoản nợ của người này theo chiều nợ, chỉ lấy khoản chưa trả hết
  // Sắp xếp ORDER BY created_at ASC (khoản cũ nhất cấn trừ trước - FIFO)
  const query = `
    SELECT 
      d.*,
      COALESCE(p.paid, 0) as paid
    FROM debts d
    LEFT JOIN (
      SELECT debt_id, SUM(amount) as paid
      FROM debt_payments
      GROUP BY debt_id
    ) p ON d.id = p.debt_id
    WHERE d.person_name = ? AND d.direction = ? AND d.settled_at IS NULL
    ORDER BY d.created_at ASC;
  `;

  const rows: any[] = db.getAllSync(query, [personName, input.direction]);
  const openDebts = rows
    .map((r) => {
      const paid = r.paid ?? 0;
      return {
        ...r,
        paid,
        remaining: Math.max(0, r.amount - paid),
      };
    })
    .filter((d) => d.remaining > 0);

  if (openDebts.length === 0) {
    throw new Error('Không có khoản nợ nào cần thanh toán cho người này');
  }

  let remainingToPay = input.amount;
  let totalPaid = 0;
  let paymentsCount = 0;
  let settledDebtsCount = 0;
  let txId: string | null = null;

  db.withTransactionSync(() => {
    // Nếu có ghi vào chi tiêu, tạo đúng 1 transaction đại diện cho lần trả nợ chung này
    if (input.track_in_expense) {
      txId = `tx_batch_pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      // LEND (Cho mượn): người ta trả cho tôi => INCOME
      // BORROW (Đi vay): tôi trả nợ người ta => EXPENSE
      const txType = isLend ? 'INCOME' : 'EXPENSE';
      const defaultNote = isLend
        ? `${personName} trả nợ`
        : `Trả nợ cho ${personName}`;
      const fullNote = input.note ? `${defaultNote}: ${input.note}` : defaultNote;

      insertTransaction({
        id: txId,
        amount: input.amount,
        type: txType,
        category_id: 'cat_debt',
        source_bank_code: input.source_bank_code || 'BIDV',
        receiver_name: personName,
        note: fullNote,
        created_at: createdAt,
      });
    }

    // Phân bổ số tiền trả theo FIFO
    for (const debt of openDebts) {
      if (remainingToPay <= 0) break;

      const payAmount = Math.min(debt.remaining, remainingToPay);
      const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${paymentsCount}`;

      db.runSync(
        `INSERT INTO debt_payments (id, debt_id, amount, note, created_at, transaction_id)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [paymentId, debt.id, payAmount, input.note || '', createdAt, txId]
      );

      const newPaid = debt.paid + payAmount;
      if (newPaid >= debt.amount) {
        db.runSync(`UPDATE debts SET settled_at = ? WHERE id = ?;`, [createdAt, debt.id]);
        settledDebtsCount++;
      }

      remainingToPay -= payAmount;
      totalPaid += payAmount;
      paymentsCount++;
    }
  });

  recalculateStats();

  return {
    totalPaid,
    paymentsCount,
    settledDebtsCount,
    transactionId: txId,
  };
}

export function getOppositeDebtRemaining(personName: string, direction: DebtDirection): number {
  const db = getDb();
  initDebtTables();
  const oppositeDirection: DebtDirection = direction === 'LEND' ? 'BORROW' : 'LEND';
  const query = `
    SELECT 
      COALESCE(SUM(d.amount - COALESCE(p.paid, 0)), 0) as remaining_total
    FROM debts d
    LEFT JOIN (
      SELECT debt_id, SUM(amount) as paid
      FROM debt_payments
      GROUP BY debt_id
    ) p ON d.id = p.debt_id
    WHERE d.person_name = ? AND d.direction = ? AND d.settled_at IS NULL;
  `;
  const row: any = db.getFirstSync(query, [personName.trim(), oppositeDirection]);
  return row ? Math.max(0, row.remaining_total) : 0;
}

export interface AddDebtWithOffsetResult {
  offsetAmount: number;
  newDebtId?: string | null;
  newDebtRemaining: number;
}

export function addDebtWithOffset(input: {
  person_name: string;
  direction: DebtDirection;
  amount: number;
  note?: string;
  track_in_expense?: boolean;
  source_bank_code?: string;
  created_at?: number;
}): AddDebtWithOffsetResult {
  const db = getDb();
  initDebtTables();

  const personName = input.person_name.trim();
  const createdAt = input.created_at || Date.now();
  const oppositeDirection: DebtDirection = input.direction === 'LEND' ? 'BORROW' : 'LEND';
  const isLend = input.direction === 'LEND';

  // Lấy các khoản nợ ngược chiều chưa thanh toán xong, sắp xếp theo created_at ASC (FIFO)
  const query = `
    SELECT 
      d.*,
      COALESCE(p.paid, 0) as paid
    FROM debts d
    LEFT JOIN (
      SELECT debt_id, SUM(amount) as paid
      FROM debt_payments
      GROUP BY debt_id
    ) p ON d.id = p.debt_id
    WHERE d.person_name = ? AND d.direction = ? AND d.settled_at IS NULL
    ORDER BY d.created_at ASC;
  `;

  const rows: any[] = db.getAllSync(query, [personName, oppositeDirection]);
  const oppositeDebts = rows
    .map((r) => {
      const paid = r.paid ?? 0;
      return {
        ...r,
        paid,
        remaining: Math.max(0, r.amount - paid),
      };
    })
    .filter((d) => d.remaining > 0);

  const totalOppositeRemaining = oppositeDebts.reduce((sum, d) => sum + d.remaining, 0);

  const offsetAmount = Math.min(input.amount, totalOppositeRemaining);
  const newDebtRemaining = Math.max(0, input.amount - offsetAmount);
  let newDebtId: string | null = null;

  db.withTransactionSync(() => {
    let txId: string | null = null;
    if (input.track_in_expense) {
      txId = `tx_offset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const txType = isLend ? 'EXPENSE' : 'INCOME';
      const defaultNote = isLend
        ? (newDebtRemaining > 0
            ? `Cấn trừ nợ & cho ${personName} mượn`
            : `Cấn trừ nợ cho ${personName}`)
        : (newDebtRemaining > 0
            ? `Cấn trừ nợ & vay thêm từ ${personName}`
            : `Cấn trừ nợ từ ${personName}`);
      const fullNote = input.note ? `${defaultNote}: ${input.note}` : defaultNote;

      insertTransaction({
        id: txId,
        amount: input.amount,
        type: txType,
        category_id: 'cat_debt',
        source_bank_code: input.source_bank_code || 'BIDV',
        receiver_name: personName,
        note: fullNote,
        created_at: createdAt,
      });
    }

    // 1. Phân bổ offsetAmount cho các khoản nợ ngược chiều theo FIFO
    let remainingToOffset = offsetAmount;
    let paymentIdx = 0;
    for (const debt of oppositeDebts) {
      if (remainingToOffset <= 0) break;

      const payAmount = Math.min(debt.remaining, remainingToOffset);
      const paymentId = `pay_offset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${paymentIdx++}`;

      const paymentNote = input.note
        ? `Cấn trừ vào nợ cũ: ${input.note}`
        : `Cấn trừ vào nợ cũ`;

      db.runSync(
        `INSERT INTO debt_payments (id, debt_id, amount, note, created_at, transaction_id)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [paymentId, debt.id, payAmount, paymentNote, createdAt, txId]
      );

      const newPaid = debt.paid + payAmount;
      if (newPaid >= debt.amount) {
        db.runSync(`UPDATE debts SET settled_at = ? WHERE id = ?;`, [createdAt, debt.id]);
      }

      remainingToOffset -= payAmount;
    }

    // 2. Nếu còn dư tiền -> tạo khoản nợ mới theo chiều input.direction
    if (newDebtRemaining > 0) {
      newDebtId = `debt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const debtNote = input.note
        ? `${input.note} (Sau khi cấn trừ)`
        : `Khoản còn lại sau khi cấn trừ nợ cũ`;

      db.runSync(
        `INSERT INTO debts (id, person_name, direction, amount, note, track_in_expense, transaction_id, created_at, settled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL);`,
        [
          newDebtId,
          personName,
          input.direction,
          newDebtRemaining,
          debtNote,
          input.track_in_expense ? 1 : 0,
          txId,
          createdAt,
        ]
      );
    }
  });

  recalculateStats();

  return {
    offsetAmount,
    newDebtId,
    newDebtRemaining,
  };
}

export function netDebtsByPerson(personName: string): { offsetAmount: number; settledDebtsCount: number } {
  const db = getDb();
  initDebtTables();

  const name = personName.trim();
  const createdAt = Date.now();

  const query = `
    SELECT 
      d.*,
      COALESCE(p.paid, 0) as paid
    FROM debts d
    LEFT JOIN (
      SELECT debt_id, SUM(amount) as paid
      FROM debt_payments
      GROUP BY debt_id
    ) p ON d.id = p.debt_id
    WHERE d.person_name = ? AND d.settled_at IS NULL
    ORDER BY d.created_at ASC;
  `;

  const rows: any[] = db.getAllSync(query, [name]);
  const debts = rows
    .map((r) => {
      const paid = r.paid ?? 0;
      return {
        ...r,
        paid,
        remaining: Math.max(0, r.amount - paid),
      };
    })
    .filter((d) => d.remaining > 0);

  const lendDebts = debts.filter((d) => d.direction === 'LEND');
  const borrowDebts = debts.filter((d) => d.direction === 'BORROW');

  const lendTotal = lendDebts.reduce((sum, d) => sum + d.remaining, 0);
  const borrowTotal = borrowDebts.reduce((sum, d) => sum + d.remaining, 0);

  const offsetAmount = Math.min(lendTotal, borrowTotal);
  if (offsetAmount <= 0) {
    return { offsetAmount: 0, settledDebtsCount: 0 };
  }

  let settledCount = 0;

  db.withTransactionSync(() => {
    // 1. Khấu trừ vào các khoản LEND theo FIFO
    let remainingToOffsetLend = offsetAmount;
    let idx = 0;
    for (const debt of lendDebts) {
      if (remainingToOffsetLend <= 0) break;
      const payAmount = Math.min(debt.remaining, remainingToOffsetLend);
      const paymentId = `pay_net_lend_${Date.now()}_${idx++}`;

      db.runSync(
        `INSERT INTO debt_payments (id, debt_id, amount, note, created_at, transaction_id)
         VALUES (?, ?, ?, ?, ?, NULL);`,
        [paymentId, debt.id, payAmount, 'Cấn trừ công nợ 2 chiều', createdAt]
      );

      if (debt.paid + payAmount >= debt.amount) {
        db.runSync(`UPDATE debts SET settled_at = ? WHERE id = ?;`, [createdAt, debt.id]);
        settledCount++;
      }
      remainingToOffsetLend -= payAmount;
    }

    // 2. Khấu trừ vào các khoản BORROW theo FIFO
    let remainingToOffsetBorrow = offsetAmount;
    idx = 0;
    for (const debt of borrowDebts) {
      if (remainingToOffsetBorrow <= 0) break;
      const payAmount = Math.min(debt.remaining, remainingToOffsetBorrow);
      const paymentId = `pay_net_borrow_${Date.now()}_${idx++}`;

      db.runSync(
        `INSERT INTO debt_payments (id, debt_id, amount, note, created_at, transaction_id)
         VALUES (?, ?, ?, ?, ?, NULL);`,
        [paymentId, debt.id, payAmount, 'Cấn trừ công nợ 2 chiều', createdAt]
      );

      if (debt.paid + payAmount >= debt.amount) {
        db.runSync(`UPDATE debts SET settled_at = ? WHERE id = ?;`, [createdAt, debt.id]);
        settledCount++;
      }
      remainingToOffsetBorrow -= payAmount;
    }
  });

  recalculateStats();

  return { offsetAmount, settledDebtsCount: settledCount };
}

export interface DebtTimelineItem {
  id: string;
  type: 'LEND_CREATE' | 'BORROW_CREATE' | 'LEND_PAYMENT' | 'BORROW_PAYMENT' | 'NET_OFFSET';
  direction: DebtDirection;
  amount: number;
  note?: string;
  created_at: number;
  debt_id: string;
  runningLend: number;
  runningBorrow: number;
  runningNet: number;
}

export function getDebtTimelineByPerson(personName: string): DebtTimelineItem[] {
  const db = getDb();
  initDebtTables();

  const name = personName.trim();

  // 1. Lấy tất cả các khoản nợ của người này
  const debtsQuery = `
    SELECT id, person_name, direction, amount, note, created_at
    FROM debts
    WHERE person_name = ?
  `;
  const debtRows: any[] = db.getAllSync(debtsQuery, [name]);

  // 2. Lấy tất cả các lần trả nợ liên quan đến người này
  const paymentsQuery = `
    SELECT p.id, p.debt_id, p.amount, p.note, p.created_at, d.direction
    FROM debt_payments p
    JOIN debts d ON p.debt_id = d.id
    WHERE d.person_name = ?
  `;
  const paymentRows: any[] = db.getAllSync(paymentsQuery, [name]);

  type RawEvent = {
    id: string;
    isDebt: boolean;
    debt_id: string;
    direction: DebtDirection;
    amount: number;
    note?: string;
    created_at: number;
  };

  const rawEvents: RawEvent[] = [];

  for (const d of debtRows) {
    rawEvents.push({
      id: d.id,
      isDebt: true,
      debt_id: d.id,
      direction: d.direction,
      amount: d.amount,
      note: d.note,
      created_at: d.created_at,
    });
  }

  for (const p of paymentRows) {
    rawEvents.push({
      id: p.id,
      isDebt: false,
      debt_id: p.debt_id,
      direction: p.direction,
      amount: p.amount,
      note: p.note,
      created_at: p.created_at,
    });
  }

  // Sắp xếp tăng dần theo thời gian tạo để tính số dư lũy kế (running balance)
  rawEvents.sort((a, b) => a.created_at - b.created_at);

  let curLend = 0;
  let curBorrow = 0;

  const timeline: DebtTimelineItem[] = [];

  for (const ev of rawEvents) {
    let type: DebtTimelineItem['type'];

    if (ev.isDebt) {
      if (ev.direction === 'LEND') {
        type = 'LEND_CREATE';
        curLend += ev.amount;
      } else {
        type = 'BORROW_CREATE';
        curBorrow += ev.amount;
      }
    } else {
      const isOffset = ev.note && ev.note.includes('Cấn trừ');
      if (isOffset) {
        type = 'NET_OFFSET';
      } else {
        type = ev.direction === 'LEND' ? 'LEND_PAYMENT' : 'BORROW_PAYMENT';
      }

      if (ev.direction === 'LEND') {
        curLend = Math.max(0, curLend - ev.amount);
      } else {
        curBorrow = Math.max(0, curBorrow - ev.amount);
      }
    }

    timeline.push({
      id: ev.id,
      type,
      direction: ev.direction,
      amount: ev.amount,
      note: ev.note,
      created_at: ev.created_at,
      debt_id: ev.debt_id,
      runningLend: curLend,
      runningBorrow: curBorrow,
      runningNet: curLend - curBorrow,
    });
  }

  // Đảo ngược để giao dịch mới nhất hiển thị trên cùng (chuẩn sao kê)
  return timeline.reverse();
}
