import { clearSession } from '../../utils/session';
import React, { useCallback, useState } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Icon from '@react-native-vector-icons/ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { BASE_URL } from '../../config/api';
import { useTheme } from '../../context/ThemeContext';

const goToLogin = navigation => {
  clearSession().catch(() => {});
  navigation.reset({
    index: 0,
    routes: [
      {
        name: 'AuthStack',
        state: {
          routes: [
            {
              name: 'Login',
            },
          ],
        },
      },
    ],
  });
};

const NotificationScreen = () => {
  const { isDark, theme } = useTheme();
  const navigation = useNavigation();
  const { width: windowWidth } = useWindowDimensions();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter(
    n => !n.isRead,
  ).length;

  const maxContentWidth = Math.min(windowWidth, 600);

  const getToken = useCallback(async () => {
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
          ],
        );

        return null;
      }

      return token;
    } catch (error) {
      console.log('Get Token Error:', error);
      return null;
    }
  }, [navigation]);

  const getNotificationType = notification => {
    const type = String(notification?.type || '').toLowerCase();

    if (
      type.includes('pick') ||
      type.includes('picked') ||
      type.includes('claim')
    ) {
      return 'pick';
    }

    if (
      type.includes('ignore') ||
      type.includes('ignored') ||
      type.includes('reject')
    ) {
      return 'ignore';
    }

    if (type.includes('mention')) {
      return 'mention';
    }

    if (
      type.includes('done') ||
      type.includes('complete')
    ) {
      return 'done';
    }

    if (type.includes('assign')) return 'assigned';

    if (type.includes('creat')) {
      return 'created';
    }

    if (type.includes('forward')) {
      return 'forward';
    }

    if (
      type.includes('time') ||
      type.includes('reminder') ||
      type.includes('alarm')
    ) {
      return 'time';
    }

    if (
      type.includes('group') ||
      type.includes('member') ||
      type.includes('add')
    ) {
      return 'group';
    }

    return 'default';
  };

  const getNotificationIcon = item => {
    switch (item.type) {
      case 'pick':
        return 'checkmark-circle-outline';

      case 'ignore':
        return 'close-circle-outline';

      case 'mention':
        return 'at-outline';

      case 'done':
        return 'checkmark-done-outline';

      case 'assigned':
        return 'person-add-outline';

      case 'created':
        return 'add-circle-outline';

      case 'forward':
        return 'arrow-redo-outline';

      case 'time':
        return 'alarm-outline';

      case 'group':
        return 'people-outline';

      default:
        return 'notifications-outline';
    }
  };

  const getNotificationIconColor = item => {
    switch (item.type) {
      case 'pick':
        return '#4CAF50';

      case 'ignore':
        return '#F44336';

      case 'mention':
        return '#00BCD4';

      case 'done':
        return '#2E7D32';

      case 'assigned':
      case 'created':
        return '#1976D2';

      case 'forward':
        return '#F57C00';

      case 'time':
        return '#2196F3';

      case 'group':
        return '#9C27B0';

      default:
        return '#FF9800';
    }
  };

  const getCardBackground = item => {
    if (item.isRead) {
      return theme.card || (isDark ? '#1E1E1E' : '#FFFFFF');
    }

    switch (item.type) {
      case 'pick':
        return isDark ? '#1B2E1E' : '#E8F5E9';

      case 'ignore':
        return isDark ? '#321C1C' : '#FFEBEE';

      case 'mention':
        return isDark ? '#16282B' : '#E0F7FA';

      case 'done':
        return isDark ? '#1B2E1E' : '#E8F5E9';

      case 'assigned':
      case 'created':
        return isDark ? '#1B2635' : '#E3F2FD';

      case 'forward':
        return isDark ? '#2E261B' : '#FFF8E1';

      case 'time':
        return isDark ? '#1B2635' : '#E3F2FD';

      case 'group':
        return isDark ? '#291D31' : '#F3E5F5';

      default:
        return isDark ? '#2E261B' : '#FFF8E1';
    }
  };

  const getTextColor = item => {
    if (item.isRead) {
      return theme.text || (isDark ? '#F5F5F5' : '#212121');
    }

    switch (item.type) {
      case 'pick':
        return isDark ? '#A5D6A7' : '#1B5E20';

      case 'ignore':
        return isDark ? '#FFCDD2' : '#B71C1C';

      case 'mention':
        return isDark ? '#80DEEA' : '#006064';

      case 'done':
        return isDark ? '#A5D6A7' : '#1B5E20';

      case 'assigned':
      case 'created':
        return isDark ? '#90CAF9' : '#0D47A1';

      case 'forward':
        return isDark ? '#FFE082' : '#795548';

      case 'time':
        return isDark ? '#90CAF9' : '#0D47A1';

      case 'group':
        return isDark ? '#CE93D8' : '#6A1B9A';

      default:
        return isDark ? '#FFE082' : '#795548';
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);

      const token = await getToken();

      if (!token) {
        return;
      }

      let url = `${BASE_URL}/Notification/GetNotifications`;

      console.log('Fetching Notifications:', url);

      let response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 404) {
        url = `${BASE_URL}/Notification`;

        console.log('Retrying Notifications:', url);

        response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }

      const text = await response.text();

      let data = [];

      try {
        data = text ? JSON.parse(text) : [];
      } catch (jsonError) {
        console.log('Notification JSON Parse Error:', jsonError);
        console.log('Server Response:', text);

        throw new Error('Invalid response received from notification server.');
      }

      console.log('Notification Response:', data);

      if (response.status === 401) {
        await clearSession();

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
          data?.message ||
            `Request failed with status ${response.status}`,
        );
      }

      if (!Array.isArray(data)) {
        console.log('Unexpected notification response:', data);
        setNotifications([]);
        return;
      }

      const realData = data.filter(notification => {
        const type = notification?.type;
        const senderId = notification?.senderId;

        const hasType =
          type != null && String(type).trim() !== '';

        return hasType || senderId != null;
      });

      const mappedNotifications = realData.map((notification, index) => {
        const notificationType = getNotificationType(notification);

        return {
          id:
            notification?.id != null
              ? notification.id.toString()
              : `notification-${index}`,

          notificationId: notification?.id ?? null,

          taskId: notification?.taskId ?? null,

          senderId: notification?.senderId ?? null,

          senderName:
            notification?.senderName?.trim() || 'Group Member',

          title:
            notification?.taskTitle?.trim() ||
            'Task Notification',

          message:
            notification?.message?.trim() ||
            'You have a new notification.',

          type: notificationType,

          backendType: notification?.type || null,

          isRead: notification?.isRead === true,

          sentAt: notification?.sentAt || null,

          time: notification?.sentAt
            ? new Date(notification.sentAt).toLocaleString()
            : 'Just now',
        };
      });

      setNotifications(mappedNotifications);
    } catch (error) {
      console.log('Fetch Notifications Error:', error);

      setNotifications([]);

      Alert.alert(
        'Error',
        error?.message || 'Failed to fetch notifications.',
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, navigation]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications]),
  );

  const markAsRead = async notificationId => {
    try {
      const token = await AsyncStorage.getItem('token');

      if (!token || !notificationId) {
        return;
      }

      const response = await fetch(
        `${BASE_URL}/Notification/${notificationId}/read`,
        {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.status === 401) {
        await clearSession();

        Alert.alert('Session Expired', 'Please login again.', [
          {
            text: 'OK',
            onPress: () => goToLogin(navigation),
          },
        ]);

        return;
      }

      if (!response.ok) {
        const text = await response.text();
        console.log('Mark Read Error:', text);
        return;
      }

      setNotifications(previous =>
        previous.map(item =>
          item.notificationId === notificationId
            ? {
                ...item,
                isRead: true,
              }
            : item,
        ),
      );
    } catch (error) {
      console.log('Mark Read Error:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = await getToken();

      if (!token) {
        return;
      }

      const response = await fetch(
        `${BASE_URL}/Notification/read-all`,
        {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const text = await response.text();

      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        data = {};
      }

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message ||
            'Failed to mark all notifications as read.',
        );
      }

      setNotifications(previous =>
        previous.map(item => ({
          ...item,
          isRead: true,
        })),
      );
    } catch (error) {
      console.log('Mark All Read Error:', error);

      Alert.alert(
        'Error',
        error?.message ||
          'Failed to mark all notifications as read.',
      );
    }
  };

  const renderItem = ({ item }) => {
    const textColor = getTextColor(item);
    const cardBg = getCardBackground(item);
    const iconColor = getNotificationIconColor(item);

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
          },
          !item.isRead && {
            borderWidth: 1.5,
            borderColor: iconColor,
          },
        ]}
        activeOpacity={0.85}
        onPress={() => {
          if (!item.isRead && item.notificationId) {
            markAsRead(item.notificationId);
          }
          if (item.taskId) navigation.navigate('TaskOverviewScreen', { task: { id: item.taskId, title: item.title } });
        }}
      >
        {/* ==================================================
            TOP ROW
        ================================================== */}

        <View style={styles.row}>
          {/* ==================================================
              ICON
          ================================================== */}

          <View
            style={[
              styles.avatarPlaceholder,
              {
                backgroundColor: iconColor,
              },
            ]}
          >
            <Icon
              name={getNotificationIcon(item)}
              size={23}
              color="#FFFFFF"
            />
          </View>

          {/* ==================================================
              TEXT
          ================================================== */}

          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text
                numberOfLines={2}
                style={[
                  styles.title,
                  {
                    color: textColor,
                  },
                ]}
              >
                {item.title}
              </Text>

              {!item.isRead && <View style={styles.unreadDot} />}
            </View>

            {/* ==================================================
                SENDER
            ================================================== */}

            {item.senderName ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.sender,
                  {
                    color: textColor,
                  },
                ]}
              >
                From: {item.senderName}
              </Text>
            ) : null}

            {/* ==================================================
                MESSAGE
            ================================================== */}

            {item.message ? (
              <Text
                numberOfLines={4}
                style={[
                  styles.msg,
                  {
                    color: textColor,
                  },
                ]}
              >
                {item.message}
              </Text>
            ) : null}
          </View>

          {/* ==================================================
              TYPE ICON
          ================================================== */}

          <View style={styles.typeIconContainer}>
            <Icon
              name={getNotificationIcon(item)}
              size={21}
              color={iconColor}
            />
          </View>
        </View>

        {/* ==================================================
            DIVIDER
        ================================================== */}

        <View
          style={[
            styles.divider,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
        />

        {/* ==================================================
            BOTTOM ROW
        ================================================== */}

        <View style={styles.bottomRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.time,
              {
                color: theme.text || (isDark ? '#AAA' : '#666'),
              },
            ]}
          >
            {item.time}
          </Text>

          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: item.isRead
                  ? isDark
                    ? '#333333'
                    : '#E0E0E0'
                  : `${iconColor}20`,
              },
            ]}
          >
            <Text
              style={[
                styles.typeText,
                {
                  color: item.isRead
                    ? theme.text || (isDark ? '#DDD' : '#555')
                    : iconColor,
                },
              ]}
            >
              {item.isRead
                ? 'READ'
                : item.type === 'pick'
                ? 'TASK PICKED'
                : item.type === 'ignore'
                ? 'TASK IGNORED'
                : item.type === 'time'
                ? 'REMINDER'
                : item.type === 'group'
                ? 'GROUP'
                : 'NEW'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor:
            theme.bg || (isDark ? '#121212' : '#F8F9FA'),
        },
      ]}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={
          theme.bg || (isDark ? '#121212' : '#F8F9FA')
        }
      />

      <View
        style={[
          styles.wrapper,
          {
            maxWidth: maxContentWidth,
          },
        ]}
      >
        {/* ======================================================
            HEADER
        ====================================================== */}

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
            hitSlop={{
              top: 12,
              bottom: 12,
              left: 12,
              right: 12,
            }}
            activeOpacity={0.7}
          >
            <Icon
              name="arrow-back"
              size={22}
              color={theme.text || (isDark ? '#FFF' : '#000')}
            />
          </TouchableOpacity>

          <View
            style={[
              styles.headerBox,
              {
                backgroundColor:
                  theme.headerBox ||
                  (isDark ? '#1E1E1E' : '#FFFFFF'),
              },
            ]}
          >
            <Text
              style={[
                styles.headerText,
                {
                  color: theme.text || (isDark ? '#FFF' : '#000'),
                },
              ]}
            >
              NOTIFICATIONS
            </Text>

            {unreadCount > 0 ? (
              <Text
                style={[
                  styles.headerCount,
                  {
                    color: isDark ? '#90CAF9' : '#2196F3',
                  },
                ]}
              >
                {unreadCount} unread
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.headerButton,
              unreadCount === 0 && { opacity: 0.4 },
            ]}
            onPress={markAllAsRead}
            disabled={unreadCount === 0}
            hitSlop={{
              top: 12,
              bottom: 12,
              left: 12,
              right: 12,
            }}
            activeOpacity={0.7}
          >
            <Icon
              name="checkmark-done-outline"
              size={22}
              color={theme.text || (isDark ? '#FFF' : '#000')}
            />
          </TouchableOpacity>
        </View>

        {/* ======================================================
            NOTIFICATION LIST
        ====================================================== */}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={theme.text || (isDark ? '#FFF' : '#000')}
            />

            <Text
              style={[
                styles.loadingText,
                {
                  color:
                    theme.text || (isDark ? '#FFF' : '#000'),
                },
              ]}
            >
              Loading notifications...
            </Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              notifications.length === 0 && styles.emptyList,
            ]}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View
                  style={[
                    styles.emptyIconBg,
                    {
                      backgroundColor: isDark
                        ? '#1E1E1E'
                        : '#EFEFEF',
                    },
                  ]}
                >
                  <Icon
                    name="notifications-off-outline"
                    size={48}
                    color={
                      theme.text ||
                      (isDark ? '#AAA' : '#666')
                    }
                  />
                </View>

                <Text
                  style={[
                    styles.emptyText,
                    {
                      color:
                        theme.text ||
                        (isDark ? '#FFF' : '#000'),
                    },
                  ]}
                >
                  No notifications
                </Text>

                <Text
                  style={[
                    styles.emptySubText,
                    {
                      color:
                        theme.text ||
                        (isDark ? '#AAA' : '#777'),
                    },
                  ]}
                >
                  You don't have any notifications yet.
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* ======================================================
          BOTTOM NAVIGATION
      ====================================================== */}

      <View
        style={[
          styles.bottomBarContainer,
          {
            backgroundColor:
              theme.bg || (isDark ? '#121212' : '#F8F9FA'),
          },
        ]}
      >
        <View
          style={[
            styles.bottom,
            {
              backgroundColor:
                theme.bottomNav ||
                (isDark ? '#1E1E1E' : '#2196F3'),
              maxWidth: maxContentWidth,
            },
          ]}
        >
          {/* HOME */}

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('HomeDashboard')}
            activeOpacity={0.7}
          >
            <Icon name="home" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {/* CONTACTS */}

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('ContactScreen')}
            activeOpacity={0.7}
          >
            <Icon name="people" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {/* HISTORY */}

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() =>
              navigation.navigate('HistoryScreen')
            }
            activeOpacity={0.7}
          >
            <Icon name="time" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {/* SETTINGS */}

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('SettingScreen')}
            activeOpacity={0.7}
          >
            <Icon name="settings" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default NotificationScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  wrapper: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 12 : 6,
    paddingBottom: 12,
  },

  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },

  headerBox: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,

    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },

      android: {
        elevation: 2,
      },
    }),
  },

  headerText: {
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.8,
  },

  headerCount: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 2,
  },

  listContent: {
    paddingTop: 8,
    paddingBottom: 100,
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,

    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 3,
        },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },

      android: {
        elevation: 3,
      },
    }),
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  textContainer: {
    flex: 1,
    paddingRight: 8,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    letterSpacing: 0.2,
  },

  sender: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    opacity: 0.85,
  },

  msg: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
    opacity: 0.9,
  },

  typeIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
    marginLeft: 6,
  },

  divider: {
    height: 1,
    marginVertical: 10,
  },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  time: {
    flex: 1,
    fontSize: 11,
    opacity: 0.65,
    marginRight: 8,
  },

  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  typeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '500',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },

  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },

  emptySubText: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
  },

  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 16 : 10,
    paddingTop: 6,
  },

  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '92%',
    height: 56,
    borderRadius: 28,

    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },

      android: {
        elevation: 6,
      },
    }),
  },

  iconBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
});
