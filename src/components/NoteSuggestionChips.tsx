// src/components/NoteSuggestionChips.tsx
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';

interface NoteSuggestionChipsProps {
  suggestions: string[];
  currentNote: string;
  onSelectNote: (note: string) => void;
  containerStyle?: object;
}

export const NoteSuggestionChips: React.FC<NoteSuggestionChipsProps> = ({
  suggestions,
  currentNote,
  onSelectNote,
  containerStyle,
}) => {
  const { colors, isDark } = useTheme();

  const handlePressChip = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const trimmed = currentNote.trim();

    // If current note is exactly tag -> toggle off
    if (trimmed === tag) {
      onSelectNote('');
      return;
    }

    // If current note is empty -> set tag
    if (!trimmed) {
      onSelectNote(tag);
      return;
    }

    // If tag is already in current note -> remove it
    const parts = trimmed.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.includes(tag)) {
      const filtered = parts.filter((s) => s !== tag);
      onSelectNote(filtered.join(', '));
      return;
    }

    // Otherwise append tag
    onSelectNote(`${trimmed}, ${tag}`);
  };

  const isSelected = (tag: string) => {
    const parts = currentNote.split(/[,;\n]+/).map((s) => s.trim());
    return parts.includes(tag);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.container, containerStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {suggestions.map((tag) => {
        const active = isSelected(tag);
        return (
          <Pressable
            key={tag}
            onPress={() => handlePressChip(tag)}
            style={[
              styles.chip,
              {
                backgroundColor: active
                  ? isDark
                    ? 'rgba(249, 115, 22, 0.2)'
                    : 'rgba(249, 115, 22, 0.12)'
                  : colors.cardSecondary,
                borderColor: active
                  ? '#F97316'
                  : colors.borderSubtle,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: active
                    ? '#F97316'
                    : colors.textSecondary,
                  fontWeight: active ? '700' : '500',
                },
              ]}
            >
              {tag}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
  },
});
