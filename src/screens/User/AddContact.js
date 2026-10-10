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

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert('Session expired', 'Please log in again.', [
          { text: 'OK', onPress: () => goToLogin(navigation) },
        ]);
        return;
      }

      const response = await fetch(`${BASE_URL}/User/contacts`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmedName, phone: trimmedPhone }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch (error) {
        // Keep the error message below useful when the API returns no JSON.
      }

      if (response.status === 401) {
        Alert.alert('Session expired', 'Please log in again.', [
          { text: 'OK', onPress: () => goToLogin(navigation) },
        ]);
        return;
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Unable to save this contact.');
      }

      Alert.alert(
        'Contact saved',
        `${trimmedName} was added to your contacts.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
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
