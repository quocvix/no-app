// App.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as SplashScreen from 'expo-splash-screen';

// Prevent native splash screen from hiding before initial frame is rendered
SplashScreen.preventAutoHideAsync().catch(() => {});

import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { initDatabase, deleteTransaction, restoreTransaction, Transaction } from './src/storage/sqlite';
import { getDebtById } from './src/storage/debts';
import { FloatingTabBar, TabName } from './src/components/FloatingTabBar';
import { HomeScreen } from './src/screens/HomeScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';
import { ExpenseCheckScreen } from './src/screens/ExpenseCheckScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ReportScreen } from './src/screens/ReportScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { CategoryManagementScreen } from './src/screens/CategoryManagementScreen';
import { DebtScreen } from './src/screens/DebtScreen';
import { DebtDetailScreen } from './src/screens/DebtDetailScreen';
import { TransactionDetailSheet } from './src/components/TransactionDetailSheet';
import { UndoSnackbar } from './src/components/UndoSnackbar';
import { VietQRData } from './src/services/vietqrParser';

const vnCurrencyFormatter = new Intl.NumberFormat('vi-VN');

function AppContent() {
  const { isDark, colors } = useTheme();
  const [currentTab, setCurrentTab] = useState<TabName>('home');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isExpenseCheckOpen, setIsExpenseCheckOpen] = useState(false);
  const [activeQRData, setActiveQRData] = useState<VietQRData | undefined>(undefined);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedDetailTx, setSelectedDetailTx] = useState<Transaction | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCategoryManagementOpen, setIsCategoryManagementOpen] = useState(false);
  const [selectedDebtPerson, setSelectedDebtPerson] = useState<string | null>(null);
  const [isDebtSheetOpen, setIsDebtSheetOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Undo snackbar state
  const [undoState, setUndoState] = useState<{
    visible: boolean;
    message: string;
    tx: Transaction;
  } | null>(null);

  useEffect(() => {
    async function prepare() {
      try {
        initDatabase();
      } catch (e) {
        console.warn('Database init notice:', e);
      } finally {
        await SplashScreen.hideAsync().catch(() => {});
      }
    }
    prepare();
  }, []);

  // Hardware Back Button Handler for Android
  useEffect(() => {
    const onBackPress = () => {
      if (selectedDetailTx) {
        setSelectedDetailTx(null);
        return true;
      }
      if (isDebtSheetOpen) {
        setIsDebtSheetOpen(false);
        return true;
      }
      if (selectedDebtPerson) {
        setSelectedDebtPerson(null);
        return true;
      }
      if (isCategoryManagementOpen) {
        setIsCategoryManagementOpen(false);
        return true;
      }
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return true;
      }
      if (isExpenseCheckOpen) {
        setIsExpenseCheckOpen(false);
        setEditingTx(null);
        return true;
      }
      if (isScannerOpen) {
        setIsScannerOpen(false);
        return true;
      }
      if (currentTab !== 'home') {
        setCurrentTab('home');
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [selectedDetailTx, isDebtSheetOpen, selectedDebtPerson, isCategoryManagementOpen, isSettingsOpen, isExpenseCheckOpen, isScannerOpen, currentTab]);

  const handleOpenScanner = useCallback(() => {
    setIsScannerOpen(true);
  }, []);

  const handleScanSuccess = useCallback((parsedData: VietQRData) => {
    setActiveQRData(parsedData);
    setEditingTx(null);
    setIsScannerOpen(false);
    setIsExpenseCheckOpen(true);
  }, []);

  const handleManualEntry = useCallback(() => {
    setActiveQRData({
      isValid: false,
      isDynamic: false,
      amount: 0,
      bankCode: 'BIDV',
      accountNumber: '',
      memo: '',
      rawPayload: '',
    });
    setEditingTx(null);
    setIsExpenseCheckOpen(true);
  }, []);

  const handleExpenseCheckDone = useCallback(() => {
    setIsExpenseCheckOpen(false);
    setActiveQRData(undefined);
    setEditingTx(null);
    setRefreshKey((k) => k + 1);
  }, []);

  // Transaction action handlers
  const handlePressTransaction = useCallback((tx: Transaction) => {
    setSelectedDetailTx(tx);
  }, []);

  const handleEditTransaction = useCallback((tx: Transaction) => {
    setSelectedDetailTx(null);
    setEditingTx(tx);
    setActiveQRData(undefined);
    setIsExpenseCheckOpen(true);
  }, []);

  const handleDeleteTransaction = useCallback((tx: Transaction) => {
    setSelectedDetailTx(null);
    const deleted = deleteTransaction(tx.id);
    if (deleted) {
      setRefreshKey((k) => k + 1);
      setUndoState({
        visible: true,
        message: `Đã xóa ${vnCurrencyFormatter.format(deleted.amount)}đ`,
        tx: deleted,
      });
    }
  }, []);

  const handleUndoDelete = useCallback(() => {
    if (undoState?.tx) {
      restoreTransaction(undoState.tx);
      setRefreshKey((k) => k + 1);
      setUndoState(null);
    }
  }, [undoState]);

  const handleOpenDebt = useCallback((debtId: string) => {
    setSelectedDetailTx(null);
    const debt = getDebtById(debtId);
    if (debt) {
      setSelectedDebtPerson(debt.person_name);
    } else {
      setCurrentTab('debt');
    }
  }, []);

  const renderActiveScreen = () => {
    if (isExpenseCheckOpen) {
      return (
        <ExpenseCheckScreen
          key={`check_${refreshKey}_${editingTx?.id || 'new'}`}
          qrData={activeQRData}
          editingTx={editingTx || undefined}
          onBack={() => {
            setIsExpenseCheckOpen(false);
            setEditingTx(null);
          }}
          onDone={handleExpenseCheckDone}
        />
      );
    }

    if (isCategoryManagementOpen) {
      return (
        <CategoryManagementScreen
          onBack={() => setIsCategoryManagementOpen(false)}
          onCategoryChange={() => setRefreshKey((k) => k + 1)}
        />
      );
    }

    if (isSettingsOpen) {
      return (
        <SettingsScreen
          key={`set_${refreshKey}`}
          onBack={() => setIsSettingsOpen(false)}
          onOpenCategoryManagement={() => setIsCategoryManagementOpen(true)}
          onDataChanged={() => setRefreshKey((k) => k + 1)}
        />
      );
    }

    if (selectedDebtPerson) {
      return (
        <DebtDetailScreen
          key={`debt_detail_${selectedDebtPerson}_${refreshKey}`}
          personName={selectedDebtPerson}
          onBack={() => setSelectedDebtPerson(null)}
          onDebtChange={() => setRefreshKey((k) => k + 1)}
        />
      );
    }

    if (isScannerOpen) {
      return (
        <ScannerScreen
          onClose={() => setIsScannerOpen(false)}
          onScanSuccess={handleScanSuccess}
        />
      );
    }

    switch (currentTab) {
      case 'home':
        return (
          <HomeScreen
            key={`home_${refreshKey}`}
            onOpenScanner={handleOpenScanner}
            onManualEntry={handleManualEntry}
            onViewAllHistory={() => setCurrentTab('history')}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenDebtTab={() => setCurrentTab('debt')}
            onPressTransaction={handlePressTransaction}
          />
        );
      case 'history':
        return (
          <HistoryScreen
            key={`hist_${refreshKey}`}
            onPressTransaction={handlePressTransaction}
          />
        );
      case 'report':
        return <ReportScreen key={`rep_${refreshKey}`} />;
      case 'debt':
        return (
          <DebtScreen
            key={`debt_${refreshKey}`}
            onSelectPerson={(personName) => setSelectedDebtPerson(personName)}
            refreshTrigger={refreshKey}
            onSheetVisibilityChange={setIsDebtSheetOpen}
          />
        );
      default:
        return null;
    }
  };

  const isOverlayOpen =
    isScannerOpen ||
    isExpenseCheckOpen ||
    isSettingsOpen ||
    isCategoryManagementOpen ||
    Boolean(selectedDebtPerson) ||
    Boolean(selectedDetailTx) ||
    isDebtSheetOpen;

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <StatusBar style={isScannerOpen ? 'light' : (isDark ? 'light' : 'dark')} />
          <View style={styles.screenWrapper}>{renderActiveScreen()}</View>

          {/* Transaction Detail Bottom Sheet */}
          <TransactionDetailSheet
            transaction={selectedDetailTx}
            onEdit={handleEditTransaction}
            onDelete={handleDeleteTransaction}
            onOpenDebt={handleOpenDebt}
            onClose={() => setSelectedDetailTx(null)}
          />

          {/* Undo Snackbar for Deletions */}
          <UndoSnackbar
            visible={Boolean(undoState?.visible)}
            message={undoState?.message || ''}
            onUndo={handleUndoDelete}
            onDismiss={() => setUndoState(null)}
          />

          {/* Show Floating Navigation Bar only on Main Tabs when NO bottom sheet/overlay is open */}
          {!isOverlayOpen && (
            <FloatingTabBar
              currentTab={currentTab}
              onSelectTab={(tab) => {
                setIsDebtSheetOpen(false);
                setCurrentTab(tab);
              }}
              onOpenScanner={handleOpenScanner}
            />
          )}
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  screenWrapper: {
    flex: 1,
  },
});
