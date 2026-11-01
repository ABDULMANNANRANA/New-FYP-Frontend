import AsyncStorage from '@react-native-async-storage/async-storage';

const listeners = new Set();
let revision = 0;
export const subscribeSession = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const sessionRevision = () => revision;
const emit = session => {
  revision += 1;
  listeners.forEach(listener => listener(session));
};
export const saveSession = async user => {
  await AsyncStorage.multiSet([
    ['token', user.token], ['userId', String(user.userId)],
    ['userName', user.fullName || ''],
  ]);
  emit({ userId: String(user.userId) });
};
export const clearSession = async () => {
  // Stop authenticated UI/watchers immediately, even if storage is slow.
  emit(null);
  await AsyncStorage.multiRemove(['token', 'userId', 'userName']);
};
