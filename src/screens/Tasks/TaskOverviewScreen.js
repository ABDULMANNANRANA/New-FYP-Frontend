import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  StatusBar,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import Icon from '@react-native-vector-icons/ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BASE_URL } from '../../config/api';
import { useTheme } from '../../context/ThemeContext';
import { useCurrentLocation } from '../../context/LocationContext';
import { buildOsmMapHtml } from '../../services/osmMap';
import {
  distanceToTask,
  formatCoordinates,
  formatDistance,
  taskRadiusMeters,
} from '../../services/location';

// ============================================================
// RESET TO LOGIN
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
// SMALL FORMATTERS (display only)
// ============================================================

// "2026-10-01" -> "1 Oct 2026"
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const formatDate = value => {
  if (!value) {
    return null;
  }

  const parts = String(value).split('-');

  if (parts.length !== 3) {
    return String(value);
  }

  const year = parts[0];
  const month = MONTHS[Number(parts[1]) - 1] || parts[1];
  const day = Number(parts[2]);

  return `${day} ${month} ${year}`;
};

// "09:30:00" / "09:30" -> "09:30"
const formatTime = value => {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 5);
};

const TaskOverviewScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { position } = useCurrentLocation();

  // What the caller handed us (dashboard card, history row, alert...).
  const routeTask = route?.params?.task || {};

  // The full task: starts with the route params and is refined by the
  // task detail API, which always carries the saved place fields.
  const [task, setTask] = useState(routeTask);

  const [completed, setCompleted] = useState(
    Boolean(routeTask?.isCompleted) ||
      String(routeTask?.status || '').toLowerCase() === 'done'
  );

  const [detailLoading, setDetailLoading] = useState(
    Boolean(routeTask?.id)
  );

  // Dynamic Theme Colors
  const isDark = theme?.bg === '#121212' || theme?.bg === '#000000';
  const bgColor = theme?.bg || '#F4F6F9';
  const cardBg = theme?.card || '#FFFFFF';
  const textColor = theme?.text || '#0F172A';
  const navBg = theme?.bottomNav || '#0F172A';

  // ============================================================
  // LOAD FULL TASK DETAILS (backend fills in the saved place,
  // names, status... even when the caller had a partial object)
  // ============================================================
  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      if (!routeTask?.id) {
        setDetailLoading(false);
        return;
      }

      const token = await AsyncStorage.getItem('token');

      if (!token || cancelled) {
        setDetailLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${BASE_URL}/Task/task/${routeTask.id}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        );

        let data = null;

        try {
          const text = await response.text();
          data = text ? JSON.parse(text) : null;
        } catch (parseError) {
          data = null;
        }

        if (cancelled) {
          return;
        }

        if (response.ok && data?.success && data?.data) {
          // Route params first, API details override / complete them.
          setTask(previous => ({ ...previous, ...data.data }));
          setCompleted(
            Boolean(data.data.isCompleted) ||
              String(data.data.status || '').toLowerCase() === 'done'
          );
        }
      } catch (error) {
        // Offline or server down: keep showing what we already have.
        console.log('Task Detail Fetch Error:', error);
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [routeTask?.id]);

  // ============================================================
  // TASK TYPE / PLACE DERIVED VALUES
  // ============================================================
  const rawLatitude = task?.latitude ?? task?.Latitude ?? null;
  const rawLongitude = task?.longitude ?? task?.Longitude ?? null;

  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);

  const hasPlace =
    rawLatitude !== null &&
    rawLongitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    !(latitude === 0 && longitude === 0);

  const radiusMeters = taskRadiusMeters(task);
  const geofenceOn = hasPlace && task?.geofenceEnabled !== false;

  // IsTimeBased is the source of truth. A due date is present for both
  // time-based and non-time-based tasks, so it must not be used to infer mode.
  const dueDateValue = task?.dueDate ?? task?.DueDate ?? null;
  const dueTimeValue = task?.dueTime ?? task?.DueTime ?? null;
  const hasDateInfo = Boolean(dueDateValue);
  const dueTimeText =
    dueTimeValue === null || dueTimeValue === undefined
      ? ''
      : String(dueTimeValue).trim();
  // A due date alone does not make a task time-based. Treat a time as present
  // only when the API supplies an actual clock value (e.g. 09:30 or 09:30:00).
  const hasDueTime = /^\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(dueTimeText);
  const hasScheduleInfo = hasDateInfo || hasDueTime;

  const rawIsTimeBased = task?.isTimeBased ?? task?.IsTimeBased;
  const flagSaysTimeBased =
    rawIsTimeBased === true ||
    String(rawIsTimeBased).trim().toLowerCase() === 'true' ||
    String(rawIsTimeBased).trim() === '1';
  // Time Based requires both the saved flag and a real time. This also
  // handles older/inconsistent records whose flag is true but DueTime is null.
  const isTimeBasedTask = hasDueTime &&
    (rawIsTimeBased === null || rawIsTimeBased === undefined
      ? true
      : flagSaysTimeBased);

  // Older place-only tasks have coordinates but no date/time schedule.
  const isLocationOnlyTask = hasPlace && !hasScheduleInfo;

  const taskTypeLabel = isLocationOnlyTask
    ? 'LOCATION BASED'
    : isTimeBasedTask
      ? 'TIME BASED'
      : 'NON TIME BASED';

  const taskTypeColor = isLocationOnlyTask
    ? '#1D4ED8'
    : isTimeBasedTask
      ? '#7C3AED'
      : '#047857';

  // "You are 120 m away" — only with a live position.
  const distanceFromMe = hasPlace && position
    ? distanceToTask(position, task)
    : null;

  const mapHtml = useMemo(() => {
    if (!hasPlace) {
      return null;
    }

    return buildOsmMapHtml({
      latitude,
      longitude,
      radius: radiusMeters,
      userLatitude: position?.latitude ?? null,
      userLongitude: position?.longitude ?? null,
    });
  }, [hasPlace, latitude, longitude, radiusMeters, position?.latitude, position?.longitude]);

  const openInMaps = useCallback(() => {
    if (!hasPlace) {
      return;
    }

    const url =
      `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}` +
      `#map=17/${latitude}/${longitude}`;

    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open the map.');
    });
  }, [hasPlace, latitude, longitude]);

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

      Alert.alert(
        'Error',
        'Unable to get your login session.'
      );

      return null;
    }
  };

  // ============================================================
  // SAFE JSON RESPONSE
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
  // MARK TASK AS DONE
  // ============================================================
  const MarkAsDone = async () => {
    if (completed) {
      return;
    }

    if (!task?.id) {
      Alert.alert(
        'Error',
        'Task ID is missing.'
      );
      return;
    }

    const token = await getToken();

    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `${BASE_URL}/Task/${task.id}/done`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await getResponseData(response);

      console.log('Mark As Done Response:', data);

      if (response.status === 401) {
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

        return;
      }

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message || 'Failed to mark task as done.'
        );
      }

      setCompleted(true);
      setTask(previous => ({
        ...previous,
        status: 'Done',
        isCompleted: true,
      }));

      Alert.alert('Success', data?.message || 'Task marked as done.', [
        { text: 'OK' },
      ]);
    } catch (error) {
      console.log('MarkAsDone Error:', error);

      Alert.alert(
        'Error',
        error?.message || 'Unable to connect to the server.'
      );
    }
  };

  // ============================================================
  // DELETE TASK
  // ============================================================
  const DeleteTask = () => {
    if (!task?.id) {
      Alert.alert('Error', 'Task ID is missing.');
      return;
    }

    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task? This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();

              if (!token) {
                return;
              }

              const response = await fetch(
                `${BASE_URL}/Task/task/${task.id}`,
                {
                  method: 'DELETE',
                  headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              const data =
                await getResponseData(response);

              console.log(
                'Delete Task Response:',
                data
              );

              if (response.status === 401) {
                Alert.alert(
                  'Session Expired',
                  'Your session has expired. Please login again.',
                  [
                    {
                      text: 'OK',
                      onPress: () =>
                        goToLogin(navigation),
                    },
                  ]
                );

                return;
              }

              if (
                !response.ok ||
                !data?.success
              ) {
                throw new Error(
                  data?.message ||
                    'Failed to delete task'
                );
              }

              Alert.alert(
                'Success',
                data?.message ||
                  'Task deleted successfully.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      navigation.goBack();
                    },
                  },
                ]
              );
            } catch (error) {
              console.log(
                'DeleteTask Error:',
                error
              );

              Alert.alert(
                'Error',
                error?.message ||
                  'Unable to connect to the server.'
              );
            }
          },
        },
      ]
    );
  };

  // ============================================================
  // NAVIGATE TO FORWARD TASK
  // ============================================================
  const handleForward = () => {
    if (!task?.id) {
      Alert.alert(
        'Error',
        'Task ID is missing.'
      );
      return;
    }

    navigation.navigate(
      'ForwardTaskTo',
      {
        taskId: task.id,
        task: task,
      }
    );
  };

  const statusLabel = completed
    ? 'COMPLETED'
    : String(task?.status || '').toLowerCase() === 'snoozed'
      ? 'SNOOZED'
      : 'PENDING';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColor }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={bgColor}
      />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerIconBtn, { backgroundColor: cardBg }]}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevron-back" size={22} color={textColor} />
        </TouchableOpacity>

        <View style={[styles.headerBox, { backgroundColor: cardBg }]}>
          <Text style={[styles.headerText, { color: textColor }]}>
            TASK OVERVIEW
          </Text>
        </View>

        <TouchableOpacity
          onPress={DeleteTask}
          style={[styles.headerIconBtn, styles.deleteBtnBg]}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* MAIN SCROLLABLE CONTENT */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* TASK CARD */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          {/* Badge Row: status + task type */}
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.statusBadge,
                completed ? styles.statusCompletedBg : styles.statusPendingBg,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: completed ? '#10B981' : '#F59E0B' },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: completed ? '#065F46' : '#92400E' },
                ]}
              >
                {statusLabel}
              </Text>
            </View>

            <View
              style={[
                styles.typeBadge,
                isLocationOnlyTask
                  ? styles.typeLocationBg
                  : isTimeBasedTask
                    ? styles.typeTimeBg
                    : styles.typeNonTimeBg,
              ]}
            >
              <Icon
                name={
                  isLocationOnlyTask
                    ? 'location-outline'
                    : isTimeBasedTask
                      ? 'time-outline'
                      : 'list-outline'
                }
                size={12}
                color={taskTypeColor}
              />
              <Text
                style={[
                  styles.typeBadgeText,
                  { color: taskTypeColor },
                ]}
              >
                {taskTypeLabel}
              </Text>
            </View>

            {detailLoading ? (
              <ActivityIndicator
                size="small"
                color="#94A3B8"
                style={styles.detailSpinner}
              />
            ) : null}
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: textColor }]}>
            {task?.title || 'Untitled Task'}
          </Text>

          <View style={styles.divider} />

          {/* Description */}
          <Text style={styles.sectionLabel}>DESCRIPTION</Text>
          <Text style={[styles.desc, { color: textColor }]}>
            {task?.description || 'No description provided for this task.'}
          </Text>

          {/* Details Grid */}
          <View style={styles.infoBlock}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <View style={styles.infoIconWrapper}>
                  <Icon name="person-outline" size={16} color="#3B82F6" />
                </View>
                <View style={styles.infoTextGroup}>
                  <Text style={styles.infoLabel}>FROM</Text>
                  <Text
                    style={[styles.infoValue, { color: textColor }]}
                    numberOfLines={1}
                  >
                    {task?.createdByName ||
                      task?.from ||
                      task?.fromUserName ||
                      'Me'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.infoIconWrapper}>
                  <Icon name="person-circle-outline" size={16} color="#3B82F6" />
                </View>
                <View style={styles.infoTextGroup}>
                  <Text style={styles.infoLabel}>TO</Text>
                  <Text
                    style={[styles.infoValue, { color: textColor }]}
                    numberOfLines={1}
                  >
                    {task?.assignedToName || 'Me'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Show a date for both schedule types; show time only when the
                task is time-based. */}
            {hasScheduleInfo ? (
              <View style={styles.infoRow}>
                {hasDateInfo ? (
                  <View style={styles.infoItem}>
                    <View style={styles.infoIconWrapper}>
                      <Icon name="calendar-outline" size={16} color="#3B82F6" />
                    </View>
                    <View style={styles.infoTextGroup}>
                      <Text style={styles.infoLabel}>DATE</Text>
                      <Text style={[styles.infoValue, { color: textColor }]}>
                        {formatDate(dueDateValue) || 'N/A'}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {isTimeBasedTask && hasDueTime ? (
                  <View style={styles.infoItem}>
                    <View style={styles.infoIconWrapper}>
                      <Icon name="time-outline" size={16} color="#3B82F6" />
                    </View>
                    <View style={styles.infoTextGroup}>
                      <Text style={styles.infoLabel}>TIME</Text>
                      <Text style={[styles.infoValue, { color: textColor }]}>
                        {formatTime(dueTimeValue) || 'N/A'}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {/* PLACE CARD — everything a Location Based task is about */}
        {hasPlace ? (
          <View style={[styles.card, styles.placeCard, { backgroundColor: cardBg }]}>
            <View style={styles.placeHeader}>
              <View style={styles.placeHeaderLeft}>
                <Icon name="location" size={16} color="#1D4ED8" />
                <Text style={[styles.placeHeaderText, { color: textColor }]}>
                  SAVED PLACE
                </Text>
              </View>

              <View
                style={[
                  styles.geofenceChip,
                  geofenceOn ? styles.geofenceOnBg : styles.geofenceOffBg,
                ]}
              >
                <Icon
                  name={geofenceOn ? 'notifications' : 'notifications-off'}
                  size={11}
                  color={geofenceOn ? '#065F46' : '#991B1B'}
                />
                <Text
                  style={[
                    styles.geofenceChipText,
                    { color: geofenceOn ? '#065F46' : '#991B1B' },
                  ]}
                >
                  {geofenceOn ? 'REMINDER ON' : 'REMINDER OFF'}
                </Text>
              </View>
            </View>

            {/* Map preview */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openInMaps}
              style={styles.mapWrap}
            >
              {mapHtml ? (
                <WebView
                  originWhitelist={['*']}
                  source={{ html: mapHtml }}
                  style={styles.mapWebView}
                  scrollEnabled={false}
                  javaScriptEnabled
                  domStorageEnabled
                  pointerEvents="none"
                />
              ) : (
                <View style={styles.mapFallback}>
                  <Icon name="map-outline" size={28} color="#94A3B8" />
                </View>
              )}

              <View style={styles.mapTapHint}>
                <Icon name="expand-outline" size={12} color="#FFFFFF" />
                <Text style={styles.mapTapHintText}>TAP TO OPEN MAP</Text>
              </View>
            </TouchableOpacity>

            {/* Distance from me */}
            {distanceFromMe !== null ? (
              <View style={styles.placeDistanceRow}>
                <Icon name="walk-outline" size={14} color="#1D4ED8" />
                <Text style={styles.placeDistanceText}>
                  You are {formatDistance(distanceFromMe)} away from this place
                </Text>
              </View>
            ) : null}

            {/* Coordinates / radius */}
            <View style={styles.placeInfoBlock}>
              <View style={styles.placeInfoRow}>
                <View style={styles.placeInfoIcon}>
                  <Icon name="pin-outline" size={15} color="#1D4ED8" />
                </View>
                <View style={styles.placeInfoTextGroup}>
                  <Text style={styles.infoLabel}>COORDINATES</Text>
                  <Text style={[styles.infoValue, { color: textColor }]}>
                    {formatCoordinates(latitude, longitude)}
                  </Text>
                </View>
              </View>

              <View style={styles.placeInfoRow}>
                <View style={styles.placeInfoIcon}>
                  <Icon name="radio-outline" size={15} color="#1D4ED8" />
                </View>
                <View style={styles.placeInfoTextGroup}>
                  <Text style={styles.infoLabel}>ALERT RADIUS</Text>
                  <Text style={[styles.infoValue, { color: textColor }]}>
                    {`Remind me within ${formatDistance(radiusMeters)}`}
                  </Text>
                </View>
              </View>

              <View style={styles.placeInfoRow}>
                <View style={styles.placeInfoIcon}>
                  <Icon name="notifications-outline" size={15} color="#1D4ED8" />
                </View>
                <View style={styles.placeInfoTextGroup}>
                  <Text style={styles.infoLabel}>PLACE REMINDER</Text>
                  <Text style={[styles.infoValue, { color: textColor }]}>
                    {geofenceOn
                      ? 'Alerts when you arrive near this place'
                      : 'Arrival alerts are turned off'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Open externally */}
            <TouchableOpacity
              style={styles.openMapsBtn}
              onPress={openInMaps}
              activeOpacity={0.8}
            >
              <Icon name="map-outline" size={16} color="#1D4ED8" />
              <Text style={styles.openMapsText}>OPEN IN MAPS</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* BUTTON ACTIONS */}
        <View style={styles.btnWrap}>
          {/* MARK AS COMPLETED */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              completed && styles.completedBtn,
            ]}
            onPress={MarkAsDone}
            disabled={completed}
            activeOpacity={0.8}
          >
            <View style={styles.btnContent}>
              <Icon
                name={completed ? 'checkmark-circle' : 'checkmark-done-circle-outline'}
                size={20}
                color="#FFFFFF"
                style={styles.btnIcon}
              />
              <Text style={styles.primaryText}>
                {completed ? 'ALREADY COMPLETED' : 'MARK AS COMPLETED'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Only active tasks can be forwarded. Hide while the detail API
              is loading so a completed task never briefly shows this action. */}
          {!detailLoading && !completed ? (
            <TouchableOpacity
              style={[styles.primaryBtn, styles.secondaryBtn]}
              onPress={handleForward}
              activeOpacity={0.8}
            >
              <View style={styles.btnContent}>
                <Text style={styles.primaryText}>FORWARD TO</Text>
                <Icon
                  name="arrow-forward"
                  size={18}
                  color="#FFFFFF"
                  style={styles.btnIconRight}
                />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      {/* BOTTOM NAVIGATION */}
      <View style={[styles.bottom, { backgroundColor: navBg }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('HomeDashboard')}
          activeOpacity={0.7}
        >
          <Icon name="home-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('ContactScreen')}
          activeOpacity={0.7}
        >
          <Icon name="people-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Contacts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('TimeBasedHistoryScreen')}
          activeOpacity={0.7}
        >
          <Icon name="time-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('SettingScreen')}
          activeOpacity={0.7}
        >
          <Icon name="settings-outline" size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default TaskOverviewScreen;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90,
  },

  // HEADER
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
  },

  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },

  deleteBtnBg: {
    backgroundColor: '#FEF2F2',
  },

  headerBox: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },

  headerText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  // CARD
  card: {
    marginTop: 8,
    borderRadius: 20,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },

  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  statusPendingBg: {
    backgroundColor: '#FEF3C7',
  },

  statusCompletedBg: {
    backgroundColor: '#D1FAE5',
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // TASK TYPE BADGE
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  typeLocationBg: {
    backgroundColor: '#DBEAFE',
  },

  typeTimeBg: {
    backgroundColor: '#EDE9FE',
  },

  typeNonTimeBg: {
    backgroundColor: '#D1FAE5',
  },

  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  detailSpinner: {
    marginLeft: 4,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: 0.3,
  },

  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
    marginBottom: 8,
  },

  desc: {
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: 0.2,
    marginBottom: 20,
  },

  infoBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },

  infoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  infoIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  infoTextGroup: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 2,
  },

  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // PLACE CARD (location based tasks)
  placeCard: {
    borderColor: '#DBEAFE',
    borderWidth: 1,
  },

  placeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },

  placeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  placeHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },

  geofenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },

  geofenceOnBg: {
    backgroundColor: '#D1FAE5',
  },

  geofenceOffBg: {
    backgroundColor: '#FEE2E2',
  },

  geofenceChipText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  mapWrap: {
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
    justifyContent: 'center',
  },

  mapWebView: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  mapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },

  mapTapHint: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },

  mapTapHintText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  placeDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },

  placeDistanceText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    letterSpacing: 0.2,
  },

  placeInfoBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },

  placeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  placeInfoIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  placeInfoTextGroup: {
    flex: 1,
  },

  openMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
    paddingVertical: 11,
  },

  openMapsText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.8,
  },

  // BUTTON ACTIONS
  btnWrap: {
    marginTop: 18,
    gap: 12,
  },

  primaryBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#2563EB',
  },

  completedBtn: {
    backgroundColor: '#10B981',
  },

  secondaryBtn: {
    backgroundColor: '#0F172A',
  },

  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },

  btnIcon: {
    marginRight: 8,
  },

  btnIconRight: {
    marginLeft: 8,
  },

  primaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // BOTTOM NAV
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },

  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },

  navLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
















































// import React, { useState } from 'react';
// import {
//   SafeAreaView,
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   Alert,
//   ScrollView,
//   StatusBar,
//   Platform,
// } from 'react-native';

// import Icon from '@react-native-vector-icons/ionicons';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// import { BASE_URL } from '../../config/api';
// import { useTheme } from '../../context/ThemeContext';

// // ============================================================
// // RESET TO LOGIN
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

// const TaskOverviewScreen = ({ navigation, route }) => {
//   const { theme } = useTheme();

//   const task = route?.params?.task || {};

//   const [completed, setCompleted] = useState(
//     task?.isCompleted || false
//   );

//   // Dynamic Theme Colors
//   const isDark = theme?.bg === '#121212' || theme?.bg === '#000000';
//   const bgColor = theme?.bg || '#F4F6F9';
//   const cardBg = theme?.card || '#FFFFFF';
//   const textColor = theme?.text || '#0F172A';
//   const navBg = theme?.bottomNav || '#0F172A';

//   // ============================================================
//   // GET JWT TOKEN
//   // ============================================================
//   const getToken = async () => {
//     try {
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

//       Alert.alert(
//         'Error',
//         'Unable to get your login session.'
//       );

//       return null;
//     }
//   };

//   // ============================================================
//   // SAFE JSON RESPONSE
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
//   // MARK TASK AS DONE
//   // ============================================================
//   const MarkAsDone = async () => {
//     if (completed) {
//       return;
//     }

//     if (!task?.id) {
//       Alert.alert(
//         'Error',
//         'Task ID is missing.'
//       );
//       return;
//     }

//     try {
//       const token = await getToken();

//       if (!token) {
//         return;
//       }

//       const response = await fetch(
//         `${BASE_URL}/Task/${task.id}/done`,
//         {
//           method: 'POST',
//           headers: {
//             Accept: 'application/json',
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       const data = await getResponseData(response);

//       console.log(
//         'Mark Task Done Response:',
//         data
//       );

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

//       if (!response.ok || !data?.success) {
//         throw new Error(
//           data?.message ||
//             'Failed to mark task as done'
//         );
//       }

//       setCompleted(true);

//       Alert.alert(
//         '✅ Task Completed!',
//         `"${task.title || 'Task'}" has been marked as done. It will now appear in your history.`,
//         [
//           {
//             text: 'OK',
//             onPress: () => {
//               navigation.goBack();
//             },
//           },
//         ]
//       );
//     } catch (error) {
//       console.log(
//         'MarkAsDone Error:',
//         error
//       );

//       Alert.alert(
//         'Error',
//         error?.message ||
//           'Unable to connect to the server.'
//       );
//     }
//   };

//   // ============================================================
//   // DELETE TASK
//   // ============================================================
//   const DeleteTask = () => {
//     if (!task?.id) {
//       Alert.alert(
//         'Error',
//         'Task ID is missing.'
//       );
//       return;
//     }

//     Alert.alert(
//       'Delete Task',
//       'Are you sure you want to delete this task?',
//       [
//         {
//           text: 'Cancel',
//           style: 'cancel',
//         },

//         {
//           text: 'Delete',
//           style: 'destructive',

//           onPress: async () => {
//             try {
//               const token = await getToken();

//               if (!token) {
//                 return;
//               }

//               const response = await fetch(
//                 `${BASE_URL}/Task/task/${task.id}`,
//                 {
//                   method: 'DELETE',
//                   headers: {
//                     Accept: 'application/json',
//                     Authorization: `Bearer ${token}`,
//                   },
//                 }
//               );

//               const data =
//                 await getResponseData(response);

//               console.log(
//                 'Delete Task Response:',
//                 data
//               );

//               if (response.status === 401) {
//                 Alert.alert(
//                   'Session Expired',
//                   'Please login again.',
//                   [
//                     {
//                       text: 'OK',
//                       onPress: () =>
//                         goToLogin(navigation),
//                     },
//                   ]
//                 );

//                 return;
//               }

//               if (
//                 !response.ok ||
//                 !data?.success
//               ) {
//                 throw new Error(
//                   data?.message ||
//                     'Failed to delete task'
//                 );
//               }

//               Alert.alert(
//                 'Success',
//                 data?.message ||
//                   'Task deleted successfully.',
//                 [
//                   {
//                     text: 'OK',
//                     onPress: () => {
//                       navigation.goBack();
//                     },
//                   },
//                 ]
//               );
//             } catch (error) {
//               console.log(
//                 'DeleteTask Error:',
//                 error
//               );

//               Alert.alert(
//                 'Error',
//                 error?.message ||
//                   'Unable to connect to the server.'
//               );
//             }
//           },
//         },
//       ]
//     );
//   };

//   // ============================================================
//   // NAVIGATE TO FORWARD TASK
//   // ============================================================
//   const handleForward = () => {
//     if (!task?.id) {
//       Alert.alert(
//         'Error',
//         'Task ID is missing.'
//       );
//       return;
//     }

//     navigation.navigate(
//       'ForwardTaskTo',
//       {
//         taskId: task.id,
//         task: task,
//       }
//     );
//   };

//   return (
//     <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColor }]}>
//       <StatusBar
//         barStyle={isDark ? 'light-content' : 'dark-content'}
//         backgroundColor={bgColor}
//       />

//       {/* HEADER */}
//       <View style={styles.header}>
//         <TouchableOpacity
//           onPress={() => navigation.goBack()}
//           style={[styles.headerIconBtn, { backgroundColor: cardBg }]}
//           activeOpacity={0.7}
//           hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
//         >
//           <Icon name="chevron-back" size={22} color={textColor} />
//         </TouchableOpacity>

//         <View style={[styles.headerBox, { backgroundColor: cardBg }]}>
//           <Text style={[styles.headerText, { color: textColor }]}>
//             TASK OVERVIEW
//           </Text>
//         </View>

//         <TouchableOpacity
//           onPress={DeleteTask}
//           style={[styles.headerIconBtn, styles.deleteBtnBg]}
//           activeOpacity={0.7}
//           hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
//         >
//           <Icon name="trash-outline" size={20} color="#EF4444" />
//         </TouchableOpacity>
//       </View>

//       {/* MAIN SCROLLABLE CONTENT */}
//       <ScrollView
//         contentContainerStyle={styles.scrollContent}
//         showsVerticalScrollIndicator={false}
//         bounces={true}
//       >
//         {/* TASK CARD */}
//         <View style={[styles.card, { backgroundColor: cardBg }]}>
//           {/* Badge Row */}
//           <View style={styles.badgeRow}>
//             <View
//               style={[
//                 styles.statusBadge,
//                 completed ? styles.statusCompletedBg : styles.statusPendingBg,
//               ]}
//             >
//               <View
//                 style={[
//                   styles.statusDot,
//                   { backgroundColor: completed ? '#10B981' : '#F59E0B' },
//                 ]}
//               />
//               <Text
//                 style={[
//                   styles.statusText,
//                   { color: completed ? '#065F46' : '#92400E' },
//                 ]}
//               >
//                 {completed ? 'COMPLETED' : 'PENDING'}
//               </Text>
//             </View>
//           </View>

//           {/* Title */}
//           <Text style={[styles.title, { color: textColor }]}>
//             {task?.title || 'Untitled Task'}
//           </Text>

//           <View style={styles.divider} />

//           {/* Description */}
//           <Text style={styles.sectionLabel}>DESCRIPTION</Text>
//           <Text style={[styles.desc, { color: textColor }]}>
//             {task?.description || 'No description provided for this task.'}
//           </Text>

//           {/* Details Grid */}
//           <View style={styles.infoBlock}>
//             <View style={styles.infoRow}>
//               <View style={styles.infoItem}>
//                 <View style={styles.infoIconWrapper}>
//                   <Icon name="person-outline" size={16} color="#3B82F6" />
//                 </View>
//                 <View style={styles.infoTextGroup}>
//                   <Text style={styles.infoLabel}>FROM</Text>
//                   <Text
//                     style={[styles.infoValue, { color: textColor }]}
//                     numberOfLines={1}
//                   >
//                     {task?.from ||
//                       task?.fromUserName ||
//                       task?.createdByName ||
//                       'Me'}
//                   </Text>
//                 </View>
//               </View>

//               <View style={styles.infoItem}>
//                 <View style={styles.infoIconWrapper}>
//                   <Icon name="person-circle-outline" size={16} color="#3B82F6" />
//                 </View>
//                 <View style={styles.infoTextGroup}>
//                   <Text style={styles.infoLabel}>TO</Text>
//                   <Text
//                     style={[styles.infoValue, { color: textColor }]}
//                     numberOfLines={1}
//                   >
//                     Me
//                   </Text>
//                 </View>
//               </View>
//             </View>

//             <View style={styles.infoRow}>
//               <View style={styles.infoItem}>
//                 <View style={styles.infoIconWrapper}>
//                   <Icon name="calendar-outline" size={16} color="#3B82F6" />
//                 </View>
//                 <View style={styles.infoTextGroup}>
//                   <Text style={styles.infoLabel}>DATE</Text>
//                   <Text style={[styles.infoValue, { color: textColor }]}>
//                     {task?.dueDate || 'N/A'}
//                   </Text>
//                 </View>
//               </View>

//               <View style={styles.infoItem}>
//                 <View style={styles.infoIconWrapper}>
//                   <Icon name="time-outline" size={16} color="#3B82F6" />
//                 </View>
//                 <View style={styles.infoTextGroup}>
//                   <Text style={styles.infoLabel}>TIME</Text>
//                   <Text style={[styles.infoValue, { color: textColor }]}>
//                     {task?.dueTime || 'N/A'}
//                   </Text>
//                 </View>
//               </View>
//             </View>
//           </View>
//         </View>

//         {/* BUTTON ACTIONS */}
//         <View style={styles.btnWrap}>
//           {/* MARK AS COMPLETED */}
//           <TouchableOpacity
//             style={[
//               styles.primaryBtn,
//               completed && styles.completedBtn,
//             ]}
//             onPress={MarkAsDone}
//             disabled={completed}
//             activeOpacity={0.8}
//           >
//             <View style={styles.btnContent}>
//               <Icon
//                 name={completed ? 'checkmark-circle' : 'checkmark-done-circle-outline'}
//                 size={20}
//                 color="#FFFFFF"
//                 style={styles.btnIcon}
//               />
//               <Text style={styles.primaryText}>
//                 {completed ? 'ALREADY COMPLETED' : 'MARK AS COMPLETED'}
//               </Text>
//             </View>
//           </TouchableOpacity>

//           {/* FORWARD */}
//           <TouchableOpacity
//             style={[styles.primaryBtn, styles.secondaryBtn]}
//             onPress={handleForward}
//             activeOpacity={0.8}
//           >
//             <View style={styles.btnContent}>
//               <Text style={styles.primaryText}>FORWARD TO</Text>
//               <Icon
//                 name="arrow-forward"
//                 size={18}
//                 color="#FFFFFF"
//                 style={styles.btnIconRight}
//               />
//             </View>
//           </TouchableOpacity>
//         </View>
//       </ScrollView>

//       {/* BOTTOM NAVIGATION */}
//       <View style={[styles.bottom, { backgroundColor: navBg }]}>
//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() => navigation.navigate('HomeDashboard')}
//           activeOpacity={0.7}
//         >
//           <Icon name="home-outline" size={22} color="#94A3B8" />
//           <Text style={styles.navLabel}>Home</Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() => navigation.navigate('ContactScreen')}
//           activeOpacity={0.7}
//         >
//           <Icon name="people-outline" size={22} color="#94A3B8" />
//           <Text style={styles.navLabel}>Contacts</Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() => navigation.navigate('TimeBasedHistoryScreen')}
//           activeOpacity={0.7}
//         >
//           <Icon name="time-outline" size={22} color="#94A3B8" />
//           <Text style={styles.navLabel}>History</Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() => navigation.navigate('SettingScreen')}
//           activeOpacity={0.7}
//         >
//           <Icon name="settings-outline" size={22} color="#94A3B8" />
//           <Text style={styles.navLabel}>Settings</Text>
//         </TouchableOpacity>
//       </View>
//     </SafeAreaView>
//   );
// };

// export default TaskOverviewScreen;

// // ============================================================
// // STYLES
// // ============================================================
// const styles = StyleSheet.create({
//   safeArea: {
//     flex: 1,
//   },

//   scrollContent: {
//     paddingHorizontal: 16,
//     paddingTop: 12,
//     paddingBottom: 90,
//   },

//   // HEADER
//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingHorizontal: 16,
//     paddingTop: Platform.OS === 'android' ? 12 : 8,
//     paddingBottom: 12,
//   },

//   headerIconBtn: {
//     width: 42,
//     height: 42,
//     borderRadius: 12,
//     justifyContent: 'center',
//     alignItems: 'center',
//     elevation: 2,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.05,
//     shadowRadius: 4,
//   },

//   deleteBtnBg: {
//     backgroundColor: '#FEF2F2',
//   },

//   headerBox: {
//     paddingHorizontal: 20,
//     paddingVertical: 10,
//     borderRadius: 14,
//     elevation: 2,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.05,
//     shadowRadius: 4,
//   },

//   headerText: {
//     fontSize: 13,
//     fontWeight: '800',
//     letterSpacing: 1.2,
//   },

//   // CARD
//   card: {
//     marginTop: 8,
//     borderRadius: 20,
//     padding: 20,
//     elevation: 3,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.06,
//     shadowRadius: 8,
//   },

//   badgeRow: {
//     flexDirection: 'row',
//     justifyContent: 'flex-start',
//     marginBottom: 12,
//   },

//   statusBadge: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 10,
//     paddingVertical: 5,
//     borderRadius: 20,
//   },

//   statusPendingBg: {
//     backgroundColor: '#FEF3C7',
//   },

//   statusCompletedBg: {
//     backgroundColor: '#D1FAE5',
//   },

//   statusDot: {
//     width: 6,
//     height: 6,
//     borderRadius: 3,
//     marginRight: 6,
//   },

//   statusText: {
//     fontSize: 11,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//   },

//   title: {
//     fontSize: 20,
//     fontWeight: '700',
//     lineHeight: 28,
//     letterSpacing: 0.3,
//   },

//   divider: {
//     height: 1,
//     backgroundColor: '#E2E8F0',
//     marginVertical: 16,
//   },

//   sectionLabel: {
//     fontSize: 11,
//     fontWeight: '800',
//     color: '#94A3B8',
//     letterSpacing: 1.2,
//     marginBottom: 8,
//   },

//   desc: {
//     fontSize: 14,
//     lineHeight: 22,
//     letterSpacing: 0.2,
//     marginBottom: 20,
//   },

//   infoBlock: {
//     backgroundColor: '#F8FAFC',
//     borderRadius: 14,
//     padding: 14,
//     gap: 12,
//   },

//   infoRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//   },

//   infoItem: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//   },

//   infoIconWrapper: {
//     width: 32,
//     height: 32,
//     borderRadius: 8,
//     backgroundColor: '#EFF6FF',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 10,
//   },

//   infoTextGroup: {
//     flex: 1,
//   },

//   infoLabel: {
//     fontSize: 10,
//     fontWeight: '700',
//     color: '#64748B',
//     letterSpacing: 0.8,
//   },

//   infoValue: {
//     fontSize: 13,
//     fontWeight: '600',
//     marginTop: 2,
//   },

//   // BUTTONS
//   btnWrap: {
//     marginTop: 20,
//     alignItems: 'center',
//     gap: 12,
//     width: '100%',
//   },

//   primaryBtn: {
//     width: '100%',
//     height: 52,
//     backgroundColor: '#2563EB',
//     borderRadius: 16,
//     justifyContent: 'center',
//     alignItems: 'center',
//     elevation: 3,
//     shadowColor: '#2563EB',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.2,
//     shadowRadius: 6,
//   },

//   secondaryBtn: {
//     backgroundColor: '#0F172A',
//     shadowColor: '#000',
//   },

//   completedBtn: {
//     backgroundColor: '#10B981',
//     shadowColor: '#10B981',
//     opacity: 0.9,
//   },

//   btnContent: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },

//   btnIcon: {
//     marginRight: 8,
//   },

//   btnIconRight: {
//     marginLeft: 8,
//   },

//   primaryText: {
//     color: '#FFFFFF',
//     fontSize: 14,
//     fontWeight: '700',
//     letterSpacing: 0.8,
//   },

//   // BOTTOM NAVIGATION
//   bottom: {
//     position: 'absolute',
//     bottom: 0,
//     left: 0,
//     right: 0,
//     height: 68,
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     alignItems: 'center',
//     paddingHorizontal: 8,
//     borderTopLeftRadius: 20,
//     borderTopRightRadius: 20,
//     elevation: 12,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: -4 },
//     shadowOpacity: 0.1,
//     shadowRadius: 8,
//   },

//   iconBtn: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     height: '100%',
//   },

//   navLabel: {
//     color: '#94A3B8',
//     fontSize: 10,
//     fontWeight: '600',
//     marginTop: 3,
//   },
// });
















































// // import React, { useState } from 'react';
// // import {
// //   SafeAreaView,
// //   View,
// //   Text,
// //   StyleSheet,
// //   TouchableOpacity,
// //   Alert,
// // } from 'react-native';

// // import Icon from '@react-native-vector-icons/ionicons';
// // import AsyncStorage from '@react-native-async-storage/async-storage';

// // import { BASE_URL } from '../../config/api';
// // import { useTheme } from '../../context/ThemeContext';

// // // ============================================================
// // // RESET TO LOGIN
// // // ============================================================
// // // Login is inside AuthStack, not the root navigator.
// // // Therefore we reset to AuthStack and open Login.
// // // ============================================================

// // const goToLogin = navigation => {
// //   navigation.reset({
// //     index: 0,
// //     routes: [
// //       {
// //         name: 'AuthStack',
// //         state: {
// //           routes: [{ name: 'Login' }],
// //         },
// //       },
// //     ],
// //   });
// // };

// // const TaskOverviewScreen = ({ navigation, route }) => {
// //   const { theme } = useTheme();

// //   const task = route?.params?.task || {};

// //   const [completed, setCompleted] = useState(
// //     task?.isCompleted || false
// //   );

// //   // ============================================================
// //   // GET JWT TOKEN
// //   // ============================================================

// //   const getToken = async () => {
// //     try {
// //       const token = await AsyncStorage.getItem('token');

// //       if (!token) {
// //         Alert.alert(
// //           'Session Expired',
// //           'Your session has expired. Please login again.',
// //           [
// //             {
// //               text: 'OK',
// //               onPress: () => goToLogin(navigation),
// //             },
// //           ]
// //         );

// //         return null;
// //       }

// //       return token;
// //     } catch (error) {
// //       console.log('Get Token Error:', error);

// //       Alert.alert(
// //         'Error',
// //         'Unable to get your login session.'
// //       );

// //       return null;
// //     }
// //   };

// //   // ============================================================
// //   // SAFE JSON RESPONSE
// //   // ============================================================

// //   const getResponseData = async response => {
// //     try {
// //       const text = await response.text();

// //       if (!text) {
// //         return {};
// //       }

// //       return JSON.parse(text);
// //     } catch (error) {
// //       console.log('Response JSON Error:', error);
// //       return {};
// //     }
// //   };

// //   // ============================================================
// //   // MARK TASK AS DONE
// //   // ============================================================

// //   const MarkAsDone = async () => {
// //     if (completed) {
// //       return;
// //     }

// //     if (!task?.id) {
// //       Alert.alert(
// //         'Error',
// //         'Task ID is missing.'
// //       );
// //       return;
// //     }

// //     try {
// //       const token = await getToken();

// //       if (!token) {
// //         return;
// //       }

// //       // IMPORTANT:
// //       // HomeDashboard uses:
// //       // POST /Task/{id}/done
// //       //
// //       // NOT:
// //       // /tasks/{id}/done

// //       const response = await fetch(
// //         `${BASE_URL}/Task/${task.id}/done`,
// //         {
// //           method: 'POST',
// //           headers: {
// //             Accept: 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //         }
// //       );

// //       const data = await getResponseData(response);

// //       console.log(
// //         'Mark Task Done Response:',
// //         data
// //       );

// //       // ========================================================
// //       // SESSION EXPIRED
// //       // ========================================================

// //       if (response.status === 401) {
// //         Alert.alert(
// //           'Session Expired',
// //           'Please login again.',
// //           [
// //             {
// //               text: 'OK',
// //               onPress: () => goToLogin(navigation),
// //             },
// //           ]
// //         );

// //         return;
// //       }

// //       // ========================================================
// //       // CHECK RESPONSE
// //       // ========================================================

// //       if (!response.ok || !data?.success) {
// //         throw new Error(
// //           data?.message ||
// //             'Failed to mark task as done'
// //         );
// //       }

// //       setCompleted(true);

// //       Alert.alert(
// //         '✅ Task Completed!',
// //         `"${task.title || 'Task'}" has been marked as done. It will now appear in your history.`,
// //         [
// //           {
// //             text: 'OK',
// //             onPress: () => {
// //               navigation.goBack();
// //             },
// //           },
// //         ]
// //       );
// //     } catch (error) {
// //       console.log(
// //         'MarkAsDone Error:',
// //         error
// //       );

// //       Alert.alert(
// //         'Error',
// //         error?.message ||
// //           'Unable to connect to the server.'
// //       );
// //     }
// //   };

// //   // ============================================================
// //   // DELETE TASK
// //   // ============================================================

// //   const DeleteTask = () => {
// //     if (!task?.id) {
// //       Alert.alert(
// //         'Error',
// //         'Task ID is missing.'
// //       );
// //       return;
// //     }

// //     Alert.alert(
// //       'Delete Task',
// //       'Are you sure you want to delete this task?',
// //       [
// //         {
// //           text: 'Cancel',
// //           style: 'cancel',
// //         },

// //         {
// //           text: 'Delete',
// //           style: 'destructive',

// //           onPress: async () => {
// //             try {
// //               const token = await getToken();

// //               if (!token) {
// //                 return;
// //               }

// //               // IMPORTANT:
// //               // HomeDashboard uses:
// //               // DELETE /Task/task/{id}
// //               //
// //               // NOT:
// //               // /tasks/{id}

// //               const response = await fetch(
// //                 `${BASE_URL}/Task/task/${task.id}`,
// //                 {
// //                   method: 'DELETE',
// //                   headers: {
// //                     Accept: 'application/json',
// //                     Authorization: `Bearer ${token}`,
// //                   },
// //                 }
// //               );

// //               const data =
// //                 await getResponseData(response);

// //               console.log(
// //                 'Delete Task Response:',
// //                 data
// //               );

// //               // ==================================================
// //               // SESSION EXPIRED
// //               // ==================================================

// //               if (response.status === 401) {
// //                 Alert.alert(
// //                   'Session Expired',
// //                   'Please login again.',
// //                   [
// //                     {
// //                       text: 'OK',
// //                       onPress: () =>
// //                         goToLogin(navigation),
// //                     },
// //                   ]
// //                 );

// //                 return;
// //               }

// //               // ==================================================
// //               // CHECK RESPONSE
// //               // ==================================================

// //               if (
// //                 !response.ok ||
// //                 !data?.success
// //               ) {
// //                 throw new Error(
// //                   data?.message ||
// //                     'Failed to delete task'
// //                 );
// //               }

// //               Alert.alert(
// //                 'Success',
// //                 data?.message ||
// //                   'Task deleted successfully.',
// //                 [
// //                   {
// //                     text: 'OK',
// //                     onPress: () => {
// //                       navigation.goBack();
// //                     },
// //                   },
// //                 ]
// //               );
// //             } catch (error) {
// //               console.log(
// //                 'DeleteTask Error:',
// //                 error
// //               );

// //               Alert.alert(
// //                 'Error',
// //                 error?.message ||
// //                   'Unable to connect to the server.'
// //               );
// //             }
// //           },
// //         },
// //       ]
// //     );
// //   };

// //   // ============================================================
// //   // NAVIGATE TO FORWARD TASK
// //   // ============================================================

// //   const handleForward = () => {
// //     if (!task?.id) {
// //       Alert.alert(
// //         'Error',
// //         'Task ID is missing.'
// //       );
// //       return;
// //     }

// //     navigation.navigate(
// //       'ForwardTaskTo',
// //       {
// //         taskId: task.id,
// //         task: task,
// //       }
// //     );
// //   };

// //   // ============================================================
// //   // RENDER
// //   // ============================================================

// //   return (
// //     <SafeAreaView
// //       style={[
// //         styles.container,
// //         {
// //           backgroundColor: theme.bg,
// //         },
// //       ]}
// //     >
// //       {/* ======================================================
// //           HEADER
// //       ====================================================== */}

// //       <View style={styles.header}>
// //         <TouchableOpacity
// //           onPress={() => navigation.goBack()}
// //           style={styles.headerIcon}
// //         >
// //           <Icon
// //             name="arrow-back"
// //             size={22}
// //             color={theme.text}
// //           />
// //         </TouchableOpacity>

// //         <View
// //           style={[
// //             styles.headerBox,
// //             {
// //               backgroundColor:
// //                 theme.headerBox,
// //             },
// //           ]}
// //         >
// //           <Text
// //             style={[
// //               styles.headerText,
// //               {
// //                 color: theme.text,
// //               },
// //             ]}
// //           >
// //             TASK-OVERVIEW
// //           </Text>
// //         </View>

// //         <TouchableOpacity
// //           onPress={DeleteTask}
// //           style={styles.headerIcon}
// //         >
// //           <Icon
// //             name="trash-outline"
// //             size={22}
// //             color="#E52323"
// //           />
// //         </TouchableOpacity>
// //       </View>

// //       {/* ======================================================
// //           TASK CARD
// //       ====================================================== */}

// //       <View
// //         style={[
// //           styles.card,
// //           {
// //             backgroundColor: theme.card,
// //           },
// //         ]}
// //       >
// //         {/* DESCRIPTION */}

// //         <Text
// //           style={[
// //             styles.descTitle,
// //             {
// //               color: theme.text,
// //             },
// //           ]}
// //         >
// //           DESCRIPTION:
// //         </Text>

// //         <Text
// //           style={[
// //             styles.title,
// //             {
// //               color: theme.text,
// //             },
// //           ]}
// //         >
// //           {task?.title || 'NO TITLE'}
// //         </Text>

// //         <Text
// //           style={[
// //             styles.desc,
// //             {
// //               color: theme.text,
// //             },
// //           ]}
// //         >
// //           {task?.description ||
// //             'No description available.'}
// //         </Text>

// //         {/* TASK INFORMATION */}

// //         <View style={styles.infoBlock}>
// //           <Text
// //             style={[
// //               styles.info,
// //               {
// //                 color: theme.text,
// //               },
// //             ]}
// //           >
// //             From :{' '}
// //             {task?.from ||
// //               task?.fromUserName ||
// //               task?.createdByName ||
// //               'Me'}
// //           </Text>

// //           <Text
// //             style={[
// //               styles.info,
// //               {
// //                 color: theme.text,
// //               },
// //             ]}
// //           >
// //             To : Me
// //           </Text>

// //           <Text
// //             style={[
// //               styles.info,
// //               {
// //                 color: theme.text,
// //               },
// //             ]}
// //           >
// //             DATE : {task?.dueDate || 'N/A'}
// //           </Text>

// //           <Text
// //             style={[
// //               styles.info,
// //               {
// //                 color: theme.text,
// //               },
// //             ]}
// //           >
// //             TIME : {task?.dueTime || 'N/A'}
// //           </Text>

// //           <Text
// //             style={[
// //               styles.info,
// //               {
// //                 color: theme.text,
// //               },
// //             ]}
// //           >
// //             STATUS :{' '}
// //             {completed
// //               ? '✅ Completed'
// //               : '🕐 Pending'}
// //           </Text>
// //         </View>
// //       </View>

// //       {/* ======================================================
// //           BUTTONS
// //       ====================================================== */}

// //       <View style={styles.btnWrap}>
// //         {/* MARK AS COMPLETED */}

// //         <TouchableOpacity
// //           style={[
// //             styles.primaryBtn,
// //             completed &&
// //               styles.completedBtn,
// //           ]}
// //           onPress={MarkAsDone}
// //           disabled={completed}
// //           activeOpacity={0.8}
// //         >
// //           <Text style={styles.primaryText}>
// //             {completed
// //               ? 'ALREADY COMPLETED'
// //               : 'MARK AS COMPLETED'}
// //           </Text>

// //           <View style={styles.checkBox}>
// //             {completed && (
// //               <Icon
// //                 name="checkmark"
// //                 size={14}
// //                 color="#4CAF50"
// //               />
// //             )}
// //           </View>
// //         </TouchableOpacity>

// //         {/* FORWARD */}

// //         <TouchableOpacity
// //           style={styles.primaryBtn}
// //           onPress={handleForward}
// //           activeOpacity={0.8}
// //         >
// //           <Text style={styles.primaryText}>
// //             FORWARD TO
// //           </Text>

// //           <Icon
// //             name="arrow-forward"
// //             size={18}
// //             color="#fff"
// //           />
// //         </TouchableOpacity>
// //       </View>

// //       {/* ======================================================
// //           BOTTOM NAVIGATION
// //           Same navigation as HomeDashboard
// //       ====================================================== */}

// //       <View
// //         style={[
// //           styles.bottom,
// //           {
// //             backgroundColor:
// //               theme.bottomNav,
// //           },
// //         ]}
// //       >
// //         {/* HOME */}

// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               'HomeDashboard'
// //             )
// //           }
// //         >
// //           <Icon
// //             name="home"
// //             size={24}
// //             color="#fff"
// //           />
// //         </TouchableOpacity>

// //         {/* CONTACTS */}

// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               'ContactScreen'
// //             )
// //           }
// //         >
// //           <Icon
// //             name="people"
// //             size={24}
// //             color="#fff"
// //           />
// //         </TouchableOpacity>

// //         {/* HISTORY */}

// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               'TimeBasedHistoryScreen'
// //             )
// //           }
// //         >
// //           <Icon
// //             name="time"
// //             size={24}
// //             color="#fff"
// //           />
// //         </TouchableOpacity>

// //         {/* SETTINGS */}

// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               'SettingScreen'
// //             )
// //           }
// //         >
// //           <Icon
// //             name="settings"
// //             size={24}
// //             color="#fff"
// //           />
// //         </TouchableOpacity>
// //       </View>
// //     </SafeAreaView>
// //   );
// // };

// // export default TaskOverviewScreen;

// // // ============================================================
// // // STYLES
// // // ============================================================

// // const styles = StyleSheet.create({
// //   container: {
// //     flex: 1,
// //     backgroundColor: '#B7C9DB',
// //     paddingHorizontal: 16,
// //   },

// //   // ==========================================================
// //   // HEADER
// //   // ==========================================================

// //   header: {
// //     flexDirection: 'row',
// //     justifyContent: 'space-between',
// //     alignItems: 'center',
// //     marginTop: 10,
// //   },

// //   headerIcon: {
// //     width: 30,
// //     height: 30,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //   },

// //   headerBox: {
// //     backgroundColor: '#fff',
// //     paddingHorizontal: 18,
// //     paddingVertical: 6,
// //     borderRadius: 10,
// //     elevation: 3,
// //   },

// //   headerText: {
// //     fontWeight: '800',
// //     letterSpacing: 1,
// //   },

// //   // ==========================================================
// //   // TASK CARD
// //   // ==========================================================

// //   card: {
// //     marginTop: 30,
// //     borderRadius: 18,
// //     paddingVertical: 30,
// //     paddingHorizontal: 20,
// //     alignItems: 'center',
// //     elevation: 4,
// //   },

// //   descTitle: {
// //     fontWeight: '800',
// //     letterSpacing: 2,
// //     textDecorationLine: 'underline',
// //     marginBottom: 14,
// //   },

// //   title: {
// //     fontSize: 17,
// //     fontWeight: '800',
// //     letterSpacing: 1,
// //     marginBottom: 8,
// //     textAlign: 'center',
// //   },

// //   desc: {
// //     letterSpacing: 1,
// //     marginBottom: 6,
// //     textAlign: 'center',
// //   },

// //   infoBlock: {
// //     marginTop: 20,
// //     alignSelf: 'flex-start',
// //     width: '100%',
// //   },

// //   info: {
// //     fontWeight: '700',
// //     marginBottom: 8,
// //     letterSpacing: 1,
// //   },

// //   // ==========================================================
// //   // BUTTONS
// //   // ==========================================================

// //   btnWrap: {
// //     marginTop: 40,
// //     alignItems: 'center',
// //     gap: 16,
// //     width: '100%',
// //   },

// //   primaryBtn: {
// //     width: '80%',
// //     minHeight: 52,
// //     backgroundColor: '#000',
// //     borderRadius: 30,
// //     paddingVertical: 14,
// //     paddingHorizontal: 18,
// //     flexDirection: 'row',
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //     elevation: 5,
// //   },

// //   completedBtn: {
// //     backgroundColor: '#4CAF50',
// //   },

// //   primaryText: {
// //     color: '#fff',
// //     fontWeight: '800',
// //     letterSpacing: 1,
// //     textAlign: 'center',
// //   },

// //   checkBox: {
// //     position: 'absolute',
// //     right: 16,
// //     width: 20,
// //     height: 20,
// //     backgroundColor: '#fff',
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //     borderRadius: 4,
// //   },

// //   // ==========================================================
// //   // BOTTOM NAVIGATION
// //   // ==========================================================

// //   bottom: {
// //     position: 'absolute',
// //     bottom: 0,
// //     left: 0,
// //     right: 0,
// //     width: '109%',
// //     height: 65,
// //     flexDirection: 'row',
// //     justifyContent: 'space-around',
// //     alignItems: 'center',
// //     paddingHorizontal: 10,
// //     elevation: 10,
// //   },

// //   iconBtn: {
// //     flex: 1,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     height: '100%',
// //   },
// // });
