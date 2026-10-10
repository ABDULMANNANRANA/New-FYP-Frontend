import React, {
  useState,
  useMemo,
  useCallback,
} from 'react';

import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StatusBar,
  Platform,
} from 'react-native';

import Icon from '@react-native-vector-icons/ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BASE_URL } from '../../config/api';
import { useTheme } from '../../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';

// ============================================================
// RESET NAVIGATION TO LOGIN
// ============================================================

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

// ============================================================
// AVATAR COLOR GENERATOR ACCORDING TO NAME
// ============================================================
const AVATAR_COLORS = [
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#059669',
  '#D97706',
  '#0891B2',
];

const getAvatarColor = name => {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

// ============================================================
// CONTACT SCREEN
// ============================================================

const ContactScreen = ({ navigation }) => {
  const { theme, isDark: themeIsDark } = useTheme();

  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Dynamic Theme Fallbacks
  const isDark =
    themeIsDark ||
    theme?.bg === '#121212' ||
    theme?.bg === '#000000' ||
    theme?.bg === '#1E1E1E';
  const bgColor = theme?.bg || '#F8FAFC';
  const cardBg = theme?.card || '#FFFFFF';
  const textColor = theme?.text || '#0F172A';
  const subTextColor = isDark ? '#94A3B8' : '#64748B';
  const navBg = theme?.bottomNav || '#0F172A';

  // ============================================================
  // GET JWT TOKEN
  // ============================================================

  const getToken = async () => {
    try {
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please login again.',
          [
            {
              text: 'OK',
              onPress: () => goToLogin(navigation),
            },
          ]
        );

        return null;
      }

      return token;
    } catch (error) {
      console.log('Get Token Error:', error);

      Alert.alert('Error', 'Unable to get your login session.');

      return null;
    }
  };

  // ============================================================
  // SAFE RESPONSE JSON
  // ============================================================

  const getResponseData = async response => {
    try {
      const text = await response.text();

      if (!text) {
        return {};
      }

      return JSON.parse(text);
    } catch (error) {
      console.log('Response JSON Error:', error);

      return {};
    }
  };

  // ============================================================
  // FETCH CONTACTS / GROUP MEMBERS
  // ============================================================

  const fetchContacts = useCallback(
    async ({ isRefresh = false } = {}) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const token = await getToken();
        if (!token) return;

        const headers = {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        };

        // Saved phone-book contacts and group members are both shown here.
        // A failure in one source should not hide data from the other source.
        const [groupsResult, savedContactsResult] = await Promise.allSettled([
          fetch(`${BASE_URL}/Task/groups`, { method: 'GET', headers }),
          fetch(`${BASE_URL}/User/contacts`, { method: 'GET', headers }),
        ]);

        const groupsResponse =
          groupsResult.status === 'fulfilled' ? groupsResult.value : null;
        const savedContactsResponse =
          savedContactsResult.status === 'fulfilled'
            ? savedContactsResult.value
            : null;

        const groupsData = groupsResponse
          ? await getResponseData(groupsResponse)
          : {};
        const savedContactsData = savedContactsResponse
          ? await getResponseData(savedContactsResponse)
          : {};

        if (
          groupsResponse?.status === 401 ||
          savedContactsResponse?.status === 401
        ) {
          Alert.alert('Session Expired', 'Please login again.', [
            {
              text: 'OK',
              onPress: () => goToLogin(navigation),
            },
          ]);
          return;
        }

        const groupsAvailable =
          !!groupsResponse?.ok && !!groupsData?.success;
        const savedContactsAvailable =
          !!savedContactsResponse?.ok && !!savedContactsData?.success;

        if (!groupsAvailable && !savedContactsAvailable) {
          const requestError =
            groupsResult.status === 'rejected'
              ? groupsResult.reason
              : savedContactsResult.status === 'rejected'
                ? savedContactsResult.reason
                : null;
          throw new Error(
            groupsData?.message ||
              savedContactsData?.message ||
              requestError?.message ||
              'Failed to fetch contacts. Please check your connection.',
          );
        }

        if (!groupsAvailable) {
          console.warn('Group members could not be loaded:', groupsData?.message);
        }
        if (!savedContactsAvailable) {
          console.warn(
            'Saved contacts could not be loaded:',
            savedContactsData?.message,
          );
        }

        const contactMap = new Map();
        const addContact = contact => {
          const name = String(contact?.name || '').trim();
          const phone = contact?.phone ? String(contact.phone).trim() : '';

          if (!name || name.toLowerCase() === 'unknown') return;

          const phoneDigits = phone.replace(/\D/g, '');
          const key = phoneDigits
            ? `phone_${phoneDigits}`
            : `name_${name.toLowerCase()}`;
          const existing = contactMap.get(key);

          if (existing) {
            contactMap.set(key, {
              ...existing,
              id: existing.id ?? contact.id,
              phone: existing.phone || phone,
              isRegistered: existing.isRegistered || !!contact.isRegistered,
              role: existing.role || contact.role,
            });
            return;
          }

          contactMap.set(key, {
            ...contact,
            name,
            phone,
            isRegistered: !!contact.isRegistered,
          });
        };

        const savedContacts = Array.isArray(savedContactsData?.data)
          ? savedContactsData.data
          : Array.isArray(savedContactsData?.contacts)
            ? savedContactsData.contacts
            : [];

        // Add saved contacts first so their custom names are kept if the same
        // phone number is also present as a group member.
        savedContacts.forEach(contact => {
          addContact({
            id: `personal_${contact?.id ?? contact?.phone ?? contact?.name}`,
            name: contact?.name || contact?.displayName,
            phone: contact?.phone || contact?.phoneNumber,
            isRegistered: false,
            isPersonal: true,
          });
        });

        const groups = Array.isArray(groupsData?.data) ? groupsData.data : [];
        groups.forEach(group => {
          if (!Array.isArray(group?.members)) return;

          group.members.forEach(member => {
            const name = String(
              member?.displayName || member?.name || '',
            ).trim();
            const phone = member?.phone ? String(member.phone) : '';

            addContact({
              id: member?.id,
              name,
              phone,
              role: member?.role,
              isRegistered: !!member?.isRegistered || member?.userId != null,
              isPersonal: false,
            });
          });
        });

        setContacts(Array.from(contactMap.values()));
      } catch (error) {
        console.log('Fetch Contacts Error:', error);
        Alert.alert(
          'Error',
          error?.message ||
            'Failed to fetch contacts. Please check your connection.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigation],
  );

  // ============================================================
  // REFRESH WHEN SCREEN GETS FOCUS
  // ============================================================

  useFocusEffect(
    useCallback(() => {
      fetchContacts();
    }, [fetchContacts])
  );

  // ============================================================
  // PULL TO REFRESH
  // ============================================================

  const onRefresh = useCallback(() => {
    fetchContacts({ isRefresh: true });
  }, [fetchContacts]);

  // ============================================================
  // FILTER CONTACTS
  // ============================================================

  const filteredContacts = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    if (!searchText) {
      return contacts;
    }

    return contacts.filter(contact => {
      const name = contact?.name?.toLowerCase() || '';
      const phone = contact?.phone || '';

      return (
        name.includes(searchText) || phone.includes(searchText)
      );
    });
  }, [search, contacts]);

  const openAddMenuDestination = screenName => {
    setShowAddMenu(false);
    navigation.navigate(screenName);
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={bgColor}
      />

      {/* ======================================================
          HEADER & SEARCH
      ====================================================== */}

      <View style={styles.headerContainer}>
        <View style={[styles.searchBox, { backgroundColor: cardBg }]}>
          <Icon name="search-outline" size={20} color="#94A3B8" style={styles.searchIcon} />
          
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search contacts or phone..."
            placeholderTextColor="#94A3B8"
            style={[styles.input, { color: textColor }]}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddMenu(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Add contact or create group"
          accessibilityHint="Opens the contacts menu"
        >
          <View style={styles.addIconWrapper}>
            <Icon name="person-add-outline" size={21} color="#FFFFFF" />
            <View style={styles.addDotsBadge}>
              <Icon name="ellipsis-vertical" size={11} color="#FFFFFF" />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* ======================================================
          CONTACT LIST
      ====================================================== */}

      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading contacts...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2563EB"
              colors={['#2563EB']}
            />
          }
        >
          {/* SECTION HEADER */}
          {filteredContacts.length > 0 && (
            <Text style={styles.sectionTitle}>
              CONTACTS ({filteredContacts.length})
            </Text>
          )}

          {/* ==================================================
              CONTACTS
          ================================================== */}

          {filteredContacts.map((item, index) => {
            const firstLetter =
              item?.name?.charAt(0)?.toUpperCase() || '?';
            const avatarBg = getAvatarColor(item?.name);

            return (
              <View
                key={
                  item?.id != null
                    ? `id_${item.id}`
                    : `${item.name}_${item.phone}_${index}`
                }
                style={[styles.card, { backgroundColor: cardBg }]}
              >
                {/* AVATAR */}
                <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                  <Text style={styles.avatarText}>{firstLetter}</Text>
                </View>

                {/* CONTACT INFORMATION */}
                <View style={styles.contactInfo}>
                  <Text
                    style={[styles.contactName, { color: textColor }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>

                  {item.phone ? (
                    <View style={styles.phoneRow}>
                      <Icon name="call-outline" size={13} color="#64748B" />
                      <Text style={styles.phoneText}>
                        {item.phone}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.noPhoneText}>No phone available</Text>
                  )}
                </View>

                {/* REGISTERED STATUS BADGE */}
                {item.isRegistered && (
                  <View style={styles.verifiedBadge}>
                    <Icon name="checkmark-circle" size={16} color="#10B981" />
                  </View>
                )}
              </View>
            );
          })}

          {/* ==================================================
              EMPTY STATE
          ================================================== */}

          {filteredContacts.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Icon name="people-outline" size={42} color="#94A3B8" />
              </View>
              <Text style={[styles.emptyTitle, { color: textColor }]}>
                {contacts.length === 0 ? 'No Contacts Found' : 'No Matches'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {contacts.length === 0
                  ? 'Your saved contacts and group members will appear here. Tap the add icon to save a contact or create a group.'
                  : `We couldn't find any contact matching "${search}".`}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ======================================================
          BOTTOM NAVIGATION
      ====================================================== */}

      <View style={[styles.bottom, { backgroundColor: navBg }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('HomeDashboard')}
          activeOpacity={0.7}
        >
          <Icon name="home-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabelInactive}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('ContactScreen')}
          activeOpacity={0.7}
        >
          <Icon name="people" size={22} color="#2563EB" />
          <Text style={styles.navLabelActive}>Contacts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('HistoryScreen')}
          activeOpacity={0.7}
        >
          <Icon name="time-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabelInactive}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('SettingScreen')}
          activeOpacity={0.7}
        >
          <Icon name="settings-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabelInactive}>Settings</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showAddMenu}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowAddMenu(false)}
      >
        <View style={styles.actionMenuLayer}>
          <Pressable
            style={styles.actionMenuBackdrop}
            onPress={() => setShowAddMenu(false)}
            accessibilityRole="button"
            accessibilityLabel="Close add menu"
          />

          <View style={[styles.actionMenu, { backgroundColor: cardBg }]}>
            <Text style={[styles.menuEyebrow, { color: subTextColor }]}>CREATE</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openAddMenuDestination('AddContact')}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={[styles.menuIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <Icon name="person-add-outline" size={19} color="#2563EB" />
              </View>
              <View style={styles.menuCopy}>
                <Text style={[styles.menuLabel, { color: textColor }]}>Add Contact</Text>
                <Text style={[styles.menuDescription, { color: subTextColor }]}>Save a name and phone number</Text>
              </View>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: isDark ? '#3F3F46' : '#E2E8F0' }]} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openAddMenuDestination('CreateGroup')}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <View style={[styles.menuIconCircle, { backgroundColor: '#ECFDF5' }]}>
                <Icon name="people-outline" size={19} color="#059669" />
              </View>
              <View style={styles.menuCopy}>
                <Text style={[styles.menuLabel, { color: textColor }]}>Create Group</Text>
                <Text style={[styles.menuDescription, { color: subTextColor }]}>Choose people and name your group</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ContactScreen;

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // HEADER & SEARCH
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
    gap: 12,
  },

  searchBox: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },

  searchIcon: {
    marginRight: 8,
  },

  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },

  addButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },

  addIconWrapper: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addDotsBadge: {
    position: 'absolute',
    right: -5,
    top: -4,
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },

  actionMenuLayer: {
    flex: 1,
  },

  actionMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.16)',
  },

  actionMenu: {
    position: 'absolute',
    top: 64,
    right: 16,
    width: 260,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    elevation: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },

  menuEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginLeft: 5,
    marginBottom: 5,
  },

  menuItem: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 7,
  },

  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  menuCopy: {
    flex: 1,
  },

  menuLabel: {
    fontSize: 14,
    fontWeight: '700',
  },

  menuDescription: {
    fontSize: 11,
    marginTop: 3,
  },

  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 50,
  },

  // SCROLL CONTENT
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 90,
  },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.1,
    marginBottom: 12,
    marginTop: 4,
  },

  // CONTACT CARD
  card: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
  },

  contactInfo: {
    flex: 1,
    justifyContent: 'center',
  },

  contactName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
  },

  phoneText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  noPhoneText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 2,
  },

  verifiedBadge: {
    marginLeft: 8,
  },

  // LOADING & EMPTY STATES
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },

  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },

  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },

  // BOTTOM NAVIGATION
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 68,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },

  iconBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },

  navLabelActive: {
    color: '#2563EB',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },

  navLabelInactive: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
});


















































// import React, {
//   useState,
//   useMemo,
//   useCallback,
// } from 'react';

// import {
//   SafeAreaView,
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   TextInput,
//   ScrollView,
//   RefreshControl,
//   ActivityIndicator,
//   Alert,
// } from 'react-native';

// import Icon from '@react-native-vector-icons/ionicons';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// import { BASE_URL } from '../../config/api';
// import { useTheme } from '../../context/ThemeContext';
// import { useFocusEffect } from '@react-navigation/native';

// // ============================================================
// // RESET NAVIGATION TO LOGIN
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

// // ============================================================
// // CONTACT SCREEN
// // ============================================================

// const ContactScreen = ({ navigation }) => {
//   const { theme } = useTheme();

//   const [search, setSearch] = useState('');
//   const [contacts, setContacts] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [refreshing, setRefreshing] = useState(false);

//   // ============================================================
//   // GET JWT TOKEN
//   // ============================================================

//   const getToken = async () => {
//     try {
//       // Same token key used by HomeDashboard/LoginScreen
//       const token = await AsyncStorage.getItem('token');

//       if (!token) {
//         Alert.alert(
//           'Session Expired',
//           'Your session has expired. Please login again.',
//           [
//             {
//               text: 'OK',
//               onPress: () => goToLogin(navigation),
//             },
//           ]
//         );

//         return null;
//       }

//       return token;
//     } catch (error) {
//       console.log('Get Token Error:', error);

//       Alert.alert('Error', 'Unable to get your login session.');

//       return null;
//     }
//   };

//   // ============================================================
//   // SAFE RESPONSE JSON
//   // ============================================================

//   const getResponseData = async response => {
//     try {
//       const text = await response.text();

//       if (!text) {
//         return {};
//       }

//       return JSON.parse(text);
//     } catch (error) {
//       console.log('Response JSON Error:', error);

//       return {};
//     }
//   };

//   // ============================================================
//   // FETCH CONTACTS / GROUP MEMBERS
//   // ============================================================

//   const fetchContacts = useCallback(
//     async ({ isRefresh = false } = {}) => {
//       try {
//         if (isRefresh) {
//           setRefreshing(true);
//         } else {
//           setLoading(true);
//         }

//         // ========================================================
//         // GET TOKEN
//         // ========================================================

//         const token = await getToken();

//         if (!token) {
//           return;
//         }

//         // ========================================================
//         // IMPORTANT:
//         //
//         // HomeDashboard uses:
//         // GET ${BASE_URL}/Task/groups
//         //
//         // Therefore ContactScreen must use the same route.
//         // ========================================================

//         const url = `${BASE_URL}/Task/groups`;

//         console.log('Fetching Contacts:', url);

//         const response = await fetch(url, {
//           method: 'GET',
//           headers: {
//             Accept: 'application/json',
//             Authorization: `Bearer ${token}`,
//           },
//         });

//         const data = await getResponseData(response);

//         console.log('Fetch Contacts Response:', data);

//         // ========================================================
//         // SESSION EXPIRED
//         // ========================================================

//         if (response.status === 401) {
//           Alert.alert('Session Expired', 'Please login again.', [
//             {
//               text: 'OK',
//               onPress: () => goToLogin(navigation),
//             },
//           ]);

//           return;
//         }

//         // ========================================================
//         // SERVER ERROR
//         // ========================================================

//         if (!response.ok) {
//           throw new Error(
//             data?.message || `Server error: ${response.status}`
//           );
//         }

//         // ========================================================
//         // SUCCESS
//         // ========================================================

//         if (data?.success) {
//           const groups = Array.isArray(data.data) ? data.data : [];

//           const members = [];
//           const seen = new Set();

//           // API response:
//           // data.data = groups
//           //
//           // Each group can contain:
//           // members: [...]
//           //
//           // We collect members from all groups.

//           groups.forEach(group => {
//             if (!Array.isArray(group?.members)) {
//               return;
//             }

//             group.members.forEach(member => {
//               // ==================================================
//               // API MEMBER FIELDS
//               // ==================================================

//               const name = (
//                 member?.displayName ||
//                 member?.name ||
//                 ''
//               ).trim();

//               const phone = member?.phone
//                 ? String(member.phone)
//                 : '';

//               // ==================================================
//               // IGNORE UNKNOWN / NAMELESS MEMBERS
//               // ==================================================

//               if (!name || name.toLowerCase() === 'unknown') {
//                 return;
//               }

//               // ==================================================
//               // REMOVE DUPLICATES
//               // Prefer the real member id when we have one, since
//               // two different people can share a name/phone combo
//               // (e.g. two members with no phone on file).
//               // ==================================================

//               const key = member?.id
//                 ? `id_${member.id}`
//                 : `${name}_${phone}`.toLowerCase();

//               if (seen.has(key)) {
//                 return;
//               }

//               seen.add(key);

//               members.push({
//                 id: member?.id,
//                 name,
//                 phone,
//                 role: member?.role,
//                 isRegistered: !!member?.isRegistered,
//               });
//             });
//           });

//           console.log('Processed Contacts:', members);

//           setContacts(members);
//         } else {
//           console.log(
//             'Fetch Contacts Failed:',
//             data?.message || 'No contacts found'
//           );

//           setContacts([]);
//         }
//       } catch (error) {
//         console.log('Fetch Contacts Error:', error);

//         Alert.alert(
//           'Error',
//           error?.message ||
//             'Failed to fetch contacts. Please check your connection.'
//         );
//       } finally {
//         setLoading(false);
//         setRefreshing(false);
//       }
//     },
//     [navigation]
//   );

//   // ============================================================
//   // REFRESH WHEN SCREEN GETS FOCUS
//   // ============================================================

//   useFocusEffect(
//     useCallback(() => {
//       fetchContacts();
//     }, [fetchContacts])
//   );

//   // ============================================================
//   // PULL TO REFRESH
//   // ============================================================

//   const onRefresh = useCallback(() => {
//     fetchContacts({ isRefresh: true });
//   }, [fetchContacts]);

//   // ============================================================
//   // FILTER CONTACTS
//   // ============================================================

//   const filteredContacts = useMemo(() => {
//     const searchText = search.trim().toLowerCase();

//     if (!searchText) {
//       return contacts;
//     }

//     return contacts.filter(contact => {
//       const name = contact?.name?.toLowerCase() || '';
//       const phone = contact?.phone || '';

//       return (
//         name.includes(searchText) || phone.includes(searchText)
//       );
//     });
//   }, [search, contacts]);

//   // ============================================================
//   // RENDER
//   // ============================================================

//   return (
//     <SafeAreaView
//       style={[styles.container, { backgroundColor: theme.bg }]}
//     >
//       {/* ======================================================
//           HEADER & SEARCH
//       ====================================================== */}

//       <View style={styles.headerRow}>
//         <View style={styles.searchBox}>
//           <TextInput
//             value={search}
//             onChangeText={setSearch}
//             placeholder="Search Contacts"
//             placeholderTextColor="#aaa"
//             style={styles.input}
//             autoCapitalize="none"
//             autoCorrect={false}
//           />

//           <Icon name="search" size={18} color="#fff" />
//         </View>

//         <TouchableOpacity
//           style={styles.addCircle}
//           onPress={() => navigation.navigate('AddMember')}
//         >
//           <Icon name="person-add" size={22} color="#fff" />
//         </TouchableOpacity>
//       </View>

//       {/* ======================================================
//           CONTACT LIST
//       ====================================================== */}

//       {loading ? (
//         <ActivityIndicator
//           size="large"
//           color={theme.text}
//           style={styles.loader}
//         />
//       ) : (
//         <ScrollView
//           showsVerticalScrollIndicator={false}
//           contentContainerStyle={styles.scrollContent}
//           refreshControl={
//             <RefreshControl
//               refreshing={refreshing}
//               onRefresh={onRefresh}
//               tintColor={theme.text}
//             />
//           }
//         >
//           {/* ==================================================
//               CONTACTS
//           ================================================== */}

//           {filteredContacts.map((item, index) => {
//             const firstLetter =
//               item?.name?.charAt(0)?.toUpperCase() || '?';

//             return (
//               <View
//                 key={
//                   item?.id != null
//                     ? `id_${item.id}`
//                     : `${item.name}_${item.phone}_${index}`
//                 }
//                 style={[
//                   styles.card,
//                   { backgroundColor: theme.card },
//                 ]}
//               >
//                 {/* AVATAR */}

//                 <View style={styles.avatar}>
//                   <Text style={styles.avatarText}>
//                     {firstLetter}
//                   </Text>
//                 </View>

//                 {/* CONTACT INFORMATION */}

//                 <View style={styles.contactInfo}>
//                   <Text
//                     style={[styles.text, { color: theme.text }]}
//                   >
//                     {item.name}
//                   </Text>

//                   {item.phone ? (
//                     <Text
//                       style={[
//                         styles.phone,
//                         { color: theme.text },
//                       ]}
//                     >
//                       {item.phone}
//                     </Text>
//                   ) : null}

//                   {/* {item.role ? (
//                     <Text
//                       style={[
//                         styles.role,
//                         { color: theme.text },
//                       ]}
//                     >
//                       {item.role}
//                     </Text>
//                   ) : null} */}
//                 </View>
//               </View>
//             );
//           })}

//           {/* ==================================================
//               NO RESULTS
//           ================================================== */}

//           {filteredContacts.length === 0 && (
//             <Text style={[styles.noResult, { color: theme.text }]}>
//               {contacts.length === 0
//                 ? 'No contacts yet. Add members to a group first.'
//                 : 'No contacts found.'}
//             </Text>
//           )}
//         </ScrollView>
//       )}

//       {/* ======================================================
//           BOTTOM NAVIGATION
//       ====================================================== */}

//       <View
//         style={[
//           styles.bottom,
//           { backgroundColor: theme.bottomNav },
//         ]}
//       >
//         {/* HOME */}

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() => navigation.navigate('HomeDashboard')}
//         >
//           <Icon name="home" size={24} color="#fff" />
//         </TouchableOpacity>

//         {/* CONTACTS */}

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() => navigation.navigate('ContactScreen')}
//         >
//           <Icon name="people" size={24} color="#fff" />
//         </TouchableOpacity>

//         {/* HISTORY */}

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate('TimeBasedHistoryScreen')
//           }
//         >
//           <Icon name="time" size={24} color="#fff" />
//         </TouchableOpacity>

//         {/* SETTINGS */}

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() => navigation.navigate('SettingScreen')}
//         >
//           <Icon name="settings" size={24} color="#fff" />
//         </TouchableOpacity>
//       </View>
//     </SafeAreaView>
//   );
// };

// export default ContactScreen;

// // ============================================================
// // STYLES
// // ============================================================

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#B7C9DB',
//     paddingHorizontal: 16,
//     paddingTop: 10,
//   },

//   // ==========================================================
//   // HEADER
//   // ==========================================================

//   headerRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 20,
//     gap: 10,
//   },

//   searchBox: {
//     flex: 1,
//     backgroundColor: '#000',
//     borderRadius: 30,
//     height: 50,
//     paddingHorizontal: 18,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//   },

//   addCircle: {
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//     backgroundColor: '#000',
//     justifyContent: 'center',
//     alignItems: 'center',
//     elevation: 4,
//   },

//   input: {
//     flex: 1,
//     color: '#fff',
//     fontSize: 14,
//     marginRight: 10,
//   },

//   // ==========================================================
//   // LOADING
//   // ==========================================================

//   loader: {
//     marginTop: 20,
//   },

//   // ==========================================================
//   // SCROLL
//   // ==========================================================

//   scrollContent: {
//     paddingBottom: 100,
//   },

//   // ==========================================================
//   // CONTACT CARD
//   // ==========================================================

//   card: {
//     backgroundColor: '#EDEDED',
//     borderRadius: 12,
//     paddingVertical: 14,
//     paddingHorizontal: 18,
//     marginBottom: 12,
//     elevation: 4,
//     flexDirection: 'row',
//     alignItems: 'center',
//   },

//   avatar: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: '#6ED3E8',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 12,
//   },

//   avatarText: {
//     color: '#fff',
//     fontWeight: '800',
//     fontSize: 16,
//   },

//   contactInfo: {
//     flex: 1,
//   },

//   text: {
//     fontSize: 14,
//     fontWeight: '600',
//   },

//   phone: {
//     fontSize: 11,
//     opacity: 0.7,
//     marginTop: 2,
//   },

//   role: {
//     fontSize: 10,
//     opacity: 0.6,
//     marginTop: 2,
//   },

//   noResult: {
//     textAlign: 'center',
//     marginTop: 20,
//     fontSize: 14,
//   },

//   // ==========================================================
//   // BOTTOM NAVIGATION
//   // ==========================================================

//   bottom: {
//     position: 'absolute',
//     bottom: 0,
//     left: 0,
//     right: 0,
//     height: 65,
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     alignItems: 'center',
//     paddingHorizontal: 10,
//     elevation: 10,
//   },

//   iconBtn: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     height: '100%',
//   },
// });
