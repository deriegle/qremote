/** File-browser controls using the same search surface, dropdown, and chips as the main tabs. */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { FilterChip } from '@/components/FilterChip';
import { FileTreeOptions, hasFileFilters } from '@/utils/file-tree';
import { spacing, borderRadius } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { buttonStyles } from '@/constants/buttons';
import { shadows } from '@/constants/shadows';

interface FileListControlsProps {
  options: FileTreeOptions;
  onChange: (options: FileTreeOptions) => void;
  matching: number;
  total: number;
}
export function FileListControls({ options, onChange, matching, total }: FileListControlsProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [panel, setPanel] = useState<'sort' | 'filter' | null>(null);
  const [draft, setDraft] = useState(options);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const query = pendingQuery ?? options.query;
  const label = (key: string) => t(`screens.files.browse.${key}`);
  const patch = (value: Partial<FileTreeOptions>) => onChange({ ...options, ...value });
  const open = (value: 'sort' | 'filter') => {
    Keyboard.dismiss();
    setDraft(options);
    setPanel(panel === value ? null : value);
  };
  useEffect(() => {
    if (pendingQuery === null) return;
    const timer = setTimeout(() => {
      onChange({ ...options, query: pendingQuery });
      setPendingQuery(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [pendingQuery, options, onChange]);
  return (
    <View style={styles.controls}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[
            buttonStyles.icon,
            { backgroundColor: colors.surface, borderColor: colors.surfaceOutline },
          ]}
          accessibilityLabel={label('sort')}
          accessibilityState={{ expanded: panel === 'sort' }}
          onPress={() => open('sort')}
        >
          <Ionicons
            name="swap-vertical"
            size={18}
            color={panel === 'sort' ? colors.primary : colors.text}
          />
        </TouchableOpacity>
        <View
          style={[
            styles.search,
            { backgroundColor: colors.surface, borderColor: colors.surfaceOutline },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={label('search')}
            accessibilityLabel={label('search')}
            placeholderTextColor={colors.textSecondary}
            value={query}
            onFocus={() => setPanel(null)}
            onChangeText={setPendingQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {!!query && (
            <TouchableOpacity
              onPress={() => {
                setPendingQuery(null);
                patch({ query: '' });
              }}
              accessibilityLabel={t('common.clearSearch')}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            buttonStyles.icon,
            { backgroundColor: colors.surface, borderColor: colors.surfaceOutline },
          ]}
          accessibilityLabel={label('filters')}
          accessibilityState={{ expanded: panel === 'filter' }}
          onPress={() => open('filter')}
        >
          <Ionicons
            name="funnel-outline"
            size={18}
            color={
              options.inclusion !== 'all' || options.completion !== 'all' || panel === 'filter'
                ? colors.primary
                : colors.text
            }
          />
        </TouchableOpacity>
      </View>
      <Text style={[styles.count, { color: colors.textSecondary }]}>
        {t('screens.files.browse.count', { matching, total })}
      </Text>
      {panel && (
        <View
          style={[
            styles.panel,
            { backgroundColor: colors.surface, borderColor: colors.surfaceOutline },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.panelScroll}
            contentContainerStyle={styles.panelContent}
          >
            {panel === 'sort' ? (
              <>
                {(['name', 'progress', 'size', 'priority'] as const).map((sort) => (
                  <TouchableOpacity
                    key={sort}
                    style={styles.option}
                    accessibilityRole="button"
                    accessibilityLabel={
                      options.sort === sort
                        ? `${label(sort)}, ${t(`screens.settings.${options.direction === 'asc' ? 'ascending' : 'descending'}`)}`
                        : label(sort)
                    }
                    accessibilityState={{ selected: options.sort === sort }}
                    onPress={() => {
                      patch({
                        sort,
                        direction:
                          options.sort === sort
                            ? options.direction === 'asc'
                              ? 'desc'
                              : 'asc'
                            : sort === 'name'
                              ? 'asc'
                              : 'desc',
                      });
                      setPanel(null);
                    }}
                  >
                    <Text
                      style={[
                        typography.body,
                        {
                          flexShrink: 1,
                          color: options.sort === sort ? colors.primary : colors.text,
                        },
                      ]}
                    >
                      {label(sort)}
                    </Text>
                    {options.sort === sort && (
                      <Ionicons
                        name={options.direction === 'asc' ? 'arrow-up' : 'arrow-down'}
                        size={18}
                        color={colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {label('priorityHint')}
                </Text>
              </>
            ) : (
              <>
                <Text style={[typography.captionSemibold, { color: colors.textSecondary }]}>
                  {label('inclusion')}
                </Text>
                <View style={styles.chips}>
                  {(['all', 'included', 'skipped'] as const).map((inclusion) => (
                    <FilterChip
                      key={inclusion}
                      label={label(inclusion)}
                      active={draft.inclusion === inclusion}
                      onPress={() => setDraft({ ...draft, inclusion })}
                    />
                  ))}
                </View>
                <Text style={[typography.captionSemibold, { color: colors.textSecondary }]}>
                  {label('progress')}
                </Text>
                <View style={styles.chips}>
                  {(['all', 'complete', 'incomplete'] as const).map((completion) => (
                    <FilterChip
                      key={completion}
                      label={label(completion)}
                      active={draft.completion === completion}
                      onPress={() => setDraft({ ...draft, completion })}
                    />
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => setDraft({ ...draft, inclusion: 'all', completion: 'all' })}
                  accessibilityRole="button"
                >
                  <Text style={[typography.body, { color: colors.primary }]}>
                    {label('clearFilters')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[buttonStyles.small, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    patch({ inclusion: draft.inclusion, completion: draft.completion });
                    setPanel(null);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[typography.bodySemibold, { color: colors.onAccent }]}>
                    {label('apply')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      )}
      {hasFileFilters(options) && (
        <TouchableOpacity
          onPress={() => {
            setPanel(null);
            onChange({ ...options, query: '', inclusion: 'all', completion: 'all' });
          }}
          accessibilityRole="button"
        >
          <Text style={[styles.count, { color: colors.primary }]}>{label('clearAll')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  controls: { padding: spacing.md, gap: spacing.xs, zIndex: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 0.5,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.sm,
    height: 42,
  },
  input: { flex: 1, minWidth: 0, ...typography.body },
  count: { ...typography.caption, paddingTop: spacing.xs },
  panel: {
    borderWidth: 0.5,
    borderRadius: borderRadius.large,
    ...shadows.large,
    zIndex: 20,
  },
  panelScroll: { maxHeight: 260 },
  panelContent: { padding: spacing.md, gap: spacing.sm },
  option: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
