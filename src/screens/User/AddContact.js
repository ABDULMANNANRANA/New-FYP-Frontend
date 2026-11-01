import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BASE_URL } from '../../config/api';
import { useTheme } from '../../context/ThemeContext';

const goToLogin = navigation => {
  navigation.reset({
    index: 0,
    routes: [
      {
        name: 'AuthStack',
        state: {
          routes: [{ name: 'Login' }],
        },
      },
    ],
  });
};

/**
 * Robust response parser.
 *
 * Why this matters: when the backend throws an unexpected exception
 * (for example a missing SQL table), ASP.NET may return an HTML
 * developer-exception page or plain text instead of JSON. The previous
 * code silently swallowed that into `{}` and the user always saw the
 * generic "Unable to save this contact." message with no hint about the
 * real problem. We now surface the real text.
 */
const parseResponseSafely = async response => {
  try {
    const text = await response.text();
    if (!text) return { data: null, rawText: '' };

    // Try JSON first (the expected case)
    try {
      return { data: JSON.parse(text), rawText: text };
    } catch {
      // Not JSON - return raw text so the caller can show it
      return { data: null, rawText: text };
    }
  } catch (e) {
    return { data: null, rawText: '' };
  }
};

const AddContact = ({ navigation }) => {
  const { isDark, theme } = useTheme();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const bgColor = theme?.bg || (isDark ? '#111827' : '#F8FAFC');
  const cardBg = theme?.card || (isDark ? '#1F2937' : '#FFFFFF');
  const textColor = theme?.text || (isDark ? '#F8FAFC' : '#0F172A');
  const mutedColor = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#334155' : '#E2E8F0';
  const primaryColor = isDark ? '#38BDF8' : '#2563EB';

  const saveContact = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      Alert.alert('Name required', 'Enter a name for this contact.');
      return;
    }

    if (!trimmedPhone) {
      Alert.alert('Phone number required', 'Enter a phone number for this contact.');
      return;
    }

    // Basic phone validation - must contain at least 4 digits
    const phoneDigits = trimmedPhone.replace(/\D/g, '');
    if (phoneDigits.length < 4) {
      Alert.alert('Invalid phone number', 'Please enter a valid phone number.');
      return;
    }

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert('Session expired', 'Please log in again.', [
          { text: 'OK', onPress: () => goToLogin(navigation) },
        ]);
        return;
      }

      let response;
      try {
        response = await fetch(`${BASE_URL}/User/contacts`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: trimmedName, phone: trimmedPhone }),
        });
      } catch (networkErr) {
        // fetch() only rejects on true network failures (DNS, no route,
        // TLS error, timeout). Surface a clear message so the user knows
        // it's a connection issue, not a data issue.
        const lowerMsg = (networkErr?.message || '').toLowerCase();
        const isNet =
          lowerMsg.includes('network') ||
          lowerMsg.includes('failed to fetch') ||
          lowerMsg.includes('network request failed');

        const msg = isNet
          ? `Could not reach the server. Check your Wi-Fi / mobile data and verify the backend is running at ${BASE_URL}.`
          : networkErr?.message ||
            'Check your network connection and the backend API address.';
        throw new Error(msg);
      }

      const { data, rawText } = await parseResponseSafely(response);

      if (response.status === 401) {
        await AsyncStorage.removeItem('token');
        Alert.alert('Session expired', 'Please log in again.', [
          { text: 'OK', onPress: () => goToLogin(navigation) },
        ]);
        return;
      }

      // ---- Success path (HTTP 2xx with success === true) ----
      if (response.ok && data && data.success === true) {
        Alert.alert(
          'Contact saved',
          `${trimmedName} was added to your contacts.`,
          [{ text: 'Done', onPress: () => navigation.goBack() }],
        );
        return;
      }

      // ---- Error path ----
      // 1) Prefer a JSON message from the server.
      // 2) If the body is non-JSON (e.g. HTML dev-error page), show a
      //    stripped snippet of the body.
      // 3) Otherwise, use a status-specific friendly message.
      let serverMessage = data?.message || data?.error || data?.title || data?.detail;

      if (!serverMessage && typeof rawText === 'string' && rawText.length > 0) {
        // Strip HTML tags so a dev-exception page is still readable.
        const stripped = rawText
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        serverMessage =
          stripped.length > 300 ? stripped.substring(0, 300) + '…' : stripped;
      }

      let friendlyMessage = serverMessage;
      if (!friendlyMessage) {
        switch (response.status) {
          case 400:
            friendlyMessage = 'The contact details you entered are invalid.';
            break;
          case 404:
            friendlyMessage = 'The contacts service is not available right now.';
            break;
          case 409:
            friendlyMessage = 'A contact with this phone number already exists.';
            break;
          case 500:
            friendlyMessage =
              'The server could not save the contact. The PersonalContacts table may be missing in the database - run the EF migration or the included SQL script.';
            break;
          default:
            friendlyMessage = `Unable to save this contact (HTTP ${response.status}).`;
        }
      }

      throw new Error(friendlyMessage);
    } catch (error) {
      Alert.alert(
        'Could not save contact',
        error?.message || 'Please check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={bgColor}
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon name="arrow-back" size={23} color={textColor} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: textColor }]}>Add Contact</Text>

          <TouchableOpacity
            style={styles.saveHeaderButton}
            onPress={saveContact}
            disabled={saving}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Save contact"
          >
            {saving ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <Text style={[styles.saveHeaderText, { color: primaryColor }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileSection}>
            <View style={[styles.avatar, { backgroundColor: primaryColor }]}>
              {initial ? (
                <Text style={styles.avatarText}>{initial}</Text>
              ) : (
                <Icon name="person" size={34} color="#FFFFFF" />
              )}
            </View>
            <Text style={[styles.profileTitle, { color: textColor }]}>New contact</Text>
            <Text style={[styles.profileSubtitle, { color: mutedColor }]}>
              Add a name and phone number to your contacts.
            </Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.fieldRow}>
              <Icon name="person-outline" size={21} color={mutedColor} />
              <View style={styles.fieldContent}>
                <Text style={[styles.fieldLabel, { color: mutedColor }]}>Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Full name"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  style={[styles.input, { color: textColor }]}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={150}
                  returnKeyType="next"
                  accessibilityLabel="Contact name"
                />
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <View style={styles.fieldRow}>
              <Icon name="call-outline" size={21} color={mutedColor} />
              <View style={styles.fieldContent}>
                <Text style={[styles.fieldLabel, { color: mutedColor }]}>Phone</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone number"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  style={[styles.input, { color: textColor }]}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  maxLength={20}
                  returnKeyType="done"
                  onSubmitEditing={saveContact}
                  accessibilityLabel="Contact phone number"
                />
              </View>
            </View>
          </View>

          <View style={styles.privacyNote}>
            <Icon name="lock-closed-outline" size={16} color={mutedColor} />
            <Text style={[styles.privacyText, { color: mutedColor }]}>
              This contact is saved to your account and can be selected when you create a group.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AddContact;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoider: {
    flex: 1,
  },
  header: {
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    width: 54,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  saveHeaderButton: {
    width: 54,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  saveHeaderText: {
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
  },
  profileTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  profileSubtitle: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 17,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  fieldRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  fieldContent: {
    flex: 1,
    paddingVertical: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    padding: 0,
    fontSize: 16,
    minHeight: 25,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 36,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 4,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
