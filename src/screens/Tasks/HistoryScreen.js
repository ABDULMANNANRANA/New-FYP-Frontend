import React, { useState, useCallback } from 'react';

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Icon from '@react-native-vector-icons/ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '../../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import { BASE_URL } from '../../config/api';

// ============================================================
// ONE UNIFIED HISTORY SCREEN
//
// Replaces TimeBasedHistoryScreen + NonTimeBasedHistoryScreen.
//
// The toggle switches the history shown on THIS screen:
//
//   Time Based      -> ?isTimeBased=true
//   Non Time Based  -> ?isTimeBased=false&locationBased=false
//   Location Based  -> ?isTimeBased=false&locationBased=true
//
// The screen is registered in MainStack under the legacy names
// "TimeBasedHistoryScreen" / "NonTimeBasedHistoryScreen" too, so
// every existing navigation.navigate('TimeBasedHistoryScreen')
// call keeps working without any other change.
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

// "Saved place • within 200 m" — for Location Based rows
const formatPlaceLine = item => {
  const radius = Number(item?.geofenceRadiusMeters) || 200;

  const radiusText =
    radius >= 1000
      ? `${(radius / 1000).toFixed(1)} km`
      : `${Math.round(radius)} m`;

  return `Saved place • within ${radiusText}`;
};

// ============================================================
// TAB PURITY SAFETY NET
//
// The API filter is authoritative; this guarantees a tab can
// NEVER show another tab's tasks, even if the server returns
// mixed results.
// ============================================================
const filterForTabList = (list, type, hasLocationInfo) => {
  // If the API sent no saved-place fields at all, there is
  // nothing to classify with — trust the server-side filter.
  if (!hasLocationInfo) {
    return list;
  }

  return list.filter(item => {
    const looksLocation =
      item?.isLocationBased === true ||
      (item?.isLocationBased === undefined && item?.latitude != null);

    const looksTime = item?.isTimeBased === true;

    // LOCATION BASED tab: only tasks with a saved place
    if (type === 'location') {
      return looksLocation;
    }

    // NON TIME BASED tab: no saved place, not time-based
    if (type === 'non') {
      return !looksLocation && !looksTime;
    }

    // TIME BASED tab: only time-based tasks
    return looksTime;
  });
};

const HistoryScreen = ({ navigation, route }) => {
  const { isDark, theme } = useTheme();

  // Which tab to open on:
  //   1. route.params?.initialType (optional)
  //   2. legacy route name (NonTimeBasedHistoryScreen -> 'non')
  //   3. default 'time'
  const initialType =
    route?.params?.initialType ||
    (route?.name === 'NonTimeBasedHistoryScreen' ? 'non' : 'time');

  const [type, setType] = useState(initialType);

  const [completedTasks, setCompletedTasks] = useState([]);

  const [loading, setLoading] = useState(false);

  const statusBarBg = theme.headerBox || (isDark ? '#1F2937' : '#FFFFFF');

  const primaryTextColor = theme.text || (isDark ? '#F9FAFB' : '#111827');

  const secondaryTextColor = theme.subText || (isDark ? '#9CA3AF' : '#6B7280');

  const cardBg = theme.card || (isDark ? '#1F2937' : '#FFFFFF');

  const activeToggleBg = isDark ? '#374151' : '#FFFFFF';

  // ============================================================
  // GET JWT TOKEN
  // ============================================================
  const getToken = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert('Session Expired', 'Please login again.', [
          {
            text: 'OK',
            onPress: () => goToLogin(navigation),
          },
        ]);

        return null;
      }

      return token;
    } catch (error) {
      console.log('Get Token Error:', error);

      Alert.alert('Error', 'Unable to read your login session.');

      return null;
    }
  }, [navigation]);

  // ============================================================
  // FETCH TASK HISTORY FOR THE ACTIVE TAB
  // ============================================================
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);

      const token = await getToken();

      if (!token) {
        return;
      }

      const isTimeBased = type === 'time';

      // type: 'time'     -> Time Based tasks
      //       'non'      -> Non Time Based tasks (no saved place)
      //       'location' -> Location Based tasks (with a saved place)
      const locationBasedFilter =
        type === 'location'
          ? '&locationBased=true'
          : type === 'non'
          ? '&locationBased=false'
          : '';

      const query =
        `/Task/history?isTimeBased=${isTimeBased}` + locationBasedFilter;

      const url = `${BASE_URL}${query}`;

      console.log('Fetching Task History:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();

      let data = {};

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.log('History JSON Parse Error:', parseError);

        throw new Error(`Invalid server response. Status: ${response.status}`);
      }

      if (response.status === 401) {
        Alert.alert('Session Expired', 'Please login again.', [
          {
            text: 'OK',
            onPress: () => goToLogin(navigation),
          },
        ]);

        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.message || `Request failed with status ${response.status}`,
        );
      }

      if (!data?.success) {
        setCompletedTasks([]);

        console.log(
          'Fetch History Failed:',
          data?.message || 'Failed to fetch completed task history.',
        );

        return;
      }

      const historyData = data?.data || {};
      const done = Array.isArray(historyData.done) ? historyData.done : [];

      // The API returns only completed tasks. Keep a client-side status check
      // as a safety net so pending or snoozed records can never appear here.
      const completedOnly = done.filter(item => {
        const status = String(item?.status ?? '').toLowerCase();
        return status === 'done' || (!status && item?.isCompleted === true);
      });

      const hasLocationInfo = completedOnly.some(
        item =>
          item?.isLocationBased !== undefined || item?.latitude !== undefined,
      );

      setCompletedTasks(filterForTabList(completedOnly, type, hasLocationInfo));

      console.log('Completed Tasks:', completedOnly.length);
    } catch (error) {
      console.log('Fetch History Error:', error);

      setCompletedTasks([]);

      Alert.alert('Error', error?.message || 'Failed to fetch task history.');
    } finally {
      setLoading(false);
    }
  }, [getToken, type, navigation]);

  // Refetch when the screen opens AND whenever the
  // toggle changes `type`.
  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory]),
  );

  // ============================================================
  // FORMATTERS
  // ============================================================
  const formatDate = (dueDate, dueTime) => {
    if (!dueDate) {
      return 'No Due Date';
    }

    let formattedDate = dueDate;

    try {
      const date = new Date(dueDate);

      if (!Number.isNaN(date.getTime())) {
        formattedDate = date.toLocaleDateString();
      }
    } catch (error) {
      formattedDate = dueDate;
    }

    if (dueTime) {
      return `${formattedDate} • ${dueTime}`;
    }

    return formattedDate;
  };

  // ============================================================
  // TASK ROW
  // ============================================================
  const renderTask = (
    item,
    index,
    completedStatus = false,
    accentColor = '#2563EB',
  ) => {
    const hasPlace = item?.latitude != null || item?.isLocationBased;

    const hasWhen = item?.dueDate != null || item?.dueTime != null;

    // Location rows show the saved place instead of a date.
    const showPlace = hasPlace && !hasWhen;

    return (
      <TouchableOpacity
        key={`${item.id || 'task'}-${index}`}
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor: theme.border || 'rgba(0,0,0,0.06)',
          },
          completedStatus && styles.completedCard,
        ]}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('TaskOverviewScreen', {
            task: item,
          })
        }
      >
        <View
          style={[
            styles.cardAccentStrip,
            {
              backgroundColor: accentColor,
            },
          ]}
        />

        <View style={styles.cardContent}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: `${accentColor}15`,
              },
            ]}
          >
            <Icon
              name={
                completedStatus
                  ? 'checkmark'
                  : showPlace
                  ? 'location-outline'
                  : type === 'time'
                  ? 'time-outline'
                  : 'list-outline'
              }
              size={18}
              color={accentColor}
            />
          </View>

          <View style={styles.taskInfo}>
            <Text
              style={[
                styles.taskTitle,
                {
                  color: primaryTextColor,
                },
                completedStatus && styles.completedText,
              ]}
              numberOfLines={2}
            >
              {item.title || 'Untitled Task'}
            </Text>

            {item.description ? (
              <Text
                style={[
                  styles.taskDescription,
                  {
                    color: secondaryTextColor,
                  },
                ]}
                numberOfLines={1}
              >
                {item.description}
              </Text>
            ) : null}

            <View style={styles.dateRow}>
              <Icon
                name={showPlace ? 'location-outline' : 'calendar-outline'}
                size={12}
                color={secondaryTextColor}
                style={styles.dateIcon}
              />

              <Text
                style={[
                  styles.taskDate,
                  {
                    color: secondaryTextColor,
                  },
                ]}
              >
                {showPlace
                  ? formatPlaceLine(item)
                  : formatDate(item.dueDate, item.dueTime)}
              </Text>
            </View>

            {!completedStatus && item.status === 'Snoozed' ? (
              <View style={styles.snoozedBadgeContainer}>
                <Text style={styles.snoozedBadge}>Snoozed</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.rightColumn}>
            {completedStatus ? (
              <View style={styles.completedBadgeContainer}>
                <Text style={styles.completedBadge}>✓ Done</Text>
              </View>
            ) : null}

            <Icon name="chevron-forward" size={18} color={secondaryTextColor} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ============================================================
  // SECTION HEADER
  // ============================================================
  const renderSectionHeader = (title, count, accentColor) => {
    return (
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleRow}>
          <View
            style={[
              styles.sectionDot,
              {
                backgroundColor: accentColor,
              },
            ]}
          />

          <Text
            style={[
              styles.section,
              {
                color: primaryTextColor,
              },
            ]}
          >
            {title}
          </Text>
        </View>

        <View
          style={[
            styles.countBadge,
            {
              backgroundColor: `${accentColor}15`,
            },
          ]}
        >
          <Text
            style={[
              styles.countBadgeText,
              {
                color: accentColor,
              },
            ]}
          >
            {count}
          </Text>
        </View>
      </View>
    );
  };

  const totalTasks = completedTasks.length;

  // ============================================================
  // TOGGLE OPTIONS
  // ============================================================
  const toggleOptions = [
    {
      key: 'time',
      label: 'Time Based',
      icon: 'time-outline',
    },
    {
      key: 'non',
      label: 'Non Time Based',
      icon: 'list-outline',
    },
    {
      key: 'location',
      label: 'Location Based',
      icon: 'location-outline',
    },
  ];

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: theme.bg || (isDark ? '#111827' : '#F9FAFB'),
        },
      ]}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={statusBarBg}
      />

      {/* =========================
          HEADER
      ========================== */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: statusBarBg,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
          }}
          activeOpacity={0.6}
        >
          <Icon name="arrow-back" size={22} color={primaryTextColor} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text
            style={[
              styles.headerText,
              {
                color: primaryTextColor,
              },
            ]}
            numberOfLines={1}
          >
            Task History
          </Text>
        </View>

        <View style={styles.headerButtonPlaceholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* =========================
            TYPE TOGGLE
        ========================== */}
        <View
          style={[
            styles.toggleContainer,
            {
              backgroundColor: isDark ? '#1F2937' : '#E5E7EB',
            },
          ]}
        >
          {toggleOptions.map(option => {
            const isActive = type === option.key;

            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.toggleBtn,
                  isActive && [
                    styles.toggleBtnActive,
                    {
                      backgroundColor: activeToggleBg,
                    },
                  ],
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  if (type !== option.key) {
                    setType(option.key);
                  }
                }}
              >
                <Icon
                  name={option.icon}
                  size={15}
                  color={isActive ? '#2563EB' : secondaryTextColor}
                  style={styles.toggleIcon}
                />

                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={[
                    styles.toggleText,
                    {
                      color: isActive ? primaryTextColor : secondaryTextColor,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* =========================
            LOADING
        ========================== */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={isDark ? '#60A5FA' : '#2563EB'}
            />

            <Text
              style={[
                styles.loadingText,
                {
                  color: secondaryTextColor,
                },
              ]}
            >
              Loading history...
            </Text>
          </View>
        ) : (
          <>
            {/* COMPLETED TASKS ONLY */}
            {completedTasks.length > 0 && (
              <View style={styles.sectionContainer}>
                {renderSectionHeader(
                  'COMPLETED',
                  completedTasks.length,
                  '#10B981',
                )}

                {completedTasks.map((item, index) =>
                  renderTask(item, index, true, '#10B981'),
                )}
              </View>
            )}

            {/* EMPTY */}
            {!loading && totalTasks === 0 ? (
              <View style={styles.emptyContainer}>
                <View
                  style={[
                    styles.emptyIconCircle,
                    {
                      backgroundColor: isDark ? '#1F2937' : '#E5E7EB',
                    },
                  ]}
                >
                  <Icon
                    name={
                      type === 'location'
                        ? 'location-outline'
                        : type === 'time'
                        ? 'time-outline'
                        : 'list-outline'
                    }
                    size={34}
                    color={secondaryTextColor}
                  />
                </View>

                <Text
                  style={[
                    styles.emptyText,
                    {
                      color: primaryTextColor,
                    },
                  ]}
                >
                  No completed tasks yet
                </Text>

                <Text
                  style={[
                    styles.emptySubText,
                    {
                      color: secondaryTextColor,
                    },
                  ]}
                >
                  {type === 'location'
                    ? 'Completed location-based tasks will appear here.'
                    : type === 'time'
                    ? 'Completed time-based tasks will appear here.'
                    : 'Completed non-time-based tasks will appear here.'}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default HistoryScreen;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // =========================================================
  // HEADER
  // =========================================================
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerButtonPlaceholder: {
    width: 40,
  },

  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },

  headerText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },

  // =========================================================
  // TOGGLE
  // =========================================================
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
    alignItems: 'center',
  },

  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },

  toggleBtnActive: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },

  toggleIcon: {
    marginRight: 5,
  },

  toggleText: {
    fontSize: 12,
  },

  // =========================================================
  // LOADING / EMPTY
  // =========================================================
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },

  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },

  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },

  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 16,
    fontWeight: '700',
  },

  emptySubText: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 19,
  },

  // =========================================================
  // SECTIONS
  // =========================================================
  sectionContainer: {
    marginBottom: 18,
    gap: 10,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  section: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },

  countBadge: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignItems: 'center',
  },

  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // =========================================================
  // TASK CARDS
  // =========================================================
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },

  completedCard: {
    opacity: 0.85,
  },

  cardAccentStrip: {
    width: 4,
  },

  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },

  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },

  taskInfo: {
    flex: 1,
    gap: 3,
  },

  taskTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  completedText: {
    textDecorationLine: 'line-through',
  },

  taskDescription: {
    fontSize: 11.5,
    letterSpacing: 0.15,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },

  dateIcon: {
    marginTop: 1,
  },

  taskDate: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.15,
  },

  snoozedBadgeContainer: {
    alignSelf: 'flex-start',
    marginTop: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },

  snoozedBadge: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.4,
  },

  rightColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },

  completedBadgeContainer: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  completedBadge: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.4,
  },
});
