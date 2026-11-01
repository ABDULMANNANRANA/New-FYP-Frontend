import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseTaskDate } from './taskDates';

export const DATE_ONLY_SNOOZE_OPTIONS = [30, 60, 120, 180];
const keyFor = userId => `@date_only_reminders_v1:${userId}`;
let writes = Promise.resolve();
export const loadDateOnlyPreferences = async userId => {
  if (!userId) throw new Error('Please sign in again.');
  const raw = await AsyncStorage.getItem(keyFor(userId));
  let value;
  try {
    value = JSON.parse(raw || '{}');
  } catch {
    value = {};
  }
  return {
    snoozeMinutes: DATE_ONLY_SNOOZE_OPTIONS.includes(value?.snoozeMinutes)
      ? value.snoozeMinutes
      : 60,
    advanceSnoozes:
      value?.advanceSnoozes &&
      typeof value.advanceSnoozes === 'object' &&
      !Array.isArray(value.advanceSnoozes)
        ? value.advanceSnoozes
        : {},
    snoozes:
      value?.snoozes &&
      typeof value.snoozes === 'object' &&
      !Array.isArray(value.snoozes)
        ? value.snoozes
        : {},
  };
};
const update = (userId, patch) => {
  const work = writes
    .catch(() => {})
    .then(async () => {
      if (
        !userId ||
        String(await AsyncStorage.getItem('userId')) !== String(userId)
      )
        throw new Error('Please sign in again.');
      const current = await loadDateOnlyPreferences(userId);
      const next = patch(current);
      // Keep writes scoped to the captured account even if a logout occurs during storage I/O.
      await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next));
      return next;
    });
  writes = work;
  return work;
};
export const saveDateOnlySnoozeMinutes = (userId, minutes) => {
  if (!DATE_ONLY_SNOOZE_OPTIONS.includes(minutes))
    return Promise.reject(new Error('Invalid date-only snooze duration.'));
  return update(userId, value => ({ ...value, snoozeMinutes: minutes }));
};
export const saveDateOnlyTaskSnooze = (userId, task, wakeAt) =>
  update(userId, value => ({
    ...value,
    snoozes: {
      ...Object.fromEntries(
        Object.entries(value.snoozes).filter(
          ([, item]) => Number(item?.wakeAt) > Date.now() - 86400000,
        ),
      ),
      [task.id]: { dueDate: task.dueDate, wakeAt },
    },
  }));
export const saveAdvanceTaskSnooze = (userId, task, wakeAt) =>
  update(userId, value => ({
    ...value,
    advanceSnoozes: {
      ...Object.fromEntries(
        Object.entries(value.advanceSnoozes).filter(
          ([, item]) => Number(item?.wakeAt) > Date.now() - 86400000,
        ),
      ),
      [task.id]: { dueDate: task.dueDate, dueTime: task.dueTime, wakeAt },
    },
  }));
export const advanceWakeAt = (task, preferences) => {
  const item = preferences?.advanceSnoozes?.[task.id];
  return item?.dueDate === task.dueDate &&
    item?.dueTime === task.dueTime &&
    Number.isFinite(item.wakeAt)
    ? item.wakeAt
    : null;
};
export const isDateOnlyTask = task =>
  task?.isTimeBased === false &&
  !task.dueTime &&
  !task.geofenceEnabled &&
  task.latitude == null &&
  task.longitude == null;
export const dateOnlyWakeAt = (task, preferences) => {
  const item = preferences?.snoozes?.[task.id];
  return item?.dueDate === task.dueDate && Number.isFinite(item.wakeAt)
    ? item.wakeAt
    : null;
};
// Calendar slots are local 00:00, 03:00, ... 21:00. A rolling horizon is replenished while the app runs.
export const dateOnlyEvents = (
  task,
  preferences,
  now = Date.now(),
  days = 3,
) => {
  if (!isDateOnlyTask(task) || !task.dueDate) return [];
  const due = parseTaskDate(task.dueDate).getTime();
  if (!Number.isFinite(due)) return [];
  const wakeAt = dateOnlyWakeAt(task, preferences);
  const events = [];
  if (wakeAt && wakeAt >= now - 15 * 60000)
    events.push({ task, kind: 'date-only', at: wakeAt });
  const firstDay = new Date(now);
  firstDay.setHours(0, 0, 0, 0);
  for (let day = 0; day < days; day++) {
    for (let hour = 0; hour < 24; hour += 3) {
      const slot = new Date(firstDay);
      slot.setDate(slot.getDate() + day);
      slot.setHours(hour, 0, 0, 0);
      const at = slot.getTime();
      if (at >= due && at >= now - 15 * 60000 && (!wakeAt || at > wakeAt))
        events.push({ task, kind: 'date-only', at });
    }
  }
  return events;
};
export const formatSnooze = minutes =>
  minutes < 60
    ? `${minutes} mins`
    : `${minutes / 60} ${minutes === 60 ? 'hour' : 'hours'}`;
