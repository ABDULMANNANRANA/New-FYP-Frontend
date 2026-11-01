import { AppState, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotification from 'react-native-push-notification';
import { apiClient } from './apiClient';
import { navigate } from '../navigation/navigationRef';
import { parseTaskDate } from './taskDates';
import {
  advanceWakeAt,
  dateOnlyEvents,
  dateOnlyWakeAt,
  isDateOnlyTask,
  loadDateOnlyPreferences,
  saveAdvanceTaskSnooze,
  saveDateOnlyTaskSnooze,
} from './dateOnlyReminders';

const CHANNEL_ID = 'task-reminders';
const IDS_KEY = '@task_reminder_ids_v2';
let running = false;
let generation = 0;
let configured = false;
let timers = [];
let cachedTasks = [];
let fired = {};
let firedKey = '';
let userId = null;
let enabled = true;
let scheduledIds = [];
let refreshPending = false;
let ticking = false;
let stopSubscription = null;
let pendingNotification = null;
let taskCacheLoaded = false;
let localPreferences = { snoozes: {}, advanceSnoozes: {} };

const isActiveTask = task =>
  task?.id &&
  task.dueDate &&
  (isDateOnlyTask(task) || (task.isTimeBased && task.dueTime)) &&
  !task.isCompleted &&
  !['done', 'completed', 'cancelled'].includes(
    String(task.status || '').toLowerCase(),
  );
const dueAt = task => parseTaskDate(task.dueDate, task.dueTime).getTime();
const fireKey = ({ task, kind, at }) =>
  `${task.id}:${task.dueDate}:${task.dueTime}:${kind}:${at}`;
const slimTask = task => ({
  id: task.id,
  title: task.title,
  description: task.description,
  dueDate: task.dueDate,
  dueTime: task.dueTime,
  isTimeBased: task.isTimeBased,
  status: task.status,
  geofenceEnabled: task.geofenceEnabled,
  latitude: task.latitude,
  longitude: task.longitude,
});
const eventsFor = task => {
  if (isDateOnlyTask(task)) return dateOnlyEvents(task, localPreferences);
  const due = dueAt(task);
  const advance = advanceWakeAt(task, localPreferences) || due - 30 * 60000;
  return [
    { task, kind: 'due', at: due },
    ...(advance < due ? [{ task, kind: 'advance', at: advance }] : []),
  ];
};
const allEvents = () =>
  cachedTasks
    .filter(isActiveTask)
    .flatMap(eventsFor)
    .filter(event => Number.isFinite(event.at))
    .sort((a, b) => a.at - b.at);
const markFired = async event => {
  fired[fireKey(event)] = Date.now();
  const key = firedKey;
  if (key) await AsyncStorage.setItem(key, JSON.stringify(fired));
};
const handleNotification = notification => {
  const data = notification?.data || notification?.userInfo || {};
  if (
    !running ||
    !enabled ||
    !notification?.userInteraction ||
    String(data.userId) !== String(userId)
  )
    return;
  if (!taskCacheLoaded) {
    pendingNotification = notification;
    return;
  }
  let task = data.task;
  if (typeof task === 'string') {
    try {
      task = JSON.parse(task);
    } catch {
      task = null;
    }
  }
  const currentTask = cachedTasks.find(
    item => String(item.id) === String(task?.id),
  );
  if (
    !currentTask ||
    !isActiveTask(currentTask) ||
    currentTask.dueDate !== task.dueDate ||
    currentTask.dueTime !== task.dueTime
  )
    return;
  const kind =
    data.kind ||
    (data.isAdvance === true || data.isAdvance === 'true' ? 'advance' : 'due');
  const at = Number(data.eventAt);
  if (kind === 'date-only') {
    const wake = dateOnlyWakeAt(currentTask, localPreferences);
    if (wake && at < wake) return;
  }
  if (kind === 'advance') {
    const wake = advanceWakeAt(currentTask, localPreferences);
    if (wake && at < wake) return;
  }
  const event = { task: currentTask, kind, at };
  if (Number.isFinite(at) && fired[fireKey(event)]) return;
  if (
    navigate('ReminderAlarmScreen', {
      task: slimTask(currentTask),
      isAdvance: kind === 'advance',
    })
  )
    markFired(event).catch(() => {});
};
const ensureConfigured = () => {
  if (configured) return;
  PushNotification.configure({
    onNotification: handleNotification,
    requestPermissions: false,
    popInitialNotification: true,
  });
  if (Platform.OS === 'android') {
    PushNotification.createChannel({
      channelId: CHANNEL_ID,
      channelName: 'Task Reminders',
      importance: 4,
      vibrate: true,
    });
    if (Platform.Version >= 33)
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      ).catch(() => {});
  } else {
    PushNotification.requestPermissions().catch(() => {});
  }
  configured = true;
};
const cancelScheduled = () => {
  scheduledIds.forEach(id =>
    PushNotification.cancelLocalNotification(String(id)),
  );
  scheduledIds = [];
};
const schedule = async () => {
  cancelScheduled();
  const events = enabled
    ? allEvents()
        .filter(event => event.at > Date.now())
        .slice(0, 60)
    : [];
  // Nearest 60 notifications; date-only slots cover a rolling three-day horizon.
  events.forEach(({ task, kind, at }, index) => {
    const id =
      kind === 'date-only'
        ? 500000000 + index
        : 1000000000 + Number(task.id) * 2 + (kind === 'due' ? 1 : 0);
    if (!Number.isSafeInteger(id) || id > 2147483647) return;
    PushNotification.localNotificationSchedule({
      id: String(id),
      channelId: CHANNEL_ID,
      date: new Date(at),
      allowWhileIdle: true,
      title:
        kind === 'advance'
          ? 'Task Reminder'
          : kind === 'date-only'
          ? 'Date-Only Task Reminder'
          : 'Task Time!',
      message:
        kind === 'date-only'
          ? `Remember to complete "${task.title || 'Task'}".`
          : kind === 'advance'
          ? `"${task.title || 'Task'}" is due soon.`
          : `It's time for "${task.title || 'Task'}".`,
      playSound: true,
      soundName: 'default',
      userInfo: {
        task: JSON.stringify(slimTask(task)),
        userId: String(userId),
        isAdvance: kind === 'advance',
        kind,
        eventAt: at,
      },
    });
    scheduledIds.push(String(id));
  });
  await AsyncStorage.setItem(IDS_KEY, JSON.stringify(scheduledIds));
};
const tick = async () => {
  if (!running || !enabled || ticking || AppState.currentState !== 'active')
    return;
  ticking = true;
  try {
    for (const event of allEvents()) {
      const difference = event.at - Date.now();
      const soonAdvance =
        event.kind === 'advance' &&
        !advanceWakeAt(event.task, localPreferences) &&
        dueAt(event.task) > Date.now() &&
        difference <= 0;
      if (
        !(soonAdvance || (difference <= 0 && difference >= -15 * 60000)) ||
        fired[fireKey(event)]
      )
        continue;
      if (
        !navigate('ReminderAlarmScreen', {
          task: slimTask(event.task),
          isAdvance: event.kind === 'advance',
        })
      )
        return;
      await markFired(event);
      return;
    }
  } finally {
    ticking = false;
  }
};
export const refreshSelfTaskReminders = async () => {
  if (!running || refreshPending) return;
  const current = generation;
  const id = userId;
  refreshPending = true;
  try {
    const [timed, dated, preferences] = await Promise.all([
      apiClient('/User/tasks?isTimeBased=true'),
      apiClient('/User/tasks?isTimeBased=false'),
      loadDateOnlyPreferences(id),
    ]);
    if (current !== generation || !running) return;
    localPreferences = preferences;
    const rows = [
      ...(Array.isArray(timed?.data) ? timed.data : []),
      ...(Array.isArray(dated?.data) ? dated.data : []),
    ];
    cachedTasks = [...new Map(rows.map(task => [task.id, task])).values()]
      .filter(isActiveTask)
      .filter(task =>
        task.assignedTo != null
          ? String(task.assignedTo) === String(id)
          : !task.groupId && String(task.createdBy) === String(id),
      );
    taskCacheLoaded = true;
    await schedule();
    if (current === generation && running) {
      const notification = pendingNotification;
      pendingNotification = null;
      if (notification) handleNotification(notification);
      await tick();
    }
  } catch (failure) {
    if (failure.isSessionExpired && current === generation)
      stopSelfTaskReminders();
    // Keep valid native schedules during a temporary network failure.
  } finally {
    if (current === generation) refreshPending = false;
  }
};
export const updateReminderPreferences = async notificationEnabled => {
  enabled = notificationEnabled;
  if (running) {
    await schedule();
    await tick();
  }
};
export const onTaskSnoozed = async taskId => {
  Object.keys(fired).forEach(key => {
    if (key.startsWith(`${taskId}:`)) delete fired[key];
  });
  await refreshSelfTaskReminders();
};
export const snoozeDateOnlyTask = async taskId => {
  const current = generation;
  const task = cachedTasks.find(item => String(item.id) === String(taskId));
  if (!running || !task || !isDateOnlyTask(task))
    throw new Error('Refresh your task list and try again.');
  const preferences = await loadDateOnlyPreferences(userId);
  if (current !== generation || !running)
    throw new Error('Please sign in again.');
  const wakeAt = Date.now() + preferences.snoozeMinutes * 60000;
  const next = await saveDateOnlyTaskSnooze(userId, task, wakeAt);
  if (current === generation && running) {
    localPreferences = next;
    await schedule();
  }
  return wakeAt;
};
export const snoozeAdvanceTask = async (taskId, minutes) => {
  const current = generation;
  const task = cachedTasks.find(item => String(item.id) === String(taskId));
  if (
    !running ||
    !task ||
    !task.isTimeBased ||
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > 1440
  )
    throw new Error('Refresh your task list and try again.');
  const wakeAt = Math.min(Date.now() + minutes * 60000, dueAt(task));
  const next = await saveAdvanceTaskSnooze(userId, task, wakeAt);
  if (current === generation && running) {
    localPreferences = next;
    await schedule();
  }
  return wakeAt;
};
export const stopSelfTaskReminders = () => {
  running = false;
  generation += 1;
  timers.forEach(clearInterval);
  timers = [];
  stopSubscription?.remove();
  stopSubscription = null;
  cancelScheduled();
  AsyncStorage.setItem(IDS_KEY, '[]').catch(() => {});
  cachedTasks = [];
  fired = {};
  firedKey = '';
  userId = null;
  refreshPending = false;
  pendingNotification = null;
  taskCacheLoaded = false;
  localPreferences = { snoozes: {}, advanceSnoozes: {} };
};
export const startSelfTaskReminders = () => {
  if (running) return () => {};
  running = true;
  const current = ++generation;
  (async () => {
    try {
      const id = await AsyncStorage.getItem('userId');
      if (current !== generation || !running || !id) return;
      userId = id;
      let oldIds = [];
      try {
        oldIds = JSON.parse((await AsyncStorage.getItem(IDS_KEY)) || '[]');
      } catch {
        /* Corrupt cache is safely ignored. */
      }
      if (current !== generation || !running) return;
      if (Array.isArray(oldIds))
        oldIds.forEach(value =>
          PushNotification.cancelLocalNotification(String(value)),
        );
      firedKey = `@reminder_fired_v2:${userId}`;
      const raw = await AsyncStorage.getItem(firedKey);
      if (current !== generation || !running) return;
      try {
        fired = JSON.parse(raw || '{}') || {};
      } catch {
        fired = {};
      }
      for (const key of Object.keys(fired)) {
        if (fired[key] < Date.now() - 86400000) delete fired[key];
      }
      try {
        const settings = await apiClient('/User/settings');
        if (current !== generation || !running) return;
        enabled = settings?.data?.notificationEnabled !== false;
      } catch {
        enabled = true;
      }
      if (current !== generation || !running) return;
      ensureConfigured();
      await refreshSelfTaskReminders();
      if (current !== generation || !running) return;
      timers = [
        setInterval(refreshSelfTaskReminders, 300000),
        setInterval(tick, 20000),
      ];
      stopSubscription = AppState.addEventListener('change', state => {
        if (state === 'active') refreshSelfTaskReminders();
      });
    } catch (failure) {
      if (current === generation) stopSelfTaskReminders();
    }
  })();
  return stopSelfTaskReminders;
};
