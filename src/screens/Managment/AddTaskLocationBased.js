import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from '@react-native-vector-icons/ionicons';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../../context/ThemeContext';
import { postJson } from '../../services/locationApi';
import LocationCard from '../../components/LocationCard';
import { takePickedLocation } from '../../services/locationPicker';
import { DEFAULT_GEOFENCE_RADIUS_METERS } from '../../services/location';

const formatDateForApi = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Build a local calendar date; toISOString() would shift the selected day
  // for users in time zones ahead of UTC.
  return `${year}-${month}-${day}`;
};

const formatTimeForApi = date => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}:00`;
};

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
 * Creates a task tied to a map location. Schedule choices are exclusive:
 * Time Based stores a date and a time, while Non Time Based stores a date only.
 */
const AddTaskLocationBased = ({ navigation, route }) => {
  const { theme } = useTheme();

  const groupIdParam = route?.params?.groupId;
  const isGroupTask =
    groupIdParam !== null &&
    groupIdParam !== undefined &&
    String(groupIdParam).trim() !== '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [taskMode, setTaskMode] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dueDateTime, setDueDateTime] = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return now;
  });

  const [geofence, setGeofence] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    geofenceRadiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
    geofenceEnabled: true,
  });

  const updateGeofence = useCallback(
    patch => setGeofence(current => ({ ...current, ...patch })),
    [],
  );

  const latitude = Number(geofence.latitude);
  const longitude = Number(geofence.longitude);
  const hasPlace =
    geofence.latitude !== null &&
    geofence.latitude !== undefined &&
    String(geofence.latitude).trim() !== '' &&
    geofence.longitude !== null &&
    geofence.longitude !== undefined &&
    String(geofence.longitude).trim() !== '' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  // The picker hands its selected map point back through the small shared
  // location store when this form regains focus.
  useFocusEffect(
    useCallback(() => {
      const picked = takePickedLocation();

      if (picked) {
        setGeofence(current => ({ ...current, ...picked }));
      }
    }, []),
  );

  const textColor = theme.text || '#0F172A';
  const subTextColor = theme.subText || '#64748B';
  const primaryColor = theme.primary || '#0EA5E9';
  const borderClr = theme.border || '#E2E8F0';
  const isDark = theme.bg === '#000000' || theme.bg === '#0F172A';
  const screenBg = theme.bg || '#FFFFFF';
  const cardBg = theme.card || (isDark ? '#1E293B' : '#FFFFFF');
  const inputBg = theme.inputBg || (isDark ? '#0F172A' : '#F8FAFC');

  const selectTaskMode = mode => {
    setTaskMode(current => (current === mode ? null : mode));
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android' || event?.type === 'dismissed') {
      setShowDatePicker(false);
    }

    if (!selectedDate) {
      return;
    }

    setDueDateTime(
      current =>
        new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          current.getHours(),
          current.getMinutes(),
          0,
          0,
        ),
    );
  };

  const handleTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android' || event?.type === 'dismissed') {
      setShowTimePicker(false);
    }

    if (!selectedTime) {
      return;
    }

    setDueDateTime(
      current =>
        new Date(
          current.getFullYear(),
          current.getMonth(),
          current.getDate(),
          selectedTime.getHours(),
          selectedTime.getMinutes(),
          0,
          0,
        ),
    );
  };

  const AddTask = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a task title.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please enter a task description.');
      return;
    }

    if (!taskMode) {
      Alert.alert(
        'Choose a Schedule',
        'Select either Time Based or Non Time Based before saving.',
      );
      return;
    }

    if (!hasPlace) {
      Alert.alert(
        'Set a Reminder Place',
        'Choose a point on the map or use your current location.',
      );
      return;
    }

    try {
      setLoading(true);

      const isTimeBased = taskMode === 'time';
      const payload = {
        title: title.trim(),
        description: description.trim(),
        dueDate: formatDateForApi(dueDateTime),
        dueTime: isTimeBased ? formatTimeForApi(dueDateTime) : null,
        isTimeBased,
        groupId: isGroupTask ? Number(groupIdParam) : null,
        latitude,
        longitude,
        geofenceRadiusMeters:
          Number(geofence.geofenceRadiusMeters) ||
          DEFAULT_GEOFENCE_RADIUS_METERS,
        geofenceEnabled: geofence.geofenceEnabled !== false,
      };

      const data = await postJson('/Managment/task', payload);

      if (!data?.success) {
        throw new Error(data?.message || 'Failed to create task.');
      }

      Alert.alert('Success', data.message || 'Task created successfully.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      if (error?.isSessionExpired) {
        Alert.alert('Session Expired', 'Please login again.', [
          { text: 'OK', onPress: () => goToLogin(navigation) },
        ]);
        return;
      }

      if (error?.kind === 'network') {
        Alert.alert('Connection Error', 'Could not reach the server.');
        return;
      }

      Alert.alert('Error', error?.message || 'Failed to create task.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    !loading &&
    Boolean(title.trim()) &&
    Boolean(description.trim()) &&
    Boolean(taskMode) &&
    hasPlace;

  const renderModeOption = (mode, label, helper, iconName) => {
    const selected = taskMode === mode;

    return (
      <TouchableOpacity
        key={mode}
        onPress={() => selectTaskMode(mode)}
        style={[
          styles.modeOption,
          {
            backgroundColor: selected ? `${primaryColor}18` : inputBg,
            borderColor: selected ? primaryColor : borderClr,
          },
        ]}
        activeOpacity={0.75}
        disabled={loading}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected, disabled: loading }}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: selected ? primaryColor : subTextColor,
              backgroundColor: selected ? primaryColor : 'transparent',
            },
          ]}
        >
          {selected ? (
            <Icon name="checkmark" size={15} color="#FFFFFF" />
          ) : null}
        </View>

        <View style={styles.modeTextWrap}>
          <Text style={[styles.modeLabel, { color: textColor }]}>{label}</Text>
          <Text style={[styles.modeHelper, { color: subTextColor }]}>
            {helper}
          </Text>
        </View>

        <Icon
          name={iconName}
          size={19}
          color={selected ? primaryColor : subTextColor}
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: screenBg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={screenBg}
      />

      <View
        style={[
          styles.header,
          { backgroundColor: screenBg, borderBottomColor: borderClr },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>

        <View
          style={[
            styles.headerBox,
            { backgroundColor: theme.headerBox || inputBg },
          ]}
        >
          <Text style={[styles.headerText, { color: textColor }]}>
            New Task
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: cardBg, borderColor: borderClr },
          ]}
        >
          <Text style={[styles.label, { color: textColor }]}>
            Task Schedule
          </Text>
          <Text style={[styles.cardHint, { color: subTextColor }]}>
            Choose one schedule. The two checkboxes are mutually exclusive.
          </Text>

          <View style={styles.modeList}>
            {renderModeOption(
              'time',
              'Time Based',
              'Save a due date and a reminder time.',
              'time-outline',
            )}
            {renderModeOption(
              'date',
              'Non Time Based',
              'Save a due date only; no time is stored.',
              'calendar-outline',
            )}
          </View>
        </View>

        {taskMode ? (
          <View
            style={[
              styles.card,
              { backgroundColor: cardBg, borderColor: borderClr },
            ]}
          >
            <Text style={[styles.label, { color: textColor }]}>
              {taskMode === 'time' ? 'Due Date & Time' : 'Due Date'}
            </Text>
            <Text style={[styles.cardHint, { color: subTextColor }]}>
              {taskMode === 'time'
                ? 'Both values will be sent to the API and saved with this task.'
                : 'Only the date will be sent to the API; the time will be empty.'}
            </Text>

            <TouchableOpacity
              style={[
                styles.dateSelector,
                { backgroundColor: inputBg, borderColor: borderClr },
              ]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.75}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Choose due date"
            >
              <View style={styles.dateInfo}>
                <Icon name="calendar-outline" size={20} color={primaryColor} />
                <Text style={[styles.dateText, { color: textColor }]}>
                  {dueDateTime.toLocaleDateString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <Text style={[styles.changeText, { color: primaryColor }]}>
                Change
              </Text>
            </TouchableOpacity>

            {showDatePicker ? (
              <View style={[styles.pickerWrap, { borderColor: borderClr }]}>
                <DateTimePicker
                  value={dueDateTime}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  onChange={handleDateChange}
                />
                {Platform.OS === 'ios' ? (
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(false)}
                    style={styles.pickerDone}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.pickerDoneText, { color: primaryColor }]}
                    >
                      Done
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {taskMode === 'time' ? (
              <>
                <Text
                  style={[styles.label, styles.timeLabel, { color: textColor }]}
                >
                  Due Time
                </Text>
                <TouchableOpacity
                  style={[
                    styles.dateSelector,
                    { backgroundColor: inputBg, borderColor: borderClr },
                  ]}
                  onPress={() => setShowTimePicker(true)}
                  activeOpacity={0.75}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Choose due time"
                >
                  <View style={styles.dateInfo}>
                    <Icon name="time-outline" size={20} color={primaryColor} />
                    <Text style={[styles.dateText, { color: textColor }]}>
                      {dueDateTime.toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text style={[styles.changeText, { color: primaryColor }]}>
                    Change
                  </Text>
                </TouchableOpacity>

                {showTimePicker ? (
                  <View style={[styles.pickerWrap, { borderColor: borderClr }]}>
                    <DateTimePicker
                      value={dueDateTime}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                      onChange={handleTimeChange}
                    />
                    {Platform.OS === 'ios' ? (
                      <TouchableOpacity
                        onPress={() => setShowTimePicker(false)}
                        style={styles.pickerDone}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.pickerDoneText,
                            { color: primaryColor },
                          ]}
                        >
                          Done
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        <View
          style={[
            styles.card,
            { backgroundColor: cardBg, borderColor: borderClr },
          ]}
        >
          <Text style={[styles.label, { color: textColor }]}>Task Title</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: inputBg,
                borderColor: borderClr,
                color: textColor,
              },
            ]}
            placeholder="e.g. Buy groceries"
            placeholderTextColor={subTextColor}
            value={title}
            onChangeText={setTitle}
            editable={!loading}
            maxLength={300}
            returnKeyType="next"
          />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: cardBg, borderColor: borderClr },
          ]}
        >
          <Text style={[styles.label, { color: textColor }]}>Description</Text>
          <TextInput
            style={[
              styles.descriptionInput,
              {
                backgroundColor: inputBg,
                borderColor: borderClr,
                color: textColor,
              },
            ]}
            placeholder="What needs to be done at this place?"
            placeholderTextColor={subTextColor}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!loading}
          />
        </View>

        <LocationCard
          value={geofence}
          onChange={updateGeofence}
          navigation={navigation}
        />

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.cancelBtn, { borderColor: borderClr }]}
            onPress={() => navigation.goBack()}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnText, { color: subTextColor }]}>
              CANCEL
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.btn,
              styles.submitBtn,
              { backgroundColor: primaryColor },
              !canSubmit && styles.btnDisabled,
            ]}
            onPress={AddTask}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>ADD TASK</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerBox: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  headerText: { fontSize: 15, fontWeight: '700' },
  headerSpacer: { width: 32 },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  cardHint: { fontSize: 12, lineHeight: 18, marginBottom: 10 },
  modeList: { marginTop: 2 },
  modeOption: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modeTextWrap: { flex: 1 },
  modeLabel: { fontSize: 14, fontWeight: '700' },
  modeHelper: { fontSize: 11.5, marginTop: 3 },
  dateSelector: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  dateInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dateText: { fontSize: 14, fontWeight: '600', marginLeft: 10 },
  changeText: { fontSize: 12, fontWeight: '700', marginLeft: 8 },
  timeLabel: { marginTop: 16 },
  pickerWrap: {
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 8,
    alignItems: 'center',
  },
  pickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pickerDoneText: { fontSize: 14, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  descriptionInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 96,
  },
  btnRow: { flexDirection: 'row', marginTop: 6 },
  btn: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  cancelBtn: {
    borderWidth: 1,
    marginRight: 10,
    backgroundColor: 'transparent',
  },
  submitBtn: { borderWidth: 0 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 14, fontWeight: '700' },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default AddTaskLocationBased;

















































// import React, { useCallback, useState } from 'react';
// import {
//   ActivityIndicator,
//   Alert,
//   SafeAreaView,
//   ScrollView,
//   StatusBar,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from 'react-native';
// import Icon from '@react-native-vector-icons/ionicons';
// import { useFocusEffect } from '@react-navigation/native';

// import { useTheme } from '../../context/ThemeContext';
// import { postJson } from '../../services/locationApi';
// import LocationCard from '../../components/LocationCard';
// import { takePickedLocation } from '../../services/locationPicker';
// import { DEFAULT_GEOFENCE_RADIUS_METERS } from '../../services/location';


// // Same local helper the other screens use: bounce to the Login screen
// // by resetting into the AuthStack.
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

// /**
//  * Add a LOCATION BASED task.
//  *
//  * Same family as AddTaskTimeBased / AddTaskNonTimeBased — the three radios
//  * switch between the three task types.
//  *
//  * The difference: this task has no date and no time. Its trigger is the
//  * place you save. The phone raises "you are near this place" when you come
//  * back within the radius, and the task shows up in the Non-Time lists
//  * (isTimeBased = false).
//  */
// const AddTaskLocationBased = ({ navigation, route }) => {
//   const { theme } = useTheme();

//   const groupIdParam = route?.params?.groupId;

//   const isGroupTask =
//     groupIdParam !== null &&
//     groupIdParam !== undefined &&
//     String(groupIdParam).trim() !== '';

//   const [title, setTitle] = useState('');
//   const [description, setDescription] = useState('');
//   const [loading, setLoading] = useState(false);

//   // The place this task belongs to. Required — it is the whole trigger.
//   const [geofence, setGeofence] = useState({
//     latitude: null,
//     longitude: null,
//     accuracy: null,
//     geofenceRadiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
//     geofenceEnabled: true,
//   });

//   const hasPlace =
//     geofence.latitude !== null && geofence.longitude !== null;

//   // Collect the spot chosen on the map when we come back into focus.
//   useFocusEffect(
//     useCallback(() => {
//       const picked = takePickedLocation();

//       if (picked) {
//         setGeofence(current => ({ ...current, ...picked }));
//       }
//     }, []),
//   );

//   // ---------------------------------------------------------------- theme

//   const textColor = theme.text || '#0F172A';
//   const subTextColor = theme.subText || '#64748B';
//   const primaryColor = theme.primary || '#0EA5E9';
//   const borderClr = theme.border || '#E2E8F0';

//   const isDark =
//     theme.bg === '#000000' || theme.bg === '#0F172A';

//   const cardBg = theme.card || (isDark ? '#1E293B' : '#FFFFFF');

//   const inputBg =
//     theme.inputBg || (isDark ? '#0F172A' : '#F8FAFC');

//   // ------------------------------------------------- type switching

//   const handleTimeBasedNavigation = () => {
//     const params = {};

//     if (isGroupTask) {
//       params.groupId = Number(groupIdParam);
//     }

//     navigation.navigate('AddTaskTimeBased', params);
//   };

//   const handleNonTimeBasedNavigation = () => {
//     const params = {};

//     if (isGroupTask) {
//       params.groupId = Number(groupIdParam);
//     }

//     navigation.navigate('AddTaskNonTimeBased', params);
//   };

//   // ---------------------------------------------------------------- save

//   const AddTask = async () => {
//     if (!title.trim()) {
//       Alert.alert('Missing Title', 'Please enter a task title.');
//       return;
//     }

//     if (!description.trim()) {
//       Alert.alert('Missing Description', 'Please enter a task description.');
//       return;
//     }

//     if (!hasPlace) {
//       Alert.alert(
//         'Set a Reminder Place',
//         'Tap "Use my current location" so the task knows where to remind you.',
//       );
//       return;
//     }

//     try {
//       setLoading(true);

//       const data = await postJson('/Managment/task', {
//         title: title.trim(),
//         description: description.trim(),

//         // Location based: no date, no time — the place is the trigger.
//         dueDate: null,
//         dueTime: null,
//         isTimeBased: false,

//         groupId: isGroupTask ? Number(groupIdParam) : null,

//         // The place this task belongs to, plus its alert radius.
//         latitude: geofence.latitude,
//         longitude: geofence.longitude,
//         geofenceRadiusMeters: geofence.geofenceRadiusMeters,
//         geofenceEnabled: geofence.geofenceEnabled && hasPlace,
//       });

//       if (!data?.success) {
//         throw new Error(data?.message || 'Failed to create task.');
//       }

//       Alert.alert('Success', data.message || 'Task created successfully.', [
//         {
//           text: 'OK',
//           onPress: () => navigation.goBack(),
//         },
//       ]);
//     } catch (error) {
//       if (error?.isSessionExpired) {
//         Alert.alert('Session Expired', 'Please login again.', [
//           { text: 'OK', onPress: () => goToLogin(navigation) },
//         ]);
//         return;
//       }

//       if (error?.kind === 'network') {
//         Alert.alert('Connection Error', 'Could not reach the server.');
//         return;
//       }

//       Alert.alert('Error', error?.message || 'Failed to create task.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ---------------------------------------------------------------- ui

//   const canSubmit =
//     !loading && Boolean(title.trim()) && Boolean(description.trim()) && hasPlace;

//   return (
//     <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
//       <StatusBar
//         barStyle={isDark ? 'light-content' : 'dark-content'}
//         backgroundColor={theme.bg}
//       />

//       {/* ---------------------------------------------------- HEADER */}
//       <View
//         style={[
//           styles.header,
//           { backgroundColor: theme.bg, borderBottomColor: borderClr },
//         ]}
//       >
//         <TouchableOpacity
//           onPress={() => navigation.goBack()}
//           style={styles.backBtn}
//           activeOpacity={0.7}
//         >
//           <Icon name="arrow-back" size={24} color={textColor} />
//         </TouchableOpacity>

//         <View
//           style={[
//             styles.headerBox,
//             { backgroundColor: theme.headerBox || inputBg },
//           ]}
//         >
//           <Text style={[styles.headerText, { color: textColor }]}>New Task</Text>
//         </View>

//         <View style={styles.headerSpacer} />
//       </View>

//       <ScrollView
//         contentContainerStyle={styles.content}
//         showsVerticalScrollIndicator={false}
//       >
//         {/* ---------------------------------------- TASK TYPE RADIOS */}
//         <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
//           <Text style={[styles.label, { color: textColor }]}>Task Type</Text>

//           <View style={styles.radioContainer}>
//             {/* (1) TIME BASED */}
//             <TouchableOpacity
//               onPress={handleTimeBasedNavigation}
//               style={[
//                 styles.radioItem,
//                 { backgroundColor: inputBg, borderColor: borderClr },
//               ]}
//               activeOpacity={0.7}
//               disabled={loading}
//             >
//               <View style={[styles.radioOuter, { borderColor: subTextColor }]}>
//                 {null}
//               </View>

//               <View style={styles.radioTextWrapper}>
//                 <Text style={[styles.radioLabelText, { color: textColor }]}>
//                   Time Based
//                 </Text>

//                 <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
//                   Set precise date & time
//                 </Text>
//               </View>

//               <Icon name="time-outline" size={18} color={subTextColor} />
//             </TouchableOpacity>

//             {/* (2) NON-TIME BASED */}
//             <TouchableOpacity
//               onPress={handleNonTimeBasedNavigation}
//               style={[
//                 styles.radioItem,
//                 { backgroundColor: inputBg, borderColor: borderClr },
//               ]}
//               activeOpacity={0.7}
//               disabled={loading}
//             >
//               <View style={[styles.radioOuter, { borderColor: subTextColor }]}>
//                 {null}
//               </View>

//               <View style={styles.radioTextWrapper}>
//                 <Text style={[styles.radioLabelText, { color: textColor }]}>
//                   Non-Time Based
//                 </Text>

//                 <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
//                   Full-day task with due date only
//                 </Text>
//               </View>

//               <Icon name="calendar-outline" size={18} color={subTextColor} />
//             </TouchableOpacity>

//             {/* (3) LOCATION BASED — selected */}
//             <TouchableOpacity
//               style={[
//                 styles.radioItem,
//                 styles.radioItemActive,
//                 {
//                   borderColor: primaryColor,
//                   backgroundColor: `${primaryColor}18`,
//                 },
//               ]}
//               activeOpacity={1}
//             >
//               <View style={[styles.radioOuter, { borderColor: primaryColor }]}>
//                 <View
//                   style={[styles.radioInner, { backgroundColor: primaryColor }]}
//                 />
//               </View>

//               <View style={styles.radioTextWrapper}>
//                 <Text style={[styles.radioLabelText, { color: textColor }]}>
//                   Location Based
//                 </Text>

//                 <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
//                   Remind me when I arrive at a place
//                 </Text>
//               </View>

//               <Icon name="location-outline" size={18} color={primaryColor} />
//             </TouchableOpacity>
//           </View>
//         </View>

//         {/* --------------------------------------------------- TITLE */}
//         <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
//           <Text style={[styles.label, { color: textColor }]}>Task Title</Text>

//           <TextInput
//             style={[
//               styles.input,
//               { backgroundColor: inputBg, borderColor: borderClr, color: textColor },
//             ]}
//             placeholder="e.g. Buy groceries"
//             placeholderTextColor={subTextColor}
//             value={title}
//             onChangeText={setTitle}
//             editable={!loading}
//           />
//         </View>

//         {/* --------------------------------------------- DESCRIPTION */}
//         <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
//           <Text style={[styles.label, { color: textColor }]}>Description</Text>

//           <TextInput
//             style={[
//               styles.descriptionInput,
//               { backgroundColor: inputBg, borderColor: borderClr, color: textColor },
//             ]}
//             placeholder="What needs to be done at this place?"
//             placeholderTextColor={subTextColor}
//             value={description}
//             onChangeText={setDescription}
//             multiline
//             numberOfLines={4}
//             textAlignVertical="top"
//             editable={!loading}
//           />
//         </View>

//         {/* --------------------------------------------- THE PLACE */}
//         <LocationCard
//           value={geofence}
//           onChange={setGeofence}
//           navigation={navigation}
//         />

//         {/* ----------------------------------------------- ADD TASK */}
//         <View style={styles.btnRow}>
//           <TouchableOpacity
//             style={[
//               styles.btn,
//               styles.cancelBtn,
//               { borderColor: borderClr },
//             ]}
//             onPress={() => navigation.goBack()}
//             disabled={loading}
//             activeOpacity={0.8}
//           >
//             <Text style={[styles.btnText, { color: subTextColor }]}>CANCEL</Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[
//               styles.btn,
//               styles.submitBtn,
//               { backgroundColor: primaryColor },
//               !canSubmit && styles.btnDisabled,
//             ]}
//             onPress={AddTask}
//             disabled={!canSubmit}
//             activeOpacity={0.8}
//           >
//             {loading ? (
//               <ActivityIndicator color="#FFFFFF" size="small" />
//             ) : (
//               <Text style={styles.submitBtnText}>ADD TASK</Text>
//             )}
//           </TouchableOpacity>
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },

//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderBottomWidth: 1,
//   },

//   backBtn: {
//     padding: 4,
//   },

//   headerBox: {
//     paddingHorizontal: 16,
//     paddingVertical: 7,
//     borderRadius: 20,
//   },

//   headerText: {
//     fontSize: 15,
//     fontWeight: '700',
//   },

//   headerSpacer: {
//     width: 32,
//   },

//   content: {
//     padding: 16,
//     paddingBottom: 40,
//   },

//   card: {
//     borderRadius: 16,
//     borderWidth: 1,
//     padding: 16,
//     marginBottom: 14,
//   },

//   label: {
//     fontSize: 14,
//     fontWeight: '700',
//     marginBottom: 10,
//   },

//   input: {
//     borderWidth: 1,
//     borderRadius: 12,
//     paddingHorizontal: 14,
//     paddingVertical: 12,
//     fontSize: 14,
//   },

//   descriptionInput: {
//     borderWidth: 1,
//     borderRadius: 12,
//     paddingHorizontal: 14,
//     paddingVertical: 12,
//     fontSize: 14,
//     minHeight: 96,
//   },

//   radioContainer: {
//     marginTop: 2,
//   },

//   radioItem: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderWidth: 1,
//     borderRadius: 14,
//     paddingHorizontal: 14,
//     paddingVertical: 13,
//     marginBottom: 10,
//   },

//   radioItemActive: {
//     borderWidth: 2,
//   },

//   radioOuter: {
//     width: 20,
//     height: 20,
//     borderRadius: 10,
//     borderWidth: 2,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginRight: 12,
//   },

//   radioInner: {
//     width: 10,
//     height: 10,
//     borderRadius: 5,
//   },

//   radioTextWrapper: {
//     flex: 1,
//   },

//   radioLabelText: {
//     fontSize: 14,
//     fontWeight: '700',
//   },

//   radioSubLabelText: {
//     fontSize: 11.5,
//     marginTop: 3,
//   },

//   btnRow: {
//     flexDirection: 'row',
//     marginTop: 6,
//   },

//   btn: {
//     flex: 1,
//     borderRadius: 14,
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 15,
//   },

//   cancelBtn: {
//     borderWidth: 1,
//     marginRight: 10,
//     backgroundColor: 'transparent',
//   },

//   submitBtn: {
//     borderWidth: 0,
//   },

//   btnDisabled: {
//     opacity: 0.5,
//   },

//   btnText: {
//     fontSize: 14,
//     fontWeight: '700',
//   },

//   submitBtnText: {
//     color: '#FFFFFF',
//     fontSize: 14,
//     fontWeight: '800',
//     letterSpacing: 0.5,
//   },
// });

// export default AddTaskLocationBased;



























// // import React, { useState } from 'react';
// // import {
// //   ActivityIndicator,
// //   Alert,
// //   SafeAreaView,
// //   ScrollView,
// //   StatusBar,
// //   StyleSheet,
// //   Text,
// //   TextInput,
// //   TouchableOpacity,
// //   View,
// // } from 'react-native';
// // import Icon from '@react-native-vector-icons/ionicons';

// // import { useTheme } from '../../context/ThemeContext';
// // import { postJson } from '../../services/locationApi';
// // import LocationCard from '../../components/LocationCard';
// // import { DEFAULT_GEOFENCE_RADIUS_METERS } from '../../services/location';


// // // Same local helper the other screens use: bounce to the Login screen
// // // by resetting into the AuthStack.
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

// // /**
// //  * Add a LOCATION BASED task.
// //  *
// //  * Same family as AddTaskTimeBased / AddTaskNonTimeBased — the three radios
// //  * switch between the three task types.
// //  *
// //  * The difference: this task has no date and no time. Its trigger is the
// //  * place you save. The phone raises "you are near this place" when you come
// //  * back within the radius, and the task shows up in the Non-Time lists
// //  * (isTimeBased = false).
// //  */
// // const AddTaskLocationBased = ({ navigation, route }) => {
// //   const { theme } = useTheme();

// //   const groupIdParam = route?.params?.groupId;

// //   const isGroupTask =
// //     groupIdParam !== null &&
// //     groupIdParam !== undefined &&
// //     String(groupIdParam).trim() !== '';

// //   const [title, setTitle] = useState('');
// //   const [description, setDescription] = useState('');
// //   const [loading, setLoading] = useState(false);

// //   // The place this task belongs to. Required — it is the whole trigger.
// //   const [geofence, setGeofence] = useState({
// //     latitude: null,
// //     longitude: null,
// //     accuracy: null,
// //     geofenceRadiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
// //     geofenceEnabled: true,
// //   });

// //   const hasPlace =
// //     geofence.latitude !== null && geofence.longitude !== null;

// //   // ---------------------------------------------------------------- theme

// //   const textColor = theme.text || '#0F172A';
// //   const subTextColor = theme.subText || '#64748B';
// //   const primaryColor = theme.primary || '#0EA5E9';
// //   const borderClr = theme.border || '#E2E8F0';

// //   const isDark =
// //     theme.bg === '#000000' || theme.bg === '#0F172A';

// //   const cardBg = theme.card || (isDark ? '#1E293B' : '#FFFFFF');

// //   const inputBg =
// //     theme.inputBg || (isDark ? '#0F172A' : '#F8FAFC');

// //   // ------------------------------------------------- type switching

// //   const handleTimeBasedNavigation = () => {
// //     const params = {};

// //     if (isGroupTask) {
// //       params.groupId = Number(groupIdParam);
// //     }

// //     navigation.navigate('AddTaskTimeBased', params);
// //   };

// //   const handleNonTimeBasedNavigation = () => {
// //     const params = {};

// //     if (isGroupTask) {
// //       params.groupId = Number(groupIdParam);
// //     }

// //     navigation.navigate('AddTaskNonTimeBased', params);
// //   };

// //   // ---------------------------------------------------------------- save

// //   const AddTask = async () => {
// //     if (!title.trim()) {
// //       Alert.alert('Missing Title', 'Please enter a task title.');
// //       return;
// //     }

// //     if (!description.trim()) {
// //       Alert.alert('Missing Description', 'Please enter a task description.');
// //       return;
// //     }

// //     if (!hasPlace) {
// //       Alert.alert(
// //         'Set a Reminder Place',
// //         'Tap "Use my current location" so the task knows where to remind you.',
// //       );
// //       return;
// //     }

// //     try {
// //       setLoading(true);

// //       const data = await postJson('/Managment/task', {
// //         title: title.trim(),
// //         description: description.trim(),

// //         // Location based: no date, no time — the place is the trigger.
// //         dueDate: null,
// //         dueTime: null,
// //         isTimeBased: false,

// //         groupId: isGroupTask ? Number(groupIdParam) : null,

// //         // The place this task belongs to, plus its alert radius.
// //         latitude: geofence.latitude,
// //         longitude: geofence.longitude,
// //         geofenceRadiusMeters: geofence.geofenceRadiusMeters,
// //         geofenceEnabled: geofence.geofenceEnabled && hasPlace,
// //       });

// //       if (!data?.success) {
// //         throw new Error(data?.message || 'Failed to create task.');
// //       }

// //       Alert.alert('Success', data.message || 'Task created successfully.', [
// //         {
// //           text: 'OK',
// //           onPress: () => navigation.goBack(),
// //         },
// //       ]);
// //     } catch (error) {
// //       if (error?.isSessionExpired) {
// //         Alert.alert('Session Expired', 'Please login again.', [
// //           { text: 'OK', onPress: () => goToLogin(navigation) },
// //         ]);
// //         return;
// //       }

// //       if (error?.kind === 'network') {
// //         Alert.alert('Connection Error', 'Could not reach the server.');
// //         return;
// //       }

// //       Alert.alert('Error', error?.message || 'Failed to create task.');
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   // ---------------------------------------------------------------- ui

// //   const canSubmit =
// //     !loading && Boolean(title.trim()) && Boolean(description.trim()) && hasPlace;

// //   return (
// //     <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
// //       <StatusBar
// //         barStyle={isDark ? 'light-content' : 'dark-content'}
// //         backgroundColor={theme.bg}
// //       />

// //       {/* ---------------------------------------------------- HEADER */}
// //       <View
// //         style={[
// //           styles.header,
// //           { backgroundColor: theme.bg, borderBottomColor: borderClr },
// //         ]}
// //       >
// //         <TouchableOpacity
// //           onPress={() => navigation.goBack()}
// //           style={styles.backBtn}
// //           activeOpacity={0.7}
// //         >
// //           <Icon name="arrow-back" size={24} color={textColor} />
// //         </TouchableOpacity>

// //         <View
// //           style={[
// //             styles.headerBox,
// //             { backgroundColor: theme.headerBox || inputBg },
// //           ]}
// //         >
// //           <Text style={[styles.headerText, { color: textColor }]}>New Task</Text>
// //         </View>

// //         <View style={styles.headerSpacer} />
// //       </View>

// //       <ScrollView
// //         contentContainerStyle={styles.content}
// //         showsVerticalScrollIndicator={false}
// //       >
// //         {/* ---------------------------------------- TASK TYPE RADIOS */}
// //         <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// //           <Text style={[styles.label, { color: textColor }]}>Task Type</Text>

// //           <View style={styles.radioContainer}>
// //             {/* (1) TIME BASED */}
// //             <TouchableOpacity
// //               onPress={handleTimeBasedNavigation}
// //               style={[
// //                 styles.radioItem,
// //                 { backgroundColor: inputBg, borderColor: borderClr },
// //               ]}
// //               activeOpacity={0.7}
// //               disabled={loading}
// //             >
// //               <View style={[styles.radioOuter, { borderColor: subTextColor }]}>
// //                 {null}
// //               </View>

// //               <View style={styles.radioTextWrapper}>
// //                 <Text style={[styles.radioLabelText, { color: textColor }]}>
// //                   Time Based
// //                 </Text>

// //                 <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
// //                   Set precise date & time
// //                 </Text>
// //               </View>

// //               <Icon name="time-outline" size={18} color={subTextColor} />
// //             </TouchableOpacity>

// //             {/* (2) NON-TIME BASED */}
// //             <TouchableOpacity
// //               onPress={handleNonTimeBasedNavigation}
// //               style={[
// //                 styles.radioItem,
// //                 { backgroundColor: inputBg, borderColor: borderClr },
// //               ]}
// //               activeOpacity={0.7}
// //               disabled={loading}
// //             >
// //               <View style={[styles.radioOuter, { borderColor: subTextColor }]}>
// //                 {null}
// //               </View>

// //               <View style={styles.radioTextWrapper}>
// //                 <Text style={[styles.radioLabelText, { color: textColor }]}>
// //                   Non-Time Based
// //                 </Text>

// //                 <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
// //                   Full-day task with due date only
// //                 </Text>
// //               </View>

// //               <Icon name="calendar-outline" size={18} color={subTextColor} />
// //             </TouchableOpacity>

// //             {/* (3) LOCATION BASED — selected */}
// //             <TouchableOpacity
// //               style={[
// //                 styles.radioItem,
// //                 styles.radioItemActive,
// //                 {
// //                   borderColor: primaryColor,
// //                   backgroundColor: `${primaryColor}18`,
// //                 },
// //               ]}
// //               activeOpacity={1}
// //             >
// //               <View style={[styles.radioOuter, { borderColor: primaryColor }]}>
// //                 <View
// //                   style={[styles.radioInner, { backgroundColor: primaryColor }]}
// //                 />
// //               </View>

// //               <View style={styles.radioTextWrapper}>
// //                 <Text style={[styles.radioLabelText, { color: textColor }]}>
// //                   Location Based
// //                 </Text>

// //                 <Text style={[styles.radioSubLabelText, { color: subTextColor }]}>
// //                   Remind me when I arrive at a place
// //                 </Text>
// //               </View>

// //               <Icon name="location-outline" size={18} color={primaryColor} />
// //             </TouchableOpacity>
// //           </View>
// //         </View>

// //         {/* --------------------------------------------------- TITLE */}
// //         <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// //           <Text style={[styles.label, { color: textColor }]}>Task Title</Text>

// //           <TextInput
// //             style={[
// //               styles.input,
// //               { backgroundColor: inputBg, borderColor: borderClr, color: textColor },
// //             ]}
// //             placeholder="e.g. Buy groceries"
// //             placeholderTextColor={subTextColor}
// //             value={title}
// //             onChangeText={setTitle}
// //             editable={!loading}
// //           />
// //         </View>

// //         {/* --------------------------------------------- DESCRIPTION */}
// //         <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// //           <Text style={[styles.label, { color: textColor }]}>Description</Text>

// //           <TextInput
// //             style={[
// //               styles.descriptionInput,
// //               { backgroundColor: inputBg, borderColor: borderClr, color: textColor },
// //             ]}
// //             placeholder="What needs to be done at this place?"
// //             placeholderTextColor={subTextColor}
// //             value={description}
// //             onChangeText={setDescription}
// //             multiline
// //             numberOfLines={4}
// //             textAlignVertical="top"
// //             editable={!loading}
// //           />
// //         </View>

// //         {/* --------------------------------------------- THE PLACE */}
// //         <LocationCard value={geofence} onChange={setGeofence} />

// //         {/* ----------------------------------------------- ADD TASK */}
// //         <View style={styles.btnRow}>
// //           <TouchableOpacity
// //             style={[
// //               styles.btn,
// //               styles.cancelBtn,
// //               { borderColor: borderClr },
// //             ]}
// //             onPress={() => navigation.goBack()}
// //             disabled={loading}
// //             activeOpacity={0.8}
// //           >
// //             <Text style={[styles.btnText, { color: subTextColor }]}>CANCEL</Text>
// //           </TouchableOpacity>

// //           <TouchableOpacity
// //             style={[
// //               styles.btn,
// //               styles.submitBtn,
// //               { backgroundColor: primaryColor },
// //               !canSubmit && styles.btnDisabled,
// //             ]}
// //             onPress={AddTask}
// //             disabled={!canSubmit}
// //             activeOpacity={0.8}
// //           >
// //             {loading ? (
// //               <ActivityIndicator color="#FFFFFF" size="small" />
// //             ) : (
// //               <Text style={styles.submitBtnText}>ADD TASK</Text>
// //             )}
// //           </TouchableOpacity>
// //         </View>
// //       </ScrollView>
// //     </SafeAreaView>
// //   );
// // };

// // const styles = StyleSheet.create({
// //   container: {
// //     flex: 1,
// //   },

// //   header: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     justifyContent: 'space-between',
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     borderBottomWidth: 1,
// //   },

// //   backBtn: {
// //     padding: 4,
// //   },

// //   headerBox: {
// //     paddingHorizontal: 16,
// //     paddingVertical: 7,
// //     borderRadius: 20,
// //   },

// //   headerText: {
// //     fontSize: 15,
// //     fontWeight: '700',
// //   },

// //   headerSpacer: {
// //     width: 32,
// //   },

// //   content: {
// //     padding: 16,
// //     paddingBottom: 40,
// //   },

// //   card: {
// //     borderRadius: 16,
// //     borderWidth: 1,
// //     padding: 16,
// //     marginBottom: 14,
// //   },

// //   label: {
// //     fontSize: 14,
// //     fontWeight: '700',
// //     marginBottom: 10,
// //   },

// //   input: {
// //     borderWidth: 1,
// //     borderRadius: 12,
// //     paddingHorizontal: 14,
// //     paddingVertical: 12,
// //     fontSize: 14,
// //   },

// //   descriptionInput: {
// //     borderWidth: 1,
// //     borderRadius: 12,
// //     paddingHorizontal: 14,
// //     paddingVertical: 12,
// //     fontSize: 14,
// //     minHeight: 96,
// //   },

// //   radioContainer: {
// //     marginTop: 2,
// //   },

// //   radioItem: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     borderWidth: 1,
// //     borderRadius: 14,
// //     paddingHorizontal: 14,
// //     paddingVertical: 13,
// //     marginBottom: 10,
// //   },

// //   radioItemActive: {
// //     borderWidth: 2,
// //   },

// //   radioOuter: {
// //     width: 20,
// //     height: 20,
// //     borderRadius: 10,
// //     borderWidth: 2,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     marginRight: 12,
// //   },

// //   radioInner: {
// //     width: 10,
// //     height: 10,
// //     borderRadius: 5,
// //   },

// //   radioTextWrapper: {
// //     flex: 1,
// //   },

// //   radioLabelText: {
// //     fontSize: 14,
// //     fontWeight: '700',
// //   },

// //   radioSubLabelText: {
// //     fontSize: 11.5,
// //     marginTop: 3,
// //   },

// //   btnRow: {
// //     flexDirection: 'row',
// //     marginTop: 6,
// //   },

// //   btn: {
// //     flex: 1,
// //     borderRadius: 14,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     paddingVertical: 15,
// //   },

// //   cancelBtn: {
// //     borderWidth: 1,
// //     marginRight: 10,
// //     backgroundColor: 'transparent',
// //   },

// //   submitBtn: {
// //     borderWidth: 0,
// //   },

// //   btnDisabled: {
// //     opacity: 0.5,
// //   },

// //   btnText: {
// //     fontSize: 14,
// //     fontWeight: '700',
// //   },

// //   submitBtnText: {
// //     color: '#FFFFFF',
// //     fontSize: 14,
// //     fontWeight: '800',
// //     letterSpacing: 0.5,
// //   },
// // });

// // export default AddTaskLocationBased;
