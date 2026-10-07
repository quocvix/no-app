// src/components/UndoSnackbar.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RotateCcw, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';

interface UndoSnackbarProps {
  visible: boolean;
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export const UndoSnackbar: React.FC<UndoSnackbarProps> = ({
  visible,
  message,
  onUndo,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const handlePressUndo = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onUndo();
    handleDismiss();
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: insets.bottom + 84, // Ngay phía trên thanh FloatingTabBar
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View
        style={[
          styles.content,
          {
            backgroundColor: isDark ? '#27272A' : '#0F172A',
            borderColor: isDark ? '#3F3F46' : '#1E293B',
          },
        ]}
      >
        <Text
          style={[styles.message, { color: '#FFFFFF' }]}
          numberOfLines={1}
        >
          {message}
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={handlePressUndo}
            hitSlop={8}
            style={styles.undoBtn}
          >
            <RotateCcw size={15} color="#F97316" style={{ marginRight: 5 }} />
            <Text style={styles.undoText}>Hoàn tác</Text>
          </Pressable>

          <Pressable
            onPress={handleDismiss}
            hitSlop={8}
            style={styles.closeBtn}
          >
            <X size={16} color="#94A3B8" />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginRight: 8,
  },
  undoText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F97316',
  },
  closeBtn: {
    padding: 4,
  },
});
