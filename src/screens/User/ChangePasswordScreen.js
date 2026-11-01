import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiClient } from '../../utils/apiClient';
import { useTheme } from '../../context/ThemeContext';

const ChangePasswordScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const [values, setValues] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState(false);
  const request = useRef(null);
  const alive = useRef(true);
  const busy = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, []);
  const colors = isDark
    ? {
        bg: '#17231F',
        card: '#26352E',
        text: '#F0F5F1',
        muted: '#ADBEB3',
        border: '#536359',
      }
    : {
        bg: '#DFE8DD',
        card: '#F5F2E8',
        text: '#26382F',
        muted: '#66766B',
        border: '#C1CDBE',
      };
  const submit = async () => {
    if (busy.current) return;
    if (
      !values.currentPassword ||
      values.newPassword.length < 8 ||
      values.newPassword.length > 128 ||
      values.currentPassword.length > 128
    ) {
      Alert.alert(
        'Change Password',
        'Enter your current password and a new password of 8–128 characters.',
      );
      return;
    }
    if (values.newPassword !== values.confirmPassword) {
      Alert.alert('Change Password', 'New passwords do not match.');
      return;
    }
    if (values.newPassword === values.currentPassword) {
      Alert.alert('Change Password', 'Choose a different new password.');
      return;
    }
    busy.current = true;
    setSaving(true);
    request.current = new AbortController();
    try {
      await apiClient('/Account/change-password', {
        method: 'POST',
        body: JSON.stringify(values),
        signal: request.current.signal,
      });
      if (!alive.current) return;
      setValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
      Alert.alert(
        'Password Changed',
        'Your password has been updated. Other existing sessions are not automatically signed out.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (failure) {
      if (alive.current) Alert.alert('Change Password', failure.message);
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  };
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={23} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.heading, { color: colors.text }]}>
          Change Password
        </Text>
      </View>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Text style={[styles.hint, { color: colors.muted }]}>
            Use your current password to choose a new one. Your password must
            contain 8–128 characters.
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {[
              ['currentPassword', 'Current Password'],
              ['newPassword', 'New Password'],
              ['confirmPassword', 'Confirm New Password'],
            ].map(([field, label]) => (
              <View key={field} style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {label}
                </Text>
                <TextInput
                  testID={`password-${field}`}
                  accessibilityLabel={label}
                  value={values[field]}
                  onChangeText={text =>
                    setValues(previous => ({ ...previous, [field]: text }))
                  }
                  editable={!saving}
                  secureTextEntry={!show}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={128}
                  autoComplete={
                    field === 'currentPassword'
                      ? 'current-password'
                      : 'new-password'
                  }
                  textContentType={
                    field === 'currentPassword' ? 'password' : 'newPassword'
                  }
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border },
                  ]}
                />
              </View>
            ))}
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setShow(value => !value)}
              style={styles.visibility}
            >
              <Ionicons
                name={show ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.text}
              />
              <Text style={{ color: colors.text }}>
                {show ? 'Hide passwords' : 'Show passwords'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            testID="password-submit"
            accessibilityRole="button"
            accessibilityLabel="Update password"
            disabled={saving}
            onPress={submit}
            style={[styles.button, saving && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Update Password</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
export default ChangePasswordScreen;
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  back: { padding: 10 },
  heading: { fontWeight: '700', fontSize: 20 },
  content: { padding: 20 },
  hint: { lineHeight: 21, marginBottom: 20 },
  card: { padding: 18, borderRadius: 15 },
  field: { marginBottom: 17 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    minHeight: 48,
    padding: 12,
    borderRadius: 9,
    borderWidth: 1,
    fontSize: 16,
  },
  visibility: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 44,
  },
  button: {
    backgroundColor: '#416D59',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginTop: 22,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.6 },
});
