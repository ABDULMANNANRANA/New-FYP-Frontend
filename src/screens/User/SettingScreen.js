import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@react-native-vector-icons/ionicons';
import { clearSession } from '../../utils/session';
import { apiClient } from '../../utils/apiClient';
import { updateReminderPreferences } from '../../utils/reminderScheduler';
import { useTheme } from '../../context/ThemeContext';
import LiveLocationCard from '../../components/LiveLocationCard';
import {
  DATE_ONLY_SNOOZE_OPTIONS,
  formatSnooze,
  loadDateOnlyPreferences,
  saveDateOnlySnoozeMinutes,
} from '../../utils/dateOnlyReminders';

const SettingRow = ({
  icon,
  label,
  subtitle,
  children,
  onPress,
  disabled,
  colors,
  testID,
}) => {
  const content = (
    <>
      <Ionicons name={icon} size={21} color={colors.text} />
      <View style={styles.rowCopy}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children || (
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      )}
    </>
  );
  const rowStyle = [
    styles.row,
    { backgroundColor: colors.card, borderColor: colors.border },
    disabled && styles.disabled,
  ];
  return onPress ? (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.7}
      style={rowStyle}
    >
      {content}
    </TouchableOpacity>
  ) : (
    <View testID={testID} style={rowStyle}>
      {content}
    </View>
  );
};

const SettingScreen = ({ navigation }) => {
  const { isDark, toggleTheme } = useTheme();
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [notify, setNotify] = useState(true);
  const [snooze, setSnooze] = useState(5);
  const [dateSnooze, setDateSnooze] = useState(60);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dropdown, setDropdown] = useState(null);
  const [showLocation, setShowLocation] = useState(false);
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  const account = useRef(null);
  const active = useRef(false);
  const colors = isDark
    ? {
        bg: '#17231F',
        card: '#26352E',
        text: '#F0F5F1',
        muted: '#ADBEB3',
        border: '#3A4A40',
        accent: '#78C2BC',
        avatar: '#365E53',
        header: '#304139',
      }
    : {
        bg: '#DFE8DD',
        card: '#F5F2E8',
        text: '#26382F',
        muted: '#66766B',
        border: '#D6DCCE',
        accent: '#6DAEB1',
        avatar: '#A7D5C5',
        header: '#F2F4E9',
      };

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      if (reload > 0) setDropdown(null);
      const controller = new AbortController();
      const alive = () => active.current && !controller.signal.aborted;
      const load = async () => {
        setSaving(lock.current);
        setProfile(null);
        setProfileError('');
        setSettingsError('');
        setSettingsLoaded(false);
        setLocalLoaded(false);
        const options = { signal: controller.signal };
        await Promise.all([
          (async () => {
            try {
              const result = await apiClient('/Account/profile', options);
              if (alive()) setProfile(result?.data || {});
            } catch (failure) {
              if (alive()) setProfileError(failure.message);
            }
          })(),
          (async () => {
            try {
              const result = await apiClient('/User/settings', options);
              if (!alive()) return;
              setNotify(result?.data?.notificationEnabled !== false);
              setSnooze(Number(result?.data?.snoozeMinutes) || 5);
              await toggleTheme(result?.data?.darkModeEnabled === true);
              if (alive()) setSettingsLoaded(true);
            } catch (failure) {
              if (alive()) setSettingsError(failure.message);
            }
          })(),
          (async () => {
            try {
              const id = await AsyncStorage.getItem('userId');
              const value = await loadDateOnlyPreferences(id);
              if (alive()) {
                account.current = id;
                setDateSnooze(value.snoozeMinutes);
                setLocalLoaded(true);
              }
            } catch (failure) {
              if (alive()) setSettingsError(failure.message);
            }
          })(),
        ]);
      };
      load();
      return () => {
        active.current = false;
        controller.abort();
      };
    }, [toggleTheme, reload]),
  );

  const savePreferences = async patch => {
    if (lock.current || !settingsLoaded) return;
    lock.current = true;
    setSaving(true);
    const next = {
      notificationEnabled: notify,
      darkModeEnabled: isDark,
      snoozeMinutes: snooze,
      ...patch,
    };
    try {
      await apiClient('/User/settings', {
        method: 'PUT',
        body: JSON.stringify(next),
      });
      if (!active.current) return;
      setNotify(next.notificationEnabled);
      setSnooze(next.snoozeMinutes);
      await toggleTheme(next.darkModeEnabled);
      await updateReminderPreferences(next.notificationEnabled);
    } catch (failure) {
      if (active.current) Alert.alert('Settings', failure.message);
    } finally {
      lock.current = false;
      if (active.current) setSaving(false);
    }
  };
  const saveDateSnooze = async minutes => {
    if (lock.current || !localLoaded) return;
    lock.current = true;
    setSaving(true);
    setDropdown(null);
    try {
      await saveDateOnlySnoozeMinutes(account.current, minutes);
      if (active.current) setDateSnooze(minutes);
    } catch (failure) {
      if (active.current) Alert.alert('Settings', failure.message);
    } finally {
      lock.current = false;
      if (active.current) setSaving(false);
    }
  };
  const logout = async () => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    try {
      await clearSession();
    } catch (failure) {
      if (active.current) Alert.alert('Logout', failure.message);
    } finally {
      lock.current = false;
      if (active.current) setSaving(false);
    }
  };
  const section = title => (
    <Text
      accessibilityRole="header"
      style={[styles.section, { color: colors.text }]}
    >
      {title}
    </Text>
  );
  const selector = (kind, label) => (
    <>
      <Text style={[styles.selection, { color: colors.text }]}>{label}</Text>
      <Ionicons
        name={dropdown === kind ? 'chevron-up' : 'chevron-down'}
        size={14}
        color={colors.muted}
      />
    </>
  );
  const optionsList = (kind, values, selected, onSelect) =>
    dropdown === kind ? (
      <View
        style={[
          styles.options,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {values.map(minutes => (
          <TouchableOpacity
            key={minutes}
            testID={`${kind}-option-${minutes}`}
            accessibilityRole="button"
            accessibilityState={{ selected: minutes === selected }}
            disabled={saving}
            style={styles.option}
            onPress={() => onSelect(minutes)}
          >
            <Text style={{ color: colors.text }}>
              {kind === 'alarm' ? `${minutes} mins` : formatSnooze(minutes)}
            </Text>
            {minutes === selected ? (
              <Ionicons name="checkmark" size={18} color={colors.accent} />
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    ) : null;
  const switchProps = {
    disabled: saving || !settingsLoaded,
    trackColor: { false: isDark ? '#536359' : '#B8C2B6', true: colors.accent },
    thumbColor: '#FAFCF6',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.back}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={23} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.headerBadge, { backgroundColor: colors.header }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            SETTINGS
          </Text>
        </View>
        <View style={styles.back} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {section('Personal Info')}
        <View
          testID="settings-profile"
          style={[
            styles.profile,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.avatar }]}>
            <Ionicons name="person" size={24} color={colors.text} />
          </View>
          <View style={styles.profileCopy}>
            {profile ? (
              <>
                <Text
                  testID="profile-name"
                  style={[styles.name, { color: colors.text }]}
                >
                  {profile.fullName || 'Name not available'}
                </Text>
                <Text
                  testID="profile-email"
                  style={[styles.profileDetail, { color: colors.muted }]}
                >
                  {profile.email || 'Email not available'}
                </Text>
                <Text
                  testID="profile-phone"
                  style={[styles.profileDetail, { color: colors.muted }]}
                >
                  {profile.phoneNumber || 'Phone number not added'}
                </Text>
              </>
            ) : profileError ? (
              <>
                <Text accessibilityRole="alert" style={{ color: colors.text }}>
                  Unable to load profile
                </Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>
                  {profileError}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setReload(value => value + 1)}
                >
                  <Text style={[styles.retry, { color: colors.text }]}>
                    Retry
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.accent} />
                <Text style={{ color: colors.muted }}>
                  Loading your profile…
                </Text>
              </View>
            )}
          </View>
        </View>
        <SettingRow
          colors={colors}
          icon="time-outline"
          label="Task History & Analytics"
          testID="settings-history"
          onPress={() => navigation.navigate('HistoryScreen')}
        />
        {section('Preferences')}
        {settingsError ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setReload(value => value + 1)}
            style={styles.error}
          >
            <Text style={{ color: colors.text }}>
              {settingsError} Tap to retry.
            </Text>
          </TouchableOpacity>
        ) : null}
        <SettingRow
          colors={colors}
          icon="notifications-outline"
          label="Notifications & Alerts"
        >
          <Switch
            testID="settings-notifications"
            accessibilityLabel="Notifications & Alerts"
            {...switchProps}
            value={notify}
            onValueChange={value =>
              savePreferences({ notificationEnabled: value })
            }
          />
        </SettingRow>
        <SettingRow colors={colors} icon="moon-outline" label="Dark Mode">
          <Switch
            testID="settings-dark-mode"
            accessibilityLabel="Dark Mode"
            {...switchProps}
            value={isDark}
            onValueChange={value => savePreferences({ darkModeEnabled: value })}
          />
        </SettingRow>
        <SettingRow
          colors={colors}
          icon="alarm-outline"
          label="Alarm Snooze Interval"
          subtitle="Applied to 30-min prior task alerts"
          testID="settings-alarm-snooze"
          disabled={saving || !settingsLoaded}
          onPress={() => setDropdown(dropdown === 'alarm' ? null : 'alarm')}
        >
          {selector('alarm', `${snooze} mins`)}
        </SettingRow>
        {optionsList(
          'alarm',
          [...new Set([1, 3, 5, 10, 15, 30, snooze])].sort((a, b) => a - b),
          snooze,
          minutes => {
            setDropdown(null);
            savePreferences({ snoozeMinutes: minutes });
          },
        )}
        <SettingRow
          colors={colors}
          icon="calendar-outline"
          label="Date-Only Task Snooze"
          subtitle="Snooze length for date-only tasks (they remind every 3 hours). Saved on this device."
          testID="settings-date-snooze"
          disabled={saving || !localLoaded}
          onPress={() => setDropdown(dropdown === 'date' ? null : 'date')}
        >
          {selector('date', formatSnooze(dateSnooze))}
        </SettingRow>
        {optionsList(
          'date',
          DATE_ONLY_SNOOZE_OPTIONS,
          dateSnooze,
          saveDateSnooze,
        )}
        {saving ? (
          <ActivityIndicator
            testID="settings-saving"
            color={colors.accent}
            style={styles.saving}
          />
        ) : null}
        {section('Security')}
        <TouchableOpacity
          testID="settings-logout"
          accessibilityRole="button"
          accessibilityLabel="Logout"
          onPress={logout}
          disabled={saving}
          activeOpacity={0.85}
          style={[styles.logoutButton, saving && styles.disabled]}
        >
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
          <Text style={styles.logoutText}>LOGOUT</Text>
        </TouchableOpacity>
        <SettingRow
          colors={colors}
          icon="lock-closed-outline"
          label="Change Password"
          testID="settings-change-password"
          disabled={saving}
          onPress={() => navigation.navigate('ChangePasswordScreen')}
        />
        {section('Location')}
        <SettingRow
          colors={colors}
          icon="location-outline"
          label="Live Location & Alerts"
          onPress={() => setShowLocation(value => !value)}
        >
          <Ionicons
            name={showLocation ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.muted}
          />
        </SettingRow>
        {showLocation ? <LiveLocationCard /> : null}
      </ScrollView>
      <View
        style={[
          styles.bottom,
          { backgroundColor: isDark ? '#18271F' : '#35483D' },
        ]}
      >
        {[
          ['home-outline', 'HomeDashboard', 'Home'],
          ['people-outline', 'ContactScreen', 'Contacts'],
          ['time-outline', 'HistoryScreen', 'History'],
          ['settings', 'SettingScreen', 'Settings'],
        ].map(([icon, route, label]) => (
          <TouchableOpacity
            key={route}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: route === 'SettingScreen' }}
            onPress={() => navigation.navigate(route)}
            style={styles.tab}
          >
            <View
              style={[
                styles.tabIcon,
                route === 'SettingScreen' && styles.activeTab,
              ]}
            >
              <Ionicons name={icon} size={22} color="#F2F6EE" />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};
export default SettingScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: { paddingHorizontal: 32, paddingVertical: 7, borderRadius: 9 },
  headerTitle: { fontSize: 19, fontWeight: '700', letterSpacing: 0.4 },
  content: { paddingHorizontal: 18, paddingBottom: 24 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 22, marginBottom: 12 },
  profile: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 7,
    minHeight: 94,
  },
  avatar: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileCopy: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  profileDetail: { fontSize: 13, lineHeight: 19, flexShrink: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderWidth: 1,
    borderRadius: 13,
    marginBottom: 7,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  selection: { fontSize: 13, maxWidth: 78, textAlign: 'right' },
  options: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: -3,
    marginBottom: 9,
    paddingHorizontal: 15,
  },
  option: {
    minHeight: 45,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 54,
    padding: 14,
    borderRadius: 13,
    marginBottom: 7,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  disabled: { opacity: 0.55 },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 10,
  },
  retry: { fontWeight: '700', paddingVertical: 12 },
  error: { padding: 12 },
  saving: { marginVertical: 5 },
  bottom: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10 },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  tabIcon: { padding: 10, borderRadius: 15 },
  activeTab: { backgroundColor: '#5B7564' },
});
