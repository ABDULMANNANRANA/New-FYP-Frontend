import React, { useState, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../config/api';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

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

const CreateGroup = ({ navigation }) => {
  const { isDark, theme } = useTheme();

  // WhatsApp style flow:
  // Step 1 = Select Members
  // Step 2 = Enter Group Name
  const [step, setStep] = useState('members');

  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState([]);

  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');

  const [existingContacts, setExistingContacts] = useState([]);
  const [showContacts, setShowContacts] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const [loading, setLoading] = useState(false);

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('token');

    if (!token) {
      return null;
    }

    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  // ============================================================
  // FETCH EXISTING CONTACTS
  // ============================================================
  const fetchExistingContacts = useCallback(async () => {
    try {
      setLoadingContacts(true);

      const headers = await getAuthHeaders();

      if (!headers) {
        Alert.alert('Session Expired', 'Please login again.', [
          {
            text: 'OK',
            onPress: () => goToLogin(navigation),
          },
        ]);
        return;
      }

      const [groupsResult, contactsResult] = await Promise.allSettled([
        fetch(`${BASE_URL}/User/groups`, { method: 'GET', headers }),
        fetch(`${BASE_URL}/User/contacts`, { method: 'GET', headers }),
      ]);

      const groupsResponse =
        groupsResult.status === 'fulfilled' ? groupsResult.value : null;
      const contactsResponse =
        contactsResult.status === 'fulfilled' ? contactsResult.value : null;

      const readJson = async response => {
        if (!response) return {};
        try {
          return await response.json();
        } catch (error) {
          return {};
        }
      };

      const [res, savedContactsRes] = await Promise.all([
        readJson(groupsResponse),
        readJson(contactsResponse),
      ]);

      if (groupsResponse?.status === 401 || contactsResponse?.status === 401) {
        Alert.alert('Session Expired', 'Please login again.', [
          {
            text: 'OK',
            onPress: () => goToLogin(navigation),
          },
        ]);
        return;
      }

      const groupsAvailable = !!groupsResponse?.ok && !!res?.success;
      const contactsAvailable =
        !!contactsResponse?.ok && !!savedContactsRes?.success;

      if (!groupsAvailable && !contactsAvailable) {
        const requestError =
          groupsResult.status === 'rejected'
            ? groupsResult.reason
            : contactsResult.status === 'rejected'
              ? contactsResult.reason
              : null;
        throw new Error(
          res?.message ||
            savedContactsRes?.message ||
            requestError?.message ||
            'Unable to fetch your contacts.',
        );
      }

      const responseGroups = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.groups)
          ? res.groups
          : [];
      const personalContacts = Array.isArray(savedContactsRes?.data)
        ? savedContactsRes.data
        : Array.isArray(savedContactsRes?.contacts)
          ? savedContactsRes.contacts
          : [];

      const list = [];
      const contactIndexes = new Map();
      const addContact = contact => {
        const name = String(
          contact?.name ||
            contact?.displayName ||
            `${contact?.firstName || ''} ${contact?.lastName || ''}`,
        ).trim();
        const phone = String(contact?.phone || contact?.phoneNumber || '').trim();
        const userId = contact?.userId ?? contact?.UserId ?? null;

        if (!name || name.toLowerCase() === 'unknown') return;

        const phoneDigits = phone.replace(/\D/g, '');
        const key = phoneDigits
          ? `phone_${phoneDigits}`
          : userId != null
            ? `user_${userId}`
            : `name_${name.toLowerCase()}`;
        const existingIndex = contactIndexes.get(key);
        const isRegistered =
          !!contact?.isRegistered || (userId != null && !contact?.isPersonal);

        if (existingIndex !== undefined) {
          const existing = list[existingIndex];
          list[existingIndex] = {
            ...existing,
            id: existing.id ?? contact?.id,
            userId: existing.userId ?? (isRegistered ? userId : null),
            name: contact?.isPersonal ? name : existing.name,
            phone: existing.phone || phone,
            isRegistered: existing.isRegistered || isRegistered,
          };
          return;
        }

        contactIndexes.set(key, list.length);
        list.push({
          id: contact?.id ?? `contact_${userId || Date.now()}_${list.length}`,
          userId: isRegistered ? userId : null,
          name,
          phone,
          isRegistered,
          isExternal: !isRegistered,
        });
      };

      // Registered group members are included for forwarding/task features.
      responseGroups.forEach(group => {
        const groupMembers = Array.isArray(group?.members)
          ? group.members
          : Array.isArray(group?.Members)
            ? group.Members
            : [];
        groupMembers.forEach(member => addContact(member));
      });

      // Also let the WhatsApp-style group picker use contacts saved from the
      // Contact screen, including people who do not have an app account.
      personalContacts.forEach(contact =>
        addContact({ ...contact, isPersonal: true, isRegistered: false }),
      );

      setExistingContacts(list);
    } catch (error) {
      console.log('fetchExistingContacts error:', error);
      Alert.alert(
        'Error',
        error.message || 'Unable to fetch existing contacts.',
      );
    } finally {
      setLoadingContacts(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      fetchExistingContacts();
    }, [fetchExistingContacts])
  );

  // ============================================================
  // CHECK DUPLICATE MEMBER
  // ============================================================
  const isAlreadyAdded = (name, phone, userId = null) => {
    return members.some(member => {
      if (userId && member.userId) {
        return String(member.userId) === String(userId);
      }

      if (
        phone &&
        member.phone &&
        member.phone.trim() === phone.trim()
      ) {
        return true;
      }

      if (
        name &&
        member.name &&
        member.name.toLowerCase() === name.toLowerCase()
      ) {
        return true;
      }

      return false;
    });
  };

  // ============================================================
  // ADD MANUAL / EXTERNAL MEMBER
  // ============================================================
  const addMemberManually = () => {
    const trimmedName = memberName.trim();
    const trimmedPhone = memberPhone.trim();

    if (!trimmedName) {
      Alert.alert('Error', 'Please enter the member name.');
      return;
    }

    if (!trimmedPhone) {
      Alert.alert('Error', 'Please enter the phone number.');
      return;
    }

    if (isAlreadyAdded(trimmedName, trimmedPhone)) {
      Alert.alert(
        'Already Added',
        `${trimmedName} is already in the member list.`
      );
      return;
    }

    setMembers(prev => [
      ...prev,
      {
        id: `external_${Date.now()}`,
        userId: null,
        name: trimmedName,
        phone: trimmedPhone,
        isRegistered: false,
        isExternal: true,
      },
    ]);

    setMemberName('');
    setMemberPhone('');
  };

  // ============================================================
  // ADD A SAVED CONTACT OR REGISTERED MEMBER
  // ============================================================
  const addFromExisting = contact => {
    if (
      isAlreadyAdded(
        contact.name,
        contact.phone,
        contact.userId
      )
    ) {
      Alert.alert(
        'Already Added',
        `${contact.name} is already in the member list.`
      );
      return;
    }

    const isRegistered = !!contact.isRegistered && contact.userId != null;
    const contactId = contact.id || Date.now();

    setMembers(prev => [
      ...prev,
      {
        id: isRegistered
          ? `registered_${contact.userId}`
          : `saved_${contactId}`,
        userId: isRegistered ? contact.userId : null,
        name: contact.name,
        phone: contact.phone,
        isRegistered,
        isExternal: !isRegistered,
      },
    ]);

    setShowContacts(false);
  };

  // ============================================================
  // REMOVE MEMBER
  // ============================================================
  const removeMember = id => {
    setMembers(prev =>
      prev.filter(member => member.id !== id)
    );
  };

  // ============================================================
  // GO TO GROUP NAME STEP
  // ============================================================
  const goToGroupName = () => {
    if (members.length === 0) {
      Alert.alert(
        'Select Members',
        'Please select at least one member before continuing.'
      );
      return;
    }

    setShowContacts(false);
    setStep('name');
  };

  // ============================================================
  // CREATE GROUP
  // ============================================================
  const createGroup = async () => {
    const trimmedGroupName = groupName.trim();

    if (!trimmedGroupName) {
      Alert.alert(
        'Group Name Required',
        'Please enter a group name.'
      );
      return;
    }

    if (members.length === 0) {
      Alert.alert(
        'Members Required',
        'Please select at least one member.'
      );
      setStep('members');
      return;
    }

    try {
      setLoading(true);

      const headers = await getAuthHeaders();

      if (!headers) {
        Alert.alert(
          'Session Expired',
          'Please login again.',
          [
            {
              text: 'OK',
              onPress: () => goToLogin(navigation),
            },
          ]
        );
        return;
      }

      // Registered application users
      const memberUserIds = members
        .filter(
          member =>
            member.isRegistered &&
            member.userId !== null &&
            member.userId !== undefined
        )
        .map(member => Number(member.userId))
        .filter(id => !Number.isNaN(id));

      // External members manually added with name + phone
      const externalMembers = members
        .filter(
          member =>
            !member.isRegistered ||
            !member.userId
        )
        .map(member => ({
          name: member.name,
          phone: member.phone,
        }));

      const requestBody = {
        name: trimmedGroupName,
        memberUserIds,
        externalMembers,
      };

      console.log(
        'Create Group URL:',
        `${BASE_URL}/Managment/group`
      );

      console.log(
        'Create Group Body:',
        JSON.stringify(requestBody, null, 2)
      );

      const response = await fetch(
        `${BASE_URL}/Managment/group`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        }
      );

      console.log(
        'Create Group Status:',
        response.status
      );

      let res;

      try {
        res = await response.json();
      } catch (error) {
        throw new Error(
          'Invalid response received from server.'
        );
      }

      console.log(
        'Create Group Response:',
        res
      );

      if (response.status === 401) {
        Alert.alert(
          'Session Expired',
          'Please login again.',
          [
            {
              text: 'OK',
              onPress: () => goToLogin(navigation),
            },
          ]
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          res?.message ||
          `Failed to create group. Status: ${response.status}`
        );
      }

      if (res?.success) {
        Alert.alert(
          'Group Created!',
          `"${trimmedGroupName}" was created with ${members.length} member(s).`,
          [
            {
              text: 'Go to Home',
              onPress: () => {
                setGroupName('');
                setMembers([]);
                setMemberName('');
                setMemberPhone('');
                setShowContacts(false);
                setStep('members');

                navigation.navigate('HomeDashboard');
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Error',
          res?.message ||
          'Failed to create group.'
        );
      }
    } catch (error) {
      console.log(
        'createGroup error:',
        error
      );

      Alert.alert(
        'Error',
        error.message ||
        'Server not reachable.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // THEME
  // ============================================================
  const isDarkTheme =
    isDark || theme?.mode === 'dark';

  const cardBg =
    theme.card ||
    (isDarkTheme ? '#1E293B' : '#FFFFFF');

  const inputBg =
    isDarkTheme ? '#0F172A' : '#F1F5F9';

  const inputBorder =
    isDarkTheme ? '#334155' : '#E2E8F0';

  const textColor =
    theme.text ||
    (isDarkTheme ? '#F8FAFC' : '#0F172A');

  const subTextColor =
    isDarkTheme ? '#94A3B8' : '#64748B';

  const primaryColor =
    isDarkTheme ? '#38BDF8' : '#0284C7';

  const primaryBtnBg =
    isDarkTheme ? '#38BDF8' : '#0F172A';

  const primaryBtnText =
    isDarkTheme ? '#0F172A' : '#FFFFFF';

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor:
            theme.bg ||
            (isDarkTheme
              ? '#0F172A'
              : '#F8FAFC'),
        },
      ]}
    >
      <StatusBar
        barStyle={
          isDarkTheme
            ? 'light-content'
            : 'dark-content'
        }
        backgroundColor="transparent"
        translucent
      />

      {/* HEADER */}
      <View
        style={[
          styles.headerContainer,
          {
            borderBottomColor:
              inputBorder,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backIconButton}
          onPress={() => {
            if (step === 'name') {
              setStep('members');
            } else {
              navigation.goBack();
            }
          }}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
          }}
          activeOpacity={0.7}
        >
          <Icon
            name="arrow-back"
            size={22}
            color={textColor}
          />
        </TouchableOpacity>

        <View
          style={[
            styles.headerBox,
            {
              backgroundColor:
                theme.headerBox ||
                (isDarkTheme
                  ? '#1E293B'
                  : '#E2E8F0'),
            },
          ]}
        >
          <Text
            style={[
              styles.headerText,
              { color: textColor },
            ]}
          >
            NEW GROUP
          </Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================
            WHATSAPP STYLE PROGRESS
        ======================================================== */}
        <View style={styles.progressContainer}>
          <View style={styles.progressRow}>
            {['1', '2'].map((number, index) => {
              const isActive =
                (step === 'members' &&
                  index === 0) ||
                (step === 'name' &&
                  index <= 1);

              return (
                <React.Fragment key={number}>
                  <View
                    style={[
                      styles.dot,
                      isActive
                        ? {
                            backgroundColor:
                              primaryColor,
                            shadowColor:
                              primaryColor,
                          }
                        : styles.dotInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dotText,
                        {
                          color: isActive
                            ? '#FFFFFF'
                            : subTextColor,
                        },
                      ]}
                    >
                      {number}
                    </Text>
                  </View>

                  {index === 0 && (
                    <View
                      style={[
                        styles.dotLine,
                        step === 'name'
                          ? {
                              backgroundColor:
                                primaryColor,
                            }
                          : styles.dotLineInactive,
                      ]}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          <View style={styles.progressLabels}>
            <Text
              style={[
                styles.progressLabel,
                {
                  color:
                    step === 'members'
                      ? primaryColor
                      : subTextColor,
                },
              ]}
            >
              Select Members
            </Text>

            <Text
              style={[
                styles.progressLabel,
                {
                  color:
                    step === 'name'
                      ? primaryColor
                      : subTextColor,
                },
              ]}
            >
              Group Name
            </Text>
          </View>
        </View>

        {/* ========================================================
            STEP 1 - SELECT MEMBERS
        ======================================================== */}
        {step === 'members' && (
          <>
            <View style={styles.sectionHeaderBox}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: textColor },
                ]}
              >
                Add Group Members
              </Text>

              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: subTextColor },
                ]}
              >
                Select the people you want to add to this group.
              </Text>
            </View>

            {/* SELECTED MEMBERS TOP SUMMARY */}
            <View
              style={[
                styles.selectedSummary,
                {
                  backgroundColor: cardBg,
                  borderColor: inputBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.summaryIcon,
                  {
                    backgroundColor:
                      primaryColor + '20',
                  },
                ]}
              >
                <Icon
                  name="people"
                  size={22}
                  color={primaryColor}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.summaryTitle,
                    { color: textColor },
                  ]}
                >
                  {members.length} Member
                  {members.length === 1 ? '' : 's'} Selected
                </Text>

                <Text
                  style={[
                    styles.summaryText,
                    { color: subTextColor },
                  ]}
                >
                  {members.length > 0
                    ? 'Continue when you have selected everyone.'
                    : 'Select at least one member to continue.'}
                </Text>
              </View>
            </View>

            {/* EXISTING CONTACTS */}
            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                {
                  borderColor: primaryColor,
                  backgroundColor: cardBg,
                },
              ]}
              onPress={() =>
                setShowContacts(!showContacts)
              }
              activeOpacity={0.7}
            >
              <Icon
                name="people-outline"
                size={21}
                color={primaryColor}
              />

              <Text
                style={[
                  styles.secondaryBtnText,
                  { color: textColor },
                ]}
              >
                {showContacts
                  ? 'Hide Contacts'
                  : 'Select from Existing Contacts'}
              </Text>

              <Icon
                name={
                  showContacts
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={18}
                color={subTextColor}
              />
            </TouchableOpacity>

            {showContacts && (
              <View
                style={[
                  styles.contactDropdown,
                  {
                    backgroundColor: cardBg,
                    borderColor: inputBorder,
                  },
                ]}
              >
                {loadingContacts ? (
                  <ActivityIndicator
                    size="small"
                    color={primaryColor}
                    style={{ padding: 18 }}
                  />
                ) : existingContacts.length === 0 ? (
                  <Text
                    style={[
                      styles.emptyText,
                      { color: subTextColor },
                    ]}
                  >
                    No existing contacts found.
                  </Text>
                ) : (
                  existingContacts.map(
                    (contact, idx) => {
                      const selected = isAlreadyAdded(
                        contact.name,
                        contact.phone,
                        contact.userId,
                      );

                      return (
                        <TouchableOpacity
                          key={contact.id}
                          style={[
                            styles.contactRow,
                            idx !==
                              existingContacts.length -
                                1 && {
                              borderBottomColor:
                                inputBorder,
                            },
                          ]}
                          onPress={() => {
                            if (!selected) {
                              addFromExisting(
                                contact
                              );
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.contactAvatar,
                              {
                                backgroundColor:
                                  primaryColor +
                                  '20',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.avatarText,
                                {
                                  color:
                                    primaryColor,
                                },
                              ]}
                            >
                              {contact.name
                                ? contact.name
                                    .charAt(0)
                                    .toUpperCase()
                                : '?'}
                            </Text>
                          </View>

                          <View
                            style={{
                              flex: 1,
                              paddingRight: 8,
                            }}
                          >
                            <Text
                              style={[
                                styles.contactName,
                                { color: textColor },
                              ]}
                              numberOfLines={1}
                            >
                              {contact.name}
                            </Text>

                            {contact.phone ? (
                              <Text
                                style={[
                                  styles.contactPhone,
                                  {
                                    color:
                                      subTextColor,
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {contact.phone}
                              </Text>
                            ) : null}
                          </View>

                          <Icon
                            name={
                              selected
                                ? 'checkmark-circle'
                                : 'add-circle-outline'
                            }
                            size={25}
                            color={
                              selected
                                ? '#22C55E'
                                : primaryColor
                            }
                          />
                        </TouchableOpacity>
                      );
                    }
                  )
                )}
              </View>
            )}

            {/* MANUAL MEMBER */}
            <View
              style={[
                styles.card,
                { backgroundColor: cardBg },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  { color: textColor },
                ]}
              >
                Add Person Manually
              </Text>

              <TextInput
                value={memberName}
                onChangeText={setMemberName}
                placeholder="Member Name"
                placeholderTextColor="#94A3B8"
                style={[
                  styles.input,
                  {
                    color: textColor,
                    backgroundColor: inputBg,
                    borderColor: inputBorder,
                    marginBottom: 12,
                  },
                ]}
              />

              <TextInput
                value={memberPhone}
                onChangeText={setMemberPhone}
                placeholder="Phone e.g. 03001234567"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                style={[
                  styles.input,
                  {
                    color: textColor,
                    backgroundColor: inputBg,
                    borderColor: inputBorder,
                    marginBottom: 14,
                  },
                ]}
              />

              <TouchableOpacity
                style={[
                  styles.addMemberBtn,
                  {
                    backgroundColor:
                      primaryColor,
                  },
                ]}
                onPress={addMemberManually}
                activeOpacity={0.8}
              >
                <Icon
                  name="person-add"
                  size={17}
                  color="#FFFFFF"
                />

                <Text
                  style={styles.addMemberBtnText}
                >
                  Add Member
                </Text>
              </TouchableOpacity>
            </View>

            {/* SELECTED MEMBERS */}
            {members.length > 0 && (
              <View style={styles.membersSection}>
                <Text
                  style={[
                    styles.memberListTitle,
                    { color: textColor },
                  ]}
                >
                  Selected Members ({members.length})
                </Text>

                {members.map(member => (
                  <View
                    key={member.id}
                    style={[
                      styles.memberRow,
                      {
                        backgroundColor: cardBg,
                        borderColor: inputBorder,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.memberAvatar,
                        {
                          backgroundColor:
                            isDarkTheme
                              ? '#334155'
                              : '#E2E8F0',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          { color: textColor },
                        ]}
                      >
                        {member.name
                          ? member.name
                              .charAt(0)
                              .toUpperCase()
                          : '?'}
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        paddingRight: 8,
                      }}
                    >
                      <Text
                        style={[
                          styles.memberName,
                          { color: textColor },
                        ]}
                        numberOfLines={1}
                      >
                        {member.name}
                      </Text>

                      <Text
                        style={[
                          styles.memberPhone,
                          { color: subTextColor },
                        ]}
                        numberOfLines={1}
                      >
                        {member.phone ||
                          (member.isRegistered
                            ? 'Registered member'
                            : 'External member')}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() =>
                        removeMember(member.id)
                      }
                      hitSlop={{
                        top: 10,
                        bottom: 10,
                        left: 10,
                        right: 10,
                      }}
                      activeOpacity={0.7}
                    >
                      <Icon
                        name="close-circle"
                        size={22}
                        color="#EF4444"
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* EMPTY STATE */}
            {members.length === 0 && (
              <View
                style={[
                  styles.emptyMembers,
                  {
                    backgroundColor: cardBg,
                    borderColor: inputBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.emptyIconBg,
                    {
                      backgroundColor:
                        isDarkTheme
                          ? '#1E293B'
                          : '#F1F5F9',
                    },
                  ]}
                >
                  <Icon
                    name="people-outline"
                    size={32}
                    color={subTextColor}
                  />
                </View>

                <Text
                  style={[
                    styles.emptyMembersTitle,
                    { color: textColor },
                  ]}
                >
                  No members selected
                </Text>

                <Text
                  style={[
                    styles.emptyMembersText,
                    { color: subTextColor },
                  ]}
                >
                  Select existing contacts or add someone manually.
                </Text>
              </View>
            )}

            {/* NEXT BUTTON */}
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                {
                  backgroundColor:
                    primaryBtnBg,
                },
                members.length === 0 &&
                  styles.btnDisabled,
              ]}
              onPress={goToGroupName}
              disabled={members.length === 0}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.primaryBtnText,
                  { color: primaryBtnText },
                ]}
              >
                NEXT: GROUP NAME
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ========================================================
            STEP 2 - GROUP NAME
        ======================================================== */}
        {step === 'name' && (
          <>
            <View style={styles.sectionHeaderBox}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: textColor },
                ]}
              >
                Group Details
              </Text>

              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: subTextColor },
                ]}
              >
                Choose a name for your new group.
              </Text>
            </View>

            {/* SELECTED MEMBERS PREVIEW */}
            <View
              style={[
                styles.previewCard,
                {
                  backgroundColor: cardBg,
                  borderColor: inputBorder,
                },
              ]}
            >
              <View
                style={styles.previewHeader}
              >
                <View
                  style={[
                    styles.summaryIcon,
                    {
                      backgroundColor:
                        primaryColor + '20',
                    },
                  ]}
                >
                  <Icon
                    name="people"
                    size={21}
                    color={primaryColor}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.summaryTitle,
                      { color: textColor },
                    ]}
                  >
                    {members.length} Member
                    {members.length === 1
                      ? ''
                      : 's'}
                  </Text>

                  <Text
                    style={[
                      styles.summaryText,
                      { color: subTextColor },
                    ]}
                  >
                    Added to this group
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() =>
                    setStep('members')
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.changeText,
                      { color: primaryColor },
                    ]}
                  >
                    Change
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.previewMembers,
                  {
                    borderTopColor:
                      inputBorder,
                  },
                ]}
              >
                {members.slice(0, 5).map(member => (
                  <View
                    key={member.id}
                    style={styles.previewMember}
                  >
                    <View
                      style={[
                        styles.smallAvatar,
                        {
                          backgroundColor:
                            primaryColor + '20',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.smallAvatarText,
                          {
                            color:
                              primaryColor,
                          },
                        ]}
                      >
                        {member.name
                          ? member.name
                              .charAt(0)
                              .toUpperCase()
                          : '?'}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.previewMemberName,
                        { color: textColor },
                      ]}
                      numberOfLines={1}
                    >
                      {member.name}
                    </Text>
                  </View>
                ))}

                {members.length > 5 && (
                  <View
                    style={[
                      styles.moreMembers,
                      {
                        backgroundColor:
                          inputBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.moreMembersText,
                        { color: subTextColor },
                      ]}
                    >
                      +{members.length - 5}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* GROUP NAME CARD */}
            <View
              style={[
                styles.card,
                { backgroundColor: cardBg },
              ]}
            >
              <View
                style={styles.groupIconContainer}
              >
                <View
                  style={[
                    styles.groupIcon,
                    {
                      backgroundColor:
                        primaryColor + '20',
                    },
                  ]}
                >
                  <Icon
                    name="people"
                    size={34}
                    color={primaryColor}
                  />
                </View>
              </View>

              <Text
                style={[
                  styles.cardHeaderTitle,
                  {
                    color: textColor,
                    textAlign: 'center',
                  },
                ]}
              >
                Name Your Group
              </Text>

              <Text
                style={[
                  styles.cardSubTitle,
                  {
                    color: subTextColor,
                    textAlign: 'center',
                  },
                ]}
              >
                Enter a name that everyone in the group can recognize.
              </Text>

              <Text
                style={[
                  styles.fieldLabel,
                  { color: textColor },
                ]}
              >
                Group Name
              </Text>

              <TextInput
                value={groupName}
                onChangeText={setGroupName}
                placeholder="e.g. Family, FYP, Friends..."
                placeholderTextColor="#94A3B8"
                style={[
                  styles.input,
                  {
                    color: textColor,
                    backgroundColor: inputBg,
                    borderColor: inputBorder,
                  },
                ]}
                autoFocus
                maxLength={50}
              />

              <Text
                style={[
                  styles.characterCount,
                  { color: subTextColor },
                ]}
              >
                {groupName.length}/50
              </Text>
            </View>

            {/* ACTION BUTTONS */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.backBtn,
                  {
                    borderColor: inputBorder,
                    backgroundColor: cardBg,
                  },
                ]}
                onPress={() =>
                  setStep('members')
                }
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.backBtnText,
                    { color: textColor },
                  ]}
                >
                  ← Members
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  {
                    flex: 1,
                    marginLeft: 12,
                    marginTop: 0,
                    backgroundColor:
                      primaryBtnBg,
                  },
                  (!groupName.trim() ||
                    loading) &&
                    styles.btnDisabled,
                ]}
                onPress={createGroup}
                disabled={
                  !groupName.trim() ||
                  loading
                }
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator
                    color={primaryBtnText}
                    size="small"
                  />
                ) : (
                  <View
                    style={styles.createButtonContent}
                  >
                    <Icon
                      name="checkmark-circle"
                      size={19}
                      color={primaryBtnText}
                    />

                    <Text
                      style={[
                        styles.primaryBtnText,
                        {
                          color:
                            primaryBtnText,
                          marginLeft: 7,
                        },
                      ]}
                    >
                      CREATE GROUP
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* BOTTOM NAVIGATION */}
      <View
        style={[
          styles.bottom,
          {
            backgroundColor:
              theme.bottomNav ||
              (isDarkTheme
                ? '#0F172A'
                : '#1E293B'),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            navigation.navigate(
              'HomeDashboard'
            )
          }
          activeOpacity={0.7}
        >
          <Icon
            name="home"
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            navigation.navigate('AddMember')
          }
          activeOpacity={0.7}
        >
          <Icon
            name="person-add"
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            navigation.navigate(
              'TimeBasedHistoryScreen'
            )
          }
          activeOpacity={0.7}
        >
          <Icon
            name="time"
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            navigation.navigate(
              'SettingScreen'
            )
          }
          activeOpacity={0.7}
        >
          <Icon
            name="settings"
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default CreateGroup;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  headerContainer: {
    paddingTop:
      Platform.OS === 'android'
        ? (StatusBar.currentHeight || 24) + 8
        : 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    zIndex: 10,
  },

  backIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerBox: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },

  headerText: {
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.8,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },

  progressContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },

  dotInactive: {
    backgroundColor: '#CBD5E1',
  },

  dotText: {
    fontWeight: '700',
    fontSize: 13,
  },

  dotLine: {
    width: width * 0.2,
    height: 3,
    borderRadius: 2,
    marginHorizontal: 8,
  },

  dotLineInactive: {
    backgroundColor: '#CBD5E1',
  },

  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: width * 0.68,
  },

  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
  },

  sectionHeaderBox: {
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },

  sectionSubtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 19,
  },

  selectedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },

  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
  },

  summaryText: {
    fontSize: 12,
    marginTop: 2,
  },

  changeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },

  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },

  cardSubTitle: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },

  cardTitle: {
    fontWeight: '700',
    marginBottom: 12,
    fontSize: 14,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },

  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    borderWidth: 1,
  },

  characterCount: {
    fontSize: 10,
    textAlign: 'right',
    marginTop: 5,
  },

  primaryBtn: {
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  primaryBtnText: {
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },

  createButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnDisabled: {
    opacity: 0.5,
  },

  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    height: 44,
  },

  addMemberBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 6,
  },

  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 12,
  },

  secondaryBtnText: {
    flex: 1,
    marginLeft: 10,
    fontWeight: '600',
    fontSize: 13,
  },

  contactDropdown: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },

  contactAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  avatarText: {
    fontWeight: '700',
    fontSize: 14,
  },

  contactName: {
    fontWeight: '600',
    fontSize: 13,
  },

  contactPhone: {
    fontSize: 11,
    marginTop: 2,
  },

  emptyText: {
    textAlign: 'center',
    padding: 16,
    fontSize: 13,
  },

  membersSection: {
    marginTop: 4,
    marginBottom: 16,
  },

  memberListTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },

  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  memberName: {
    fontWeight: '600',
    fontSize: 13,
  },

  memberPhone: {
    fontSize: 11,
    marginTop: 2,
  },

  deleteButton: {
    padding: 6,
  },

  emptyMembers: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  emptyIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  emptyMembersTitle: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 4,
  },

  emptyMembersText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },

  previewCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },

  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },

  previewMembers: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: 12,
    borderTopWidth: 1,
  },

  previewMember: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 6,
    maxWidth: width * 0.38,
  },

  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },

  smallAvatarText: {
    fontSize: 11,
    fontWeight: '700',
  },

  previewMemberName: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },

  moreMembers: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  moreMembersText: {
    fontSize: 11,
    fontWeight: '700',
  },

  groupIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  groupIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },

  backBtn: {
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  backBtnText: {
    fontWeight: '600',
    fontSize: 13,
  },

  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height:
      Platform.OS === 'ios'
        ? 74
        : 60,
    paddingBottom:
      Platform.OS === 'ios'
        ? 16
        : 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  iconBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
});







































// import React, { useState, useCallback } from 'react';
// import {
//   SafeAreaView,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
//   Alert,
//   ActivityIndicator,
// } from 'react-native';
// import Icon from '@react-native-vector-icons/ionicons';
// import { useFocusEffect } from '@react-navigation/native';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { BASE_URL } from '../../config/api';
// import { useTheme } from '../../context/ThemeContext';

// // ============================================================
// // Helper: reset navigation to the Login screen inside AuthStack.
// // 'Login' is NOT a screen in the root navigator (only 'AuthStack'
// // and 'MainStack' are), so navigation.replace('Login') from
// // anywhere inside MainStack throws:
// //   "The action 'REPLACE' with payload {"name":"Login"} was not
// //    handled by any navigator."
// // ============================================================
// const goToLogin = navigation => {
//   navigation.reset({
//     index: 0,
//     routes: [
//       {
//         name: 'AuthStack',
//         state: {
//           routes: [{ name: 'Login' }],
//         },
//       },
//     ],
//   });
// };

// const CreateGroup = ({ navigation }) => {
//   const { isDark, theme } = useTheme();

//   // ── Step state: 'name' | 'members' ────────────────────────────────
//   const [step, setStep] = useState('name');

//   // Group name
//   const [groupName, setGroupName] = useState('');

//   // Members list
//   const [members, setMembers] = useState([]);

//   // Fields for adding a new member manually
//   const [memberName, setMemberName] = useState('');
//   const [memberPhone, setMemberPhone] = useState('');

//   // Existing contacts
//   const [existingContacts, setExistingContacts] = useState([]);
//   const [showContacts, setShowContacts] = useState(false);
//   const [loadingContacts, setLoadingContacts] = useState(false);

//   // Submit loading
//   const [loading, setLoading] = useState(false);

//   // ─────────────────────────────────────────────────────────────────
//   // GET AUTH HEADERS
//   // ─────────────────────────────────────────────────────────────────
//   const getAuthHeaders = async () => {
//     // IMPORTANT: LoginScreen saves the token under the key "token"
//     // (AsyncStorage.setItem("token", userData.token)). This was
//     // previously reading "jwtToken", a key that is never written
//     // anywhere, so this always returned null — triggering
//     // "Session Expired" immediately, even right after login.
//     const token = await AsyncStorage.getItem('token');

//     if (!token) {
//       return null;
//     }

//     return {
//       Authorization: `Bearer ${token}`,
//       'Content-Type': 'application/json',
//     };
//   };

//   // ─────────────────────────────────────────────────────────────────
//   // FETCH EXISTING CONTACTS
//   // ─────────────────────────────────────────────────────────────────
//   const fetchExistingContacts = useCallback(async () => {
//     try {
//       setLoadingContacts(true);

//       const headers = await getAuthHeaders();

//       if (!headers) {
//         Alert.alert(
//           'Session Expired',
//           'Please login again.',
//           [
//             {
//               text: 'OK',
//               onPress: () => goToLogin(navigation),
//             },
//           ]
//         );
//         return;
//       }

//       // NOTE: correct route is "api/User/groups", not "api/groups"
//       // (which doesn't exist on the backend at all). This endpoint
//       // is also the only one that includes each group's members
//       // list, which this screen needs to build the contact list.
//       const response = await fetch(`${BASE_URL}/User/groups`, {
//         method: 'GET',
//         headers,
//       });

//       console.log('Fetch Groups Status:', response.status);

//       let res;

//       try {
//         res = await response.json();
//       } catch (jsonError) {
//         throw new Error('Invalid response received from server.');
//       }

//       console.log('Fetch Groups Response:', res);

//       // Unauthorized
//       if (response.status === 401) {
//         Alert.alert(
//           'Session Expired',
//           'Please login again.',
//           [
//             {
//               text: 'OK',
//               onPress: () => goToLogin(navigation),
//             },
//           ]
//         );
//         return;
//       }

//       if (!response.ok) {
//         throw new Error(
//           res?.message || `Failed to fetch groups. Status: ${response.status}`
//         );
//       }

//       if (res?.success) {
//         const seen = new Set();
//         const list = [];

//         (res.data || []).forEach(group => {
//           (group.members || []).forEach(member => {
//             const name =
//               member.displayName ||
//               member.name ||
//               '';

//             const phone = member.phone || '';

//             if (!name || name === 'Unknown') {
//               return;
//             }

//             const key = `${name}_${phone}`;

//             if (seen.has(key)) {
//               return;
//             }

//             seen.add(key);

//             list.push({
//               id: `ec_${member.id || Date.now()}_${group.id}`,
//               name,
//               phone,
//             });
//           });
//         });

//         setExistingContacts(list);
//       } else {
//         console.log(
//           'Fetch groups failed:',
//           res?.message || 'Unknown error'
//         );
//       }
//     } catch (error) {
//       console.log('fetchExistingContacts error:', error);

//       Alert.alert(
//         'Error',
//         error.message || 'Unable to fetch existing contacts.'
//       );
//     } finally {
//       setLoadingContacts(false);
//     }
//   }, [navigation]);

//   // Fetch contacts whenever screen gets focus
//   useFocusEffect(
//     useCallback(() => {
//       fetchExistingContacts();
//     }, [fetchExistingContacts])
//   );

//   // ─────────────────────────────────────────────────────────────────
//   // ADD MEMBER MANUALLY
//   // ─────────────────────────────────────────────────────────────────
//   const addMemberManually = () => {
//     const trimmedName = memberName.trim();
//     const trimmedPhone = memberPhone.trim();

//     if (!trimmedName) {
//       Alert.alert('Error', 'Please enter the member name.');
//       return;
//     }

//     if (!trimmedPhone) {
//       Alert.alert('Error', 'Please enter the phone number.');
//       return;
//     }

//     const duplicate = members.find(
//       member =>
//         member.phone === trimmedPhone ||
//         member.name.toLowerCase() === trimmedName.toLowerCase()
//     );

//     if (duplicate) {
//       Alert.alert(
//         'Already added',
//         `${trimmedName} is already in the member list.`
//       );
//       return;
//     }

//     setMembers(prev => [
//       ...prev,
//       {
//         id: Date.now().toString(),
//         name: trimmedName,
//         phone: trimmedPhone,
//       },
//     ]);

//     setMemberName('');
//     setMemberPhone('');
//   };

//   // ─────────────────────────────────────────────────────────────────
//   // ADD FROM EXISTING CONTACT
//   // ─────────────────────────────────────────────────────────────────
//   const addFromExisting = contact => {
//     const duplicate = members.find(
//       member =>
//         member.phone === contact.phone ||
//         member.name.toLowerCase() === contact.name.toLowerCase()
//     );

//     if (duplicate) {
//       Alert.alert(
//         'Already added',
//         `${contact.name} is already in the list.`
//       );
//       return;
//     }

//     setMembers(prev => [
//       ...prev,
//       {
//         ...contact,
//         id: Date.now().toString(),
//       },
//     ]);

//     setShowContacts(false);
//   };

//   // ─────────────────────────────────────────────────────────────────
//   // REMOVE MEMBER
//   // ─────────────────────────────────────────────────────────────────
//   const removeMember = id => {
//     setMembers(prev =>
//       prev.filter(member => member.id !== id)
//     );
//   };

//   // ─────────────────────────────────────────────────────────────────
//   // CREATE GROUP
//   // ─────────────────────────────────────────────────────────────────
//   const createGroup = async () => {
//     const trimmedGroupName = groupName.trim();

//     if (!trimmedGroupName) {
//       Alert.alert('Error', 'Please enter a group name.');
//       return;
//     }

//     try {
//       setLoading(true);

//       const headers = await getAuthHeaders();

//       if (!headers) {
//         Alert.alert(
//           'Session Expired',
//           'Please login again.',
//           [
//             {
//               text: 'OK',
//               onPress: () => goToLogin(navigation),
//             },
//           ]
//         );
//         return;
//       }

//       const requestBody = {
//         name: trimmedGroupName,
//         memberUserIds: [],
//         externalMembers: members.map(member => ({
//           name: member.name,
//           phone: member.phone,
//         })),
//       };

//       // NOTE: correct route is "api/Managment/group"
//       // (ManagmentController.CreateGroup), not "api/groups"
//       // which does not exist on the backend.
//       console.log('Create Group URL:', `${BASE_URL}/Managment/group`);
//       console.log('Create Group Body:', requestBody);

//       const response = await fetch(`${BASE_URL}/Managment/group`, {
//         method: 'POST',
//         headers,
//         body: JSON.stringify(requestBody),
//       });

//       console.log('Create Group Status:', response.status);

//       let res;

//       try {
//         res = await response.json();
//       } catch (jsonError) {
//         throw new Error('Invalid response received from server.');
//       }

//       console.log('Create Group Response:', res);

//       // Unauthorized
//       if (response.status === 401) {
//         Alert.alert(
//           'Session Expired',
//           'Please login again.',
//           [
//             {
//               text: 'OK',
//               onPress: () => goToLogin(navigation),
//             },
//           ]
//         );
//         return;
//       }

//       // Other HTTP errors
//       if (!response.ok) {
//         throw new Error(
//           res?.message ||
//           `Failed to create group. Status: ${response.status}`
//         );
//       }

//       // Successful response
//       if (res?.success) {
//         Alert.alert(
//           'Group Created!',
//           `"${trimmedGroupName}" was created with ${members.length} member(s).`,
//           [
//             {
//               text: 'Go to Home',
//               onPress: () =>
//                 navigation.navigate('HomeDashboard'),
//             },
//           ]
//         );

//         setGroupName('');
//         setMembers([]);
//         setMemberName('');
//         setMemberPhone('');
//         setShowContacts(false);
//         setStep('name');
//       } else {
//         Alert.alert(
//           'Error',
//           res?.message || 'Failed to create group.'
//         );
//       }
//     } catch (error) {
//       console.log('createGroup error:', error);

//       Alert.alert(
//         'Error',
//         error.message || 'Server not reachable.'
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ─────────────────────────────────────────────────────────────────
//   // RENDER
//   // ─────────────────────────────────────────────────────────────────
//   return (
//     <SafeAreaView
//       style={[
//         styles.container,
//         { backgroundColor: theme.bg },
//       ]}
//     >
//       <ScrollView
//         contentContainerStyle={styles.content}
//         keyboardShouldPersistTaps="handled"
//         showsVerticalScrollIndicator={false}
//       >
//         {/* HEADER */}
//         <View style={styles.header}>
//           <TouchableOpacity
//             onPress={() => navigation.goBack()}
//           >
//             <Icon
//               name="arrow-back"
//               size={22}
//               color={theme.text}
//             />
//           </TouchableOpacity>

//           <View
//             style={[
//               styles.headerBox,
//               { backgroundColor: theme.headerBox },
//             ]}
//           >
//             <Text
//               style={[
//                 styles.headerText,
//                 { color: theme.text },
//               ]}
//             >
//               CREATE GROUP
//             </Text>
//           </View>

//           <View style={{ width: 22 }} />
//         </View>

//         {/* PROGRESS DOTS */}
//         <View style={styles.progressRow}>
//           {['1', '2'].map((number, index) => (
//             <React.Fragment key={number}>
//               <View
//                 style={[
//                   styles.dot,
//                   (
//                     (step === 'name' && index === 0) ||
//                     (step === 'members' && index <= 1)
//                   )
//                     ? styles.dotActive
//                     : styles.dotInactive,
//                 ]}
//               >
//                 <Text style={styles.dotText}>
//                   {number}
//                 </Text>
//               </View>

//               {index === 0 && (
//                 <View
//                   style={[
//                     styles.dotLine,
//                     step === 'members' &&
//                       styles.dotLineActive,
//                   ]}
//                 />
//               )}
//             </React.Fragment>
//           ))}
//         </View>

//         <View style={styles.progressLabels}>
//           <Text
//             style={[
//               styles.progressLabel,
//               { color: theme.text },
//             ]}
//           >
//             Group Name
//           </Text>

//           <Text
//             style={[
//               styles.progressLabel,
//               { color: theme.text },
//             ]}
//           >
//             Add Members
//           </Text>
//         </View>

//         {/* ───────────────── STEP 1 ───────────────── */}
//         {step === 'name' && (
//           <>
//             <Text
//               style={[
//                 styles.sectionTitle,
//                 { color: theme.text },
//               ]}
//             >
//               Group Name
//             </Text>

//             <TextInput
//               value={groupName}
//               onChangeText={setGroupName}
//               placeholder="e.g. Family, FYP, Friends..."
//               placeholderTextColor="#999"
//               style={[
//                 styles.input,
//                 { color: theme.text },
//               ]}
//               autoFocus
//             />

//             <TouchableOpacity
//               style={[
//                 styles.primaryBtn,
//                 !groupName.trim() &&
//                   styles.btnDisabled,
//               ]}
//               onPress={() => {
//                 if (!groupName.trim()) {
//                   Alert.alert(
//                     'Error',
//                     'Enter a group name.'
//                   );
//                   return;
//                 }

//                 setStep('members');
//               }}
//               disabled={!groupName.trim()}
//             >
//               <Text style={styles.primaryBtnText}>
//                 NEXT: Add Members →
//               </Text>
//             </TouchableOpacity>
//           </>
//         )}

//         {/* ───────────────── STEP 2 ───────────────── */}
//         {step === 'members' && (
//           <>
//             <Text
//               style={[
//                 styles.sectionTitle,
//                 { color: theme.text },
//               ]}
//             >
//               Add Members to "{groupName}"
//             </Text>

//             {/* MANUAL ENTRY */}
//             <View
//               style={[
//                 styles.card,
//                 { backgroundColor: theme.card },
//               ]}
//             >
//               <Text
//                 style={[
//                   styles.cardTitle,
//                   { color: theme.text },
//                 ]}
//               >
//                 ➕ Add by Name & Phone
//               </Text>

//               <TextInput
//                 value={memberName}
//                 onChangeText={setMemberName}
//                 placeholder="Member Name"
//                 placeholderTextColor="#999"
//                 style={[
//                   styles.input,
//                   {
//                     color: theme.text,
//                     marginBottom: 8,
//                   },
//                 ]}
//               />

//               <TextInput
//                 value={memberPhone}
//                 onChangeText={setMemberPhone}
//                 placeholder="Phone e.g. 03001234567"
//                 placeholderTextColor="#999"
//                 keyboardType="phone-pad"
//                 style={[
//                   styles.input,
//                   {
//                     color: theme.text,
//                     marginBottom: 8,
//                   },
//                 ]}
//               />

//               <TouchableOpacity
//                 style={styles.addMemberBtn}
//                 onPress={addMemberManually}
//               >
//                 <Icon
//                   name="person-add"
//                   size={16}
//                   color="#fff"
//                 />

//                 <Text style={styles.addMemberBtnText}>
//                   {'  '}Add to List
//                 </Text>
//               </TouchableOpacity>
//             </View>

//             {/* EXISTING CONTACTS */}
//             <TouchableOpacity
//               style={[
//                 styles.secondaryBtn,
//                 { borderColor: theme.text },
//               ]}
//               onPress={() =>
//                 setShowContacts(!showContacts)
//               }
//             >
//               <Icon
//                 name="people-outline"
//                 size={18}
//                 color={theme.text}
//               />

//               <Text
//                 style={[
//                   styles.secondaryBtnText,
//                   { color: theme.text },
//                 ]}
//               >
//                 {showContacts
//                   ? 'Hide Existing Contacts'
//                   : 'Pick from Existing Contacts'}
//               </Text>

//               <Icon
//                 name={
//                   showContacts
//                     ? 'chevron-up'
//                     : 'chevron-down'
//                 }
//                 size={16}
//                 color={theme.text}
//               />
//             </TouchableOpacity>

//             {showContacts && (
//               <View
//                 style={[
//                   styles.contactDropdown,
//                   { backgroundColor: theme.card },
//                 ]}
//               >
//                 {loadingContacts ? (
//                   <ActivityIndicator
//                     size="small"
//                     color={theme.text}
//                     style={{ padding: 12 }}
//                   />
//                 ) : existingContacts.length === 0 ? (
//                   <Text
//                     style={[
//                       styles.emptyText,
//                       { color: theme.text },
//                     ]}
//                   >
//                     No existing contacts found.
//                   </Text>
//                 ) : (
//                   existingContacts.map(contact => (
//                     <TouchableOpacity
//                       key={contact.id}
//                       style={styles.contactRow}
//                       onPress={() =>
//                         addFromExisting(contact)
//                       }
//                     >
//                       <View
//                         style={styles.contactAvatar}
//                       >
//                         <Text
//                           style={styles.avatarText}
//                         >
//                           {contact.name
//                             .charAt(0)
//                             .toUpperCase()}
//                         </Text>
//                       </View>

//                       <View style={{ flex: 1 }}>
//                         <Text
//                           style={[
//                             styles.contactName,
//                             { color: theme.text },
//                           ]}
//                         >
//                           {contact.name}
//                         </Text>

//                         {contact.phone ? (
//                           <Text
//                             style={
//                               styles.contactPhone
//                             }
//                           >
//                             {contact.phone}
//                           </Text>
//                         ) : null}
//                       </View>

//                       <Icon
//                         name="add-circle-outline"
//                         size={22}
//                         color="#4CAF50"
//                       />
//                     </TouchableOpacity>
//                   ))
//                 )}
//               </View>
//             )}

//             {/* CURRENT MEMBERS */}
//             {members.length > 0 && (
//               <>
//                 <Text
//                   style={[
//                     styles.memberListTitle,
//                     { color: theme.text },
//                   ]}
//                 >
//                   Members ({members.length}):
//                 </Text>

//                 {members.map(member => (
//                   <View
//                     key={member.id}
//                     style={[
//                       styles.memberRow,
//                       { backgroundColor: theme.card },
//                     ]}
//                   >
//                     <View style={styles.memberAvatar}>
//                       <Text style={styles.avatarText}>
//                         {member.name
//                           .charAt(0)
//                           .toUpperCase()}
//                       </Text>
//                     </View>

//                     <View style={{ flex: 1 }}>
//                       <Text
//                         style={[
//                           styles.memberName,
//                           { color: theme.text },
//                         ]}
//                       >
//                         {member.name}
//                       </Text>

//                       <Text style={styles.memberPhone}>
//                         {member.phone}
//                       </Text>
//                     </View>

//                     <TouchableOpacity
//                       onPress={() =>
//                         removeMember(member.id)
//                       }
//                     >
//                       <Icon
//                         name="trash-outline"
//                         size={20}
//                         color="#E53935"
//                       />
//                     </TouchableOpacity>
//                   </View>
//                 ))}
//               </>
//             )}

//             {/* EMPTY MEMBERS */}
//             {members.length === 0 && (
//               <View style={styles.emptyMembers}>
//                 <Icon
//                   name="people-outline"
//                   size={36}
//                   color="#aaa"
//                 />

//                 <Text style={styles.emptyMembersText}>
//                   No members added yet.
//                   {'\n'}
//                   You can add them now or later.
//                 </Text>
//               </View>
//             )}

//             {/* ACTION BUTTONS */}
//             <View style={styles.actionRow}>
//               <TouchableOpacity
//                 style={styles.backBtn}
//                 onPress={() => setStep('name')}
//               >
//                 <Text style={styles.backBtnText}>
//                   ← Back
//                 </Text>
//               </TouchableOpacity>

//               <TouchableOpacity
//                 style={[
//                   styles.primaryBtn,
//                   {
//                     flex: 1,
//                     marginLeft: 10,
//                   },
//                   loading && styles.btnDisabled,
//                 ]}
//                 onPress={createGroup}
//                 disabled={loading}
//               >
//                 {loading ? (
//                   <ActivityIndicator color="#fff" />
//                 ) : (
//                   <Text style={styles.primaryBtnText}>
//                     CREATE GROUP
//                   </Text>
//                 )}
//               </TouchableOpacity>
//             </View>
//           </>
//         )}
//       </ScrollView>

//       {/* BOTTOM NAV */}
//       <View
//         style={[
//           styles.bottom,
//           { backgroundColor: theme.bottomNav },
//         ]}
//       >
//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate('HomeDashboard')
//           }
//         >
//           <Icon
//             name="home"
//             size={24}
//             color="#fff"
//           />
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate('AddMember')
//           }
//         >
//           <Icon
//             name="person-add"
//             size={24}
//             color="#fff"
//           />
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate(
//               'TimeBasedHistoryScreen'
//             )
//           }
//         >
//           <Icon
//             name="time"
//             size={24}
//             color="#fff"
//           />
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate('SettingScreen')
//           }
//         >
//           <Icon
//             name="settings"
//             size={24}
//             color="#fff"
//           />
//         </TouchableOpacity>
//       </View>
//     </SafeAreaView>
//   );
// };

// export default CreateGroup;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },

//   content: {
//     padding: 18,
//     paddingBottom: 120,
//   },

//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 20,
//   },

//   headerBox: {
//     paddingHorizontal: 18,
//     paddingVertical: 6,
//     borderRadius: 10,
//     elevation: 3,
//   },

//   headerText: {
//     fontWeight: '800',
//     fontSize: 15,
//   },

//   /* Progress */
//   progressRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginBottom: 4,
//   },

//   dot: {
//     width: 32,
//     height: 32,
//     borderRadius: 16,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },

//   dotActive: {
//     backgroundColor: '#000',
//   },

//   dotInactive: {
//     backgroundColor: '#ccc',
//   },

//   dotText: {
//     color: '#fff',
//     fontWeight: '800',
//     fontSize: 13,
//   },

//   dotLine: {
//     width: 60,
//     height: 2,
//     backgroundColor: '#ccc',
//     marginHorizontal: 6,
//   },

//   dotLineActive: {
//     backgroundColor: '#000',
//   },

//   progressLabels: {
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     marginBottom: 24,
//   },

//   progressLabel: {
//     fontSize: 11,
//     fontWeight: '600',
//   },

//   sectionTitle: {
//     fontSize: 18,
//     fontWeight: '700',
//     marginBottom: 14,
//   },

//   input: {
//     backgroundColor: '#EDEDED',
//     borderRadius: 10,
//     paddingHorizontal: 14,
//     height: 50,
//     fontSize: 14,
//   },

//   primaryBtn: {
//     backgroundColor: '#000',
//     borderRadius: 30,
//     paddingVertical: 14,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginTop: 20,
//     elevation: 4,
//   },

//   primaryBtnText: {
//     color: '#fff',
//     fontWeight: '800',
//     letterSpacing: 1,
//   },

//   btnDisabled: {
//     backgroundColor: '#888',
//   },

//   secondaryBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     borderWidth: 1.5,
//     borderRadius: 10,
//     padding: 12,
//     marginTop: 12,
//     marginBottom: 4,
//   },

//   secondaryBtnText: {
//     flex: 1,
//     marginLeft: 8,
//     fontWeight: '600',
//   },

//   backBtn: {
//     backgroundColor: '#555',
//     borderRadius: 30,
//     paddingVertical: 14,
//     paddingHorizontal: 20,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },

//   backBtnText: {
//     color: '#fff',
//     fontWeight: '700',
//   },

//   actionRow: {
//     flexDirection: 'row',
//     marginTop: 20,
//     alignItems: 'center',
//   },

//   card: {
//     borderRadius: 12,
//     padding: 14,
//     marginTop: 14,
//     elevation: 3,
//   },

//   cardTitle: {
//     fontWeight: '700',
//     marginBottom: 10,
//     fontSize: 14,
//   },

//   addMemberBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: '#4CAF50',
//     borderRadius: 25,
//     paddingVertical: 10,
//   },

//   addMemberBtnText: {
//     color: '#fff',
//     fontWeight: '700',
//   },

//   contactDropdown: {
//     borderRadius: 12,
//     marginTop: 4,
//     overflow: 'hidden',
//     elevation: 4,
//   },

//   contactRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingVertical: 12,
//     paddingHorizontal: 14,
//     borderBottomWidth: 1,
//     borderBottomColor: '#e0e0e0',
//   },

//   contactAvatar: {
//     width: 36,
//     height: 36,
//     borderRadius: 18,
//     backgroundColor: '#6ED3E8',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 12,
//   },

//   avatarText: {
//     color: '#fff',
//     fontWeight: '800',
//     fontSize: 14,
//   },

//   contactName: {
//     fontWeight: '600',
//     fontSize: 14,
//   },

//   contactPhone: {
//     fontSize: 11,
//     color: '#888',
//     marginTop: 2,
//   },

//   emptyText: {
//     padding: 14,
//     textAlign: 'center',
//     opacity: 0.6,
//   },

//   memberListTitle: {
//     fontWeight: '700',
//     marginTop: 20,
//     marginBottom: 8,
//   },

//   memberRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderRadius: 10,
//     padding: 12,
//     marginBottom: 8,
//     elevation: 2,
//   },

//   memberAvatar: {
//     width: 36,
//     height: 36,
//     borderRadius: 18,
//     backgroundColor: '#333',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 12,
//   },

//   memberName: {
//     fontWeight: '600',
//     fontSize: 14,
//   },

//   memberPhone: {
//     fontSize: 11,
//     color: '#888',
//     marginTop: 2,
//   },

//   emptyMembers: {
//     alignItems: 'center',
//     paddingVertical: 20,
//     gap: 8,
//   },

//   emptyMembersText: {
//     textAlign: 'center',
//     color: '#aaa',
//     lineHeight: 20,
//   },

//   bottom: {
//     position: 'absolute',
//     bottom: 0,
//     width: '100%',
//     height: 65,
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     alignItems: 'center',
//   },

//   iconBtn: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
// });
