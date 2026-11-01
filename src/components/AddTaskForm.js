import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from '@react-native-vector-icons/ionicons';
import { useTheme } from '../context/ThemeContext';
import { useTaskRecipients } from '../hooks/useTaskRecipients';
import { apiClient } from '../utils/apiClient';
import { createTaskPayload, initialRecipientKey } from '../utils/taskRecipients';
import { dateOnlyString } from '../utils/taskDates';
import { refreshSelfTaskReminders } from '../utils/reminderScheduler';
import { DEFAULT_GEOFENCE_RADIUS_METERS, taskCoordinates } from '../services/location';
import { takePickedLocation } from '../services/locationPicker';
import LocationCard from './LocationCard';
import TaskRecipientDropdown from './TaskRecipientDropdown';

const MODES = [
  { key: 'time', label: 'Time Based', screen: 'AddTaskTimeBased', icon: 'time-outline' },
  { key: 'non', label: 'Non Time Based', screen: 'AddTaskNonTimeBased', icon: 'list-outline' },
  { key: 'location', label: 'Location Based', screen: 'AddTaskLocationBased', icon: 'location-outline' },
];
const initialDate = value => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date();
  date.setSeconds(0, 0);
  return date;
};

// All three public AddTask screen names use this form so recipient selection,
// request validation and recipient payloads cannot drift between task types.
const AddTaskForm = ({ navigation, route, mode }) => {
  const { theme, isDark } = useTheme();
  const draft = route?.params?.draft;
  const [title, setTitle] = useState(draft?.title || '');
  const [description, setDescription] = useState(draft?.description || '');
  const [date, setDate] = useState(() => initialDate(draft?.date));
  const [locationSchedule, setLocationSchedule] = useState(draft?.locationSchedule || null);
  const [picker, setPicker] = useState(null);
  const [geofence, setGeofence] = useState(() => draft?.geofence || ({ latitude: null, longitude: null,
    geofenceRadiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS, geofenceEnabled: true }));
  const [mentionedUserIds, setMentionedUserIds] = useState(draft?.mentionedUserIds || []);
  const [members, setMembers] = useState([]);
  const [membersGroupId, setMembersGroupId] = useState(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [membersRevision, setMembersRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const busy = useRef(false);
  const recipients = useTaskRecipients(initialRecipientKey(route?.params));
  const selected = recipients.selected;
  const groupId = selected?.type === 'group' ? selected.groupId : null;
  const isTimeBased = mode === 'time' || (mode === 'location' && locationSchedule === 'time');
  const text = theme.text || '#0F172A';
  const muted = theme.subText || '#64748B';
  const primary = theme.primary || '#0284C7';
  const border = theme.border || '#D8E1EA';
  const surface = theme.card || '#FFFFFF';
  const input = theme.inputBg || (isDark ? '#0F172A' : '#F8FAFC');
  const locked = saving || submitted;

  useFocusEffect(useCallback(() => {
    if (mode !== 'location') return;
    const picked = takePickedLocation();
    if (picked) setGeofence(current => ({ ...current, ...picked }));
  }, [mode]));

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setMembers([]);
    setMembersError('');
    setMembersGroupId(null);
    if (!groupId) { setMembersLoading(false); return () => controller.abort(); }
    setMembersLoading(true);
    (async () => {
      try {
        const response = await apiClient(`/Managment/group/${groupId}/members`, { signal: controller.signal });
        if (!response?.success || !Array.isArray(response?.data?.members)) throw new Error('Group members could not be loaded.');
        const eligible = response.data.members.filter(member => member.isRegistered !== false &&
          Number.isSafeInteger(Number(member.userId)) && Number(member.userId) > 0 &&
          String(member.userId) !== String(recipients.currentUserId));
        if (!active) return;
        setMembers(eligible);
        setMentionedUserIds(current => current.filter(id => eligible.some(member => Number(member.userId) === Number(id))));
        setMembersGroupId(groupId);
      } catch (failure) { if (active) setMembersError(failure.message || 'Group members could not be loaded.'); }
      finally { if (active) setMembersLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [groupId, recipients.currentUserId, membersRevision]);

  const chooseRecipient = key => {
    if (key === recipients.selectedKey) return;
    setMentionedUserIds([]);
    setMembers([]);
    setMembersGroupId(null);
    recipients.setSelectedKey(key);
  };
  const changeMode = next => {
    if (locked || next.key === mode) return;
    navigation.replace(next.screen, { draft: { title, description, date: date.toISOString(),
      recipientKey: recipients.selectedKey, geofence, mentionedUserIds,
      locationSchedule: mode === 'location' ? locationSchedule : mode } });
  };
  const changeDate = (event, value) => {
    if (Platform.OS === 'android' || event?.type === 'dismissed') setPicker(null);
    if (!value || event?.type === 'dismissed') return;
    setDate(previous => {
      const next = new Date(previous);
      if (picker === 'date') next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
      else next.setHours(value.getHours(), value.getMinutes(), 0, 0);
      return next;
    });
  };
  const groupReady = !groupId || (!membersLoading && !membersError && membersGroupId === groupId);
  const placeReady = mode !== 'location' || (!!taskCoordinates(geofence) && !!locationSchedule);
  const canSubmit = !locked && recipients.ready && groupReady && placeReady && !!title.trim() && !!description.trim();
  const submit = async () => {
    // A ref closes the rapid-double-tap window before React updates disabled state.
    if (busy.current || submitted) return;
    if (!canSubmit) { Alert.alert('Complete the form', 'Enter the task details and choose an available recipient and schedule.'); return; }
    busy.current = true;
    setSaving(true);
    try {
      const payload = createTaskPayload({ mode, locationSchedule, title, description, date,
        recipient: selected, geofence, mentionedUserIds });
      const result = await apiClient('/Managment/task', { method: 'POST', body: JSON.stringify(payload) });
      if (!result?.success || !result?.data?.id) throw new Error('The server did not confirm task creation.');
      setSubmitted(true);
      refreshSelfTaskReminders();
      const message = selected.type === 'contact' ? `Task assigned to ${selected.name}. It will appear in their personal dashboard.`
        : selected.type === 'group' ? `Task added to ${selected.name}. Group members can pick it.`
          : 'Your personal task has been created.';
      Alert.alert('Task created', message, [{ text: 'OK', onPress: () => {
        if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate('HomeDashboard');
      } }]);
    } catch (failure) {
      if (failure.status === 403 || failure.status === 404) recipients.reload();
      Alert.alert('Could not create task', failure.message || 'Please try again.');
    } finally { busy.current = false; setSaving(false); }
  };
  const toggleMention = userId => setMentionedUserIds(current => current.includes(userId)
    ? current.filter(id => id !== userId) : [...current, userId]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg || '#F1F5F9' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg || '#F1F5F9'} />
      <View style={[styles.header, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={saving} accessibilityLabel="Go back" style={styles.back}>
          <Icon name="arrow-back" size={24} color={text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}><Text style={[styles.heading, { color: text }]}>New Task</Text>
          <Text style={[styles.subheading, { color: muted }]}>{MODES.find(item => item.key === mode)?.label}</Text></View>
        <Icon name="create-outline" size={23} color={primary} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
            <Text style={[styles.label, { color: text }]}>Task Title</Text>
            <TextInput testID="task-title" accessibilityLabel="Task title" value={title} onChangeText={setTitle}
              placeholder="e.g. System Architecture Design" placeholderTextColor={muted} maxLength={300} editable={!locked}
              style={[styles.input, { color: text, backgroundColor: input, borderColor: border }]} />
            <Text style={[styles.label, { color: text }]}>Description</Text>
            <TextInput testID="task-description" accessibilityLabel="Task description" value={description} onChangeText={setDescription}
              placeholder="What needs to be done?" placeholderTextColor={muted} multiline editable={!locked}
              style={[styles.input, styles.description, { color: text, backgroundColor: input, borderColor: border }]} />
            <TaskRecipientDropdown sections={recipients.sections} selectedKey={recipients.selectedKey}
              onChange={chooseRecipient} loading={recipients.loading} error={recipients.error}
              onRetry={recipients.reload} disabled={locked} />
            <View style={[styles.recipientNote, { borderColor: border }]}>
              <Icon name="information-circle-outline" size={18} color={primary} />
              <Text style={[styles.noteText, { color: muted }]}>
                {selected?.type === 'contact' ? 'This task goes to the selected contact, not to your own task list.'
                  : selected?.type === 'group' ? 'This is a shared group task. A member can pick it.' : 'This task is only for you.'}
              </Text>
            </View>
          </View>
          <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
            <Text style={[styles.label, { color: text }]}>Task type</Text>
            <View style={styles.modeRow}>{MODES.map(item => <TouchableOpacity key={item.key} testID={`task-mode-${item.key}`}
              accessibilityRole="button" accessibilityState={{ selected: mode === item.key, disabled: locked }}
              onPress={() => changeMode(item)} disabled={locked}
              style={[styles.mode, { borderColor: mode === item.key ? primary : border, backgroundColor: input }]}>
              <Icon name={item.icon} size={21} color={mode === item.key ? primary : muted} />
              <Text style={[styles.modeLabel, { color: mode === item.key ? primary : muted }]}>{item.label}</Text>
            </TouchableOpacity>)}</View>
            {mode === 'location' ? <View style={styles.scheduleChoices}>
              <Text style={[styles.label, { color: text }]}>Schedule for this place</Text>
              {['time', 'non'].map(value => <TouchableOpacity key={value} disabled={locked}
                onPress={() => setLocationSchedule(value)} accessibilityRole="radio"
                accessibilityState={{ selected: locationSchedule === value }} style={styles.scheduleOption}>
                <Icon name={locationSchedule === value ? 'radio-button-on' : 'radio-button-off'} size={22} color={primary} />
                <Text style={[styles.modeLabel, { color: text }]}>{value === 'time' ? 'Time Based (date and time)' : 'Non Time Based (date only)'}</Text>
              </TouchableOpacity>)}
            </View> : null}
            <Text style={[styles.label, { color: text }]}>Due date</Text>
            <TouchableOpacity accessibilityLabel="Choose due date" disabled={locked} onPress={() => setPicker('date')}
              style={[styles.dateField, { backgroundColor: input, borderColor: border }]}>
              <Icon name="calendar-outline" size={20} color={primary} /><Text style={[styles.dateText, { color: text }]}>{dateOnlyString(date)}</Text>
            </TouchableOpacity>
            {isTimeBased ? <>
              <Text style={[styles.label, { color: text }]}>Due time</Text>
              <TouchableOpacity accessibilityLabel="Choose due time" disabled={locked} onPress={() => setPicker('time')}
                style={[styles.dateField, { backgroundColor: input, borderColor: border }]}>
                <Icon name="time-outline" size={20} color={primary} /><Text style={[styles.dateText, { color: text }]}>
                  {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </TouchableOpacity>
            </> : null}
            {picker ? <View>
              <DateTimePicker value={date} mode={picker} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={changeDate} />
              {Platform.OS === 'ios' ? <TouchableOpacity onPress={() => setPicker(null)} style={styles.done}>
                <Text style={[styles.retry, { color: primary }]}>Done</Text></TouchableOpacity> : null}
            </View> : null}
          </View>
          {mode === 'location' ? <View pointerEvents={locked ? 'none' : 'auto'}>
            <LocationCard value={geofence} onChange={patch => setGeofence(current => ({ ...current, ...patch }))} navigation={navigation} />
          </View> : null}
          {groupId ? <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
            <Text style={[styles.label, { color: text }]}>Mention group members (optional)</Text>
            <Text style={[styles.helper, { color: muted }]}>Mentions notify members; they do not pre-assign the shared task.</Text>
            {membersLoading ? <ActivityIndicator color={primary} /> : null}
            {membersError ? <View><Text style={styles.error}>{membersError}</Text>
              <TouchableOpacity onPress={() => setMembersRevision(value => value + 1)}><Text style={[styles.retry, { color: primary }]}>Retry members</Text></TouchableOpacity></View> : null}
            {!membersLoading && !membersError && members.length === 0 ? <Text style={[styles.helper, { color: muted }]}>No other registered members in this group.</Text> : null}
            {members.map(member => <TouchableOpacity key={member.id ?? member.userId} disabled={locked}
              onPress={() => toggleMention(Number(member.userId))} style={styles.member}
              accessibilityRole="checkbox" accessibilityState={{ checked: mentionedUserIds.includes(Number(member.userId)) }}>
              <Icon name={mentionedUserIds.includes(Number(member.userId)) ? 'checkbox' : 'square-outline'} size={22} color={primary} />
              <Text style={[styles.memberName, { color: text }]}>{member.name || member.firstName || 'Group member'}</Text>
            </TouchableOpacity>)}
          </View> : null}
          <TouchableOpacity testID="create-task" accessibilityRole="button" accessibilityState={{ disabled: !canSubmit, busy: saving }}
            disabled={!canSubmit} onPress={submit} style={[styles.submit, { backgroundColor: canSubmit ? primary : (isDark ? '#475569' : '#94A3B8') }]}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="add-circle-outline" color="#FFFFFF" size={22} />}
            <Text style={styles.submitText}>{submitted ? 'Task created' : saving ? 'Saving...' : selected?.type === 'contact' ? 'Assign Task' : selected?.type === 'group' ? 'Create Group Task' : 'Create Personal Task'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  screen: { flex: 1 }, flex: { flex: 1 }, header: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, gap: 12 },
  back: { paddingVertical: 8, paddingRight: 10 }, headerCopy: { flex: 1 }, heading: { fontSize: 21, fontWeight: '800' }, subheading: { fontSize: 12, marginTop: 2 },
  content: { padding: 16, paddingBottom: 32, width: '100%', maxWidth: 720, alignSelf: 'center', gap: 16 },
  card: { padding: 18, borderRadius: 16, borderWidth: 1 }, label: { fontSize: 14, fontWeight: '700', marginBottom: 9 },
  input: { minHeight: 48, borderRadius: 11, borderWidth: 1, paddingHorizontal: 13, fontSize: 14, marginBottom: 20 },
  description: { height: 100, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  recipientNote: { flexDirection: 'row', gap: 9, borderTopWidth: 1, paddingTop: 13, alignItems: 'flex-start' }, noteText: { flex: 1, lineHeight: 18, fontSize: 12 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 22 }, mode: { flex: 1, borderRadius: 11, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 6 },
  modeLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' }, scheduleChoices: { marginBottom: 18 }, scheduleOption: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10 },
  dateField: { minHeight: 48, borderWidth: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, marginBottom: 16 }, dateText: { fontSize: 14 },
  done: { alignSelf: 'flex-end' }, retry: { fontWeight: '700', paddingVertical: 10 }, helper: { fontSize: 12, lineHeight: 19, marginBottom: 10 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 }, memberName: { fontSize: 14, flex: 1 }, error: { color: '#DC2626', fontSize: 12, lineHeight: 18 },
  submit: { minHeight: 54, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9 },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
export default AddTaskForm;
