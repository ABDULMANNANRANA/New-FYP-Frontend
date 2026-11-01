import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Pressable, SectionList, StyleSheet,
  Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';
import { useTheme } from '../context/ThemeContext';

const recipientIcon = type => type === 'group' ? 'people-outline' : type === 'contact' ? 'person-outline' : 'person-circle-outline';
const TaskRecipientDropdown = ({ sections, selectedKey, onChange, loading, error, onRetry, disabled = false }) => {
  const { theme, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const anchor = useRef(null);
  const [placement, setPlacement] = useState(null);
  const [search, setSearch] = useState('');
  useEffect(() => {
    // Keep the menu visible when the keyboard or device orientation changes.
    // Modal.onOrientationChange also fires on initial iOS presentation, so it
    // must not be used to close a newly opened dropdown.
    setPlacement(current => {
      if (!current) return current;
      const panelHeight = Math.min(current.height, Math.max(100, height - 24));
      const panelWidth = Math.min(current.width, width - 24);
      return { ...current, width: panelWidth, height: panelHeight,
        top: Math.max(12, Math.min(current.top, height - panelHeight - 12)),
        left: Math.max(12, Math.min(current.left, width - panelWidth - 12)) };
    });
  }, [width, height]);
  const selected = sections.flatMap(section => section.data).find(item => item.key === selectedKey);
  const text = theme.text || '#0F172A';
  const muted = theme.subText || '#64748B';
  const border = theme.border || '#D8E1EA';
  const surface = theme.card || '#FFFFFF';
  const primary = theme.primary || '#0284C7';
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sections.map(section => ({ ...section, data: section.data.filter(item =>
      item.type === 'self' || item.label.toLowerCase().includes(query)) }));
  }, [sections, search]);
  const open = () => {
    if (disabled || loading) return;
    Keyboard.dismiss();
    setSearch('');
    anchor.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      const below = height - y - measuredHeight - 12;
      const above = y - 12;
      const upwards = below < 280 && above > below;
      const panelHeight = Math.min(360, height - 32, Math.max(160, upwards ? above : below));
      const panelWidth = Math.min(Math.max(measuredWidth, 240), width - 24, 560);
      setPlacement({ top: Math.max(12, Math.min(upwards ? y - panelHeight - 5 : y + measuredHeight + 5,
        height - panelHeight - 12)), left: Math.max(12, Math.min(x, width - panelWidth - 12)),
      width: panelWidth, height: panelHeight });
    });
  };
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: text }]}>Create task for</Text>
      <TouchableOpacity ref={anchor} collapsable={false} testID="recipient-dropdown"
        accessibilityRole="button" accessibilityLabel={`Create task for: ${selected?.label || 'Choose a recipient'}`}
        accessibilityState={{ disabled: disabled || loading, expanded: !!placement }}
        disabled={disabled || loading} onPress={open}
        style={[styles.field, { backgroundColor: surface, borderColor: placement ? primary : border }]}>
        <Icon name={recipientIcon(selected?.type)} size={20} color={primary} />
        <Text numberOfLines={1} style={[styles.value, { color: selected ? text : muted }]}>
          {selected?.label || (loading ? 'Loading recipients...' : 'Choose a recipient')}
        </Text>
        {loading ? <ActivityIndicator size="small" color={primary} /> : <Icon name="chevron-down" size={19} color={muted} />}
      </TouchableOpacity>
      <Text style={[styles.helper, { color: muted }]}>Choose yourself, one registered contact, or one of your groups.</Text>
      {!loading && !error && !selected ? <Text style={styles.error}>That recipient is no longer available. Please choose another.</Text> : null}
      {error ? <View style={styles.errorRow}>
        <Text accessibilityRole="alert" style={[styles.error, styles.flex]}>{error}</Text>
        <TouchableOpacity onPress={onRetry} disabled={disabled} accessibilityRole="button"><Text style={[styles.retry, { color: primary }]}>Retry</Text></TouchableOpacity>
      </View> : null}
      <Modal visible={!!placement} transparent animationType="fade" statusBarTranslucent
        onRequestClose={() => setPlacement(null)}>
        <View style={styles.overlay}>
          <Pressable accessibilityLabel="Close recipient list" onPress={() => setPlacement(null)} style={StyleSheet.absoluteFill} />
          {placement ? <View accessibilityViewIsModal style={[styles.panel, placement, { backgroundColor: surface, borderColor: border }]}>
            <View style={[styles.searchRow, { borderBottomColor: border }]}>
              <Icon name="search-outline" size={18} color={muted} />
              <TextInput placeholder="Search contacts or groups" placeholderTextColor={muted}
                value={search} onChangeText={setSearch} style={[styles.search, { color: text }]}
                accessibilityLabel="Search task recipients" autoCorrect={false} />
              <TouchableOpacity onPress={() => setPlacement(null)} accessibilityLabel="Close recipient list"><Icon name="close" size={21} color={muted} /></TouchableOpacity>
            </View>
            <SectionList sections={filtered} keyExtractor={item => item.key}
              keyboardShouldPersistTaps="handled" stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) => section.title ?
                <Text style={[styles.section, { color: text }]}>{section.title}</Text> : null}
              renderSectionFooter={({ section }) => section.title && section.data.length === 0 ?
                <Text style={[styles.empty, { color: muted }]}>{search ? 'No matches' : section.title === 'Contacts' ? 'No registered contacts yet' : 'No groups yet'}</Text> : null}
              renderItem={({ item }) => <TouchableOpacity testID={`recipient-${item.key}`}
                accessibilityRole="button" accessibilityState={{ selected: item.key === selectedKey }}
                onPress={() => { onChange(item.key); setPlacement(null); }}
                style={[styles.option, { backgroundColor: item.key === selectedKey ? (isDark ? '#19364A' : '#E6F5FF') : surface }]}>
                <Icon name={recipientIcon(item.type)} size={18} color={item.key === selectedKey ? primary : muted} />
                <Text style={[styles.optionLabel, { color: text }]}>{item.label}</Text>
                {item.key === selectedKey ? <Icon name="checkmark" size={18} color={primary} /> : null}
              </TouchableOpacity>} />
          </View> : null}
        </View>
      </Modal>
    </View>
  );
};
const styles = StyleSheet.create({
  wrapper: { marginBottom: 18 }, label: { fontSize: 14, fontWeight: '700', marginBottom: 9 },
  field: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  value: { flex: 1, fontSize: 14 }, helper: { fontSize: 12, lineHeight: 18, marginTop: 7 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.18)' },
  panel: { position: 'absolute', borderWidth: 1, borderRadius: 12, overflow: 'hidden', elevation: 14,
    shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, borderBottomWidth: 1 },
  search: { flex: 1, minHeight: 46, fontSize: 13 },
  section: { paddingHorizontal: 16, paddingTop: 13, paddingBottom: 5, fontWeight: '800', fontSize: 13 },
  option: { paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 43 },
  optionLabel: { flex: 1, fontSize: 14 }, empty: { paddingHorizontal: 44, paddingVertical: 10, fontSize: 12 },
  error: { color: '#DC2626', fontSize: 12, lineHeight: 18, marginTop: 6 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1 }, retry: { fontWeight: '700', padding: 8 },
});
export default TaskRecipientDropdown;
