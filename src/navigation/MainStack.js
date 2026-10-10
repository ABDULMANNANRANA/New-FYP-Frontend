import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// DASHBOARDS
import HomeDashboard from '../screens/Tasks/HomeDashboard';
import GroupDashboard from '../screens/Tasks/GroupDashboard';

// TASK SCREENS
import AddTaskTimeBased from '../screens/Managment/AddTaskTimeBased';
import AddTaskNonTimeBased from '../screens/Managment/AddTaskNonTimeBased';
import EditTaskTimeBased from '../screens/Managment/EditTaskTimeBased';
import EditTaskNonTimeBased from '../screens/Managment/EditTaskNonTimeBased';
import AddTaskLocationBased from '../screens/Managment/AddTaskLocationBased';
import EditTaskLocationBased from '../screens/Managment/EditTaskLocationBased';
import LocationPickerScreen from '../screens/Managment/LocationPickerScreen';
import TaskOverviewScreen from '../screens/Tasks/TaskOverviewScreen';
import ClashTaskScreen from '../screens/Tasks/ClashTaskScreen';


// GROUP
import AddMember from '../screens/Managment/AddMember';
import CreateGroup from '../screens/Managment/CreateGroup';
import TaskGroupOverviewScreen from '../screens/Tasks/TaskGroupOverviewScreen';
import GroupMembersScreen from '../screens/Managment/GroupMember';

// FORWARD / CONTACT
import ForwardTaskTo from '../screens/Managment/ForwardTaskTo';
import ContactScreen from '../screens/User/ContactScreen';
import AddContact from '../screens/User/AddContact';

// HISTORY
import HistoryScreen from '../screens/Tasks/HistoryScreen';

// REMINDER
import ReminderAlarmScreen from '../screens/Tasks/ReminderAlarmScreen';

// NOTIFICATION
import NotificationScreen from '../screens/User/NotificationScreen';

// SETTINGS
import SettingScreen from '../screens/User/SettingScreen';

const Stack = createNativeStackNavigator();

const MainStack = () => {
  return (
    <Stack.Navigator
      initialRouteName="HomeDashboard"
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* =========================
          DASHBOARDS
      ========================== */}
      <Stack.Screen
        name="HomeDashboard"
        component={HomeDashboard}
      />

      <Stack.Screen
        name="GroupDashboard"
        component={GroupDashboard}
      />

      {/* =========================
          GROUP
      ========================== */}
      <Stack.Screen
        name="GroupMembersScreen"
        component={GroupMembersScreen}
      />

      <Stack.Screen
        name="AddMember"
        component={AddMember}
      />

      <Stack.Screen
        name="CreateGroup"
        component={CreateGroup}
      />

      <Stack.Screen
        name="TaskGroupOverviewScreen"
        component={TaskGroupOverviewScreen}
      />

      {/* =========================
          TASK CREATION
      ========================== */}
      <Stack.Screen
        name="AddTaskTimeBased"
        component={AddTaskTimeBased}
      />

      <Stack.Screen
        name="AddTaskNonTimeBased"
        component={AddTaskNonTimeBased}
      />

      <Stack.Screen
        name="AddTaskLocationBased"
        component={AddTaskLocationBased}
      />

      {/* =========================
          TASK EDIT
      ========================== */}
      <Stack.Screen
        name="EditTaskTimeBased"
        component={EditTaskTimeBased}
      />

      <Stack.Screen
        name="EditTaskNonTimeBased"
        component={EditTaskNonTimeBased}
      />

      <Stack.Screen
        name="EditTaskLocationBased"
        component={EditTaskLocationBased}
      />

      <Stack.Screen
        name="LocationPickerScreen"
        component={LocationPickerScreen}
      />

      {/* =========================
          TASK DETAILS
      ========================== */}
      <Stack.Screen
        name="TaskOverviewScreen"
        component={TaskOverviewScreen}
      />

      <Stack.Screen
        name="ClashTaskScreen"
        component={ClashTaskScreen}
      />

      {/* =========================
          FORWARD / CONTACT
      ========================== */}
      <Stack.Screen
        name="ForwardTaskTo"
        component={ForwardTaskTo}
      />

      <Stack.Screen
        name="ContactScreen"
        component={ContactScreen}
      />

      <Stack.Screen
        name="AddContact"
        component={AddContact}
      />

      {/* =========================
          HISTORY
      ========================== */}
      <Stack.Screen
        name="HistoryScreen"
        component={HistoryScreen}
      />

      {/* =========================
          REMINDER
      ========================== */}
      <Stack.Screen
        name="ReminderAlarmScreen"
        component={ReminderAlarmScreen}
      />

      {/* =========================
          NOTIFICATION
      ========================== */}
      <Stack.Screen
        name="NotificationScreen"
        component={NotificationScreen}
      />

      {/* =========================
          SETTINGS
      ========================== */}
      <Stack.Screen
        name="SettingScreen"
        component={SettingScreen}
      />
    </Stack.Navigator>
  );
};

export default MainStack;

















// import React from 'react';
// import { createNativeStackNavigator } from '@react-navigation/native-stack';

// // DASHBOARDS
// import HomeDashboard from '../screens/Tasks/HomeDashboard';
// import GroupDashboard from '../screens/Tasks/GroupDashboard';  // ← single dynamic dashboard

// // TASK SCREENS
// import AddTaskTimeBased from '../screens/Managment/AddTaskTimeBased';
// import AddTaskNonTimeBased from '../screens/Managment/AddTaskNonTimeBased';
// import EditTaskTimeBased from '../screens/Managment/EditTaskTimeBased';
// import EditTaskNonTimeBased from '../screens/Managment/EditTaskNonTimeBased';
// import TaskOverviewScreen from '../screens/Tasks/TaskOverviewScreen';
// import ClashTaskScreen from '../screens/Tasks/ClashTaskScreen';

// // GROUP
// import AddMember from '../screens/Managment/AddMember';
// import CreateGroup from '../screens/Managment/CreateGroup';
// import TaskGroupOverviewScreen from '../screens/Tasks/TaskGroupOverviewScreen';
// import GroupMembersScreen from '../screens/Managment/GroupMember';

// // FORWARD / CONTACT
// import ForwardTaskTo from '../screens/Managment/ForwardTaskTo';
// import ContactScreen from '../screens/User/ContactScreen';

// // HISTORY
// import TimeBasedHistoryScreen from '../screens/User/TimeBasedHistoryScreen';
// import NonTimeBasedHistoryScreen from '../screens/Tasks/NonTimeBasedHistoryScreen';

// // REMINDER
// import ReminderAlarmScreen from '../screens/Tasks/ReminderAlarmScreen';

// // NOTIFICATION
// import NotificationScreen from '../screens/User/NotificationScreen';

// // SETTINGS
// import SettingScreen from '../screens/User/SettingScreen';

// const Stack = createNativeStackNavigator();

// const MainStack = () => {
//   return (
//     <Stack.Navigator screenOptions={{ headerShown: false }}>

//       <Stack.Screen name="HomeDashboard" component={HomeDashboard} />
//       <Stack.Screen name="GroupDashboard" component={GroupDashboard} />

//       <Stack.Screen name="GroupMembersScreen" component={GroupMembersScreen}/>
//       <Stack.Screen name="AddTaskTimeBased" component={AddTaskTimeBased} />
//       <Stack.Screen name="AddTaskNonTimeBased" component={AddTaskNonTimeBased} />

//       <Stack.Screen name="EditTaskTimeBased" component={EditTaskTimeBased} />
//       <Stack.Screen name="EditTaskNonTimeBased" component={EditTaskNonTimeBased} />

//       <Stack.Screen name="TaskOverviewScreen" component={TaskOverviewScreen} />
//       <Stack.Screen name="ClashTaskScreen" component={ClashTaskScreen} />

//       <Stack.Screen name="AddMember" component={AddMember} />
//       <Stack.Screen name="CreateGroup" component={CreateGroup} />
//       <Stack.Screen name="TaskGroupOverviewScreen" component={TaskGroupOverviewScreen} />

//       <Stack.Screen name="ForwardTaskTo" component={ForwardTaskTo} />
//       <Stack.Screen name="ContactScreen" component={ContactScreen} />

//       <Stack.Screen name="TimeBasedHistoryScreen" component={TimeBasedHistoryScreen} />
//       <Stack.Screen name="NonTimeBasedHistoryScreen" component={NonTimeBasedHistoryScreen} />

//       <Stack.Screen name="ReminderAlarmScreen" component={ReminderAlarmScreen} />
//       <Stack.Screen name="NotificationScreen" component={NotificationScreen} />
//       <Stack.Screen name="SettingScreen" component={SettingScreen} />

//     </Stack.Navigator>
//   );
// };

// export default MainStack;

















// import React from 'react';
// import { createNativeStackNavigator } from '@react-navigation/native-stack';

// // DASHBOARDS
// import HomeDashboard from '../screens/Tasks/HomeDashboard';
// import GroupDashboard from '../screens/Tasks/GroupDashboard';  // ← single dynamic dashboard

// // TASK SCREENS
// import AddTaskTimeBased from '../screens/Managment/AddTaskTimeBased';
// import AddTaskNonTimeBased from '../screens/Managment/AddTaskNonTimeBased';
// import EditTaskTimeBased from '../screens/Managment/EditTaskTimeBased';
// import EditTaskNonTimeBased from '../screens/Managment/EditTaskNonTimeBased';
// import TaskOverviewScreen from '../screens/Tasks/TaskOverviewScreen';
// import ClashTaskScreen from '../screens/Tasks/ClashTaskScreen';

// // GROUP
// import AddMember from '../screens/Managment/AddMember';
// import CreateGroup from '../screens/Managment/CreateGroup';
// import TaskGroupOverviewScreen from '../screens/Tasks/TaskGroupOverviewScreen';
// import GroupMembersScreen from '../screens/Managment/GroupMember';

// // FORWARD / CONTACT
// import ForwardTaskTo from '../screens/Managment/ForwardTaskTo';
// import ContactScreen from '../screens/User/ContactScreen';

// // HISTORY
// import TimeBasedHistoryScreen from '../screens/User/TimeBasedHistoryScreen';
// import NonTimeBasedHistoryScreen from '../screens/Tasks/NonTimeBasedHistoryScreen';

// // REMINDER
// import ReminderAlarmScreen from '../screens/Tasks/ReminderAlarmScreen';

// // NOTIFICATION
// import NotificationScreen from '../screens/User/NotificationScreen';

// // SETTINGS
// import SettingScreen from '../screens/User/SettingScreen';

// const Stack = createNativeStackNavigator();

// const MainStack = () => {
//   return (
//     <Stack.Navigator screenOptions={{ headerShown: false }}>

//       <Stack.Screen name="HomeDashboard" component={HomeDashboard} />
//       <Stack.Screen name="GroupDashboard" component={GroupDashboard} />

//       <Stack.Screen name="GroupMembersScreen" component={GroupMembersScreen}/>
//       <Stack.Screen name="AddTaskTimeBased" component={AddTaskTimeBased} />
//       <Stack.Screen name="AddTaskNonTimeBased" component={AddTaskNonTimeBased} />

//       <Stack.Screen name="EditTaskTimeBased" component={EditTaskTimeBased} />
//       <Stack.Screen name="EditTaskNonTimeBased" component={EditTaskNonTimeBased} />

//       <Stack.Screen name="TaskOverviewScreen" component={TaskOverviewScreen} />
//       <Stack.Screen name="ClashTaskScreen" component={ClashTaskScreen} />

//       <Stack.Screen name="AddMember" component={AddMember} />
//       <Stack.Screen name="CreateGroup" component={CreateGroup} />
//       <Stack.Screen name="TaskGroupOverviewScreen" component={TaskGroupOverviewScreen} />

//       <Stack.Screen name="ForwardTaskTo" component={ForwardTaskTo} />
//       <Stack.Screen name="ContactScreen" component={ContactScreen} />

//       <Stack.Screen name="TimeBasedHistoryScreen" component={TimeBasedHistoryScreen} />
//       <Stack.Screen name="NonTimeBasedHistoryScreen" component={NonTimeBasedHistoryScreen} />

//       <Stack.Screen name="ReminderAlarmScreen" component={ReminderAlarmScreen} />
//       <Stack.Screen name="NotificationScreen" component={NotificationScreen} />
//       <Stack.Screen name="SettingScreen" component={SettingScreen} />

//     </Stack.Navigator>
//   );
// };

// export default MainStack;

























// import React from 'react';
// import { createNativeStackNavigator } from '@react-navigation/native-stack';

// // DASHBOARDS
// import HomeDashboard from '../screens/Tasks/HomeDashboard';
// import GroupDashboard from '../screens/Tasks/GroupDashboard';

// // TASK SCREENS
// import AddTaskTimeBased from '../screens/Managment/AddTaskTimeBased';
// import AddTaskNonTimeBased from '../screens/Managment/AddTaskNonTimeBased';
// import EditTaskTimeBased from '../screens/Managment/EditTaskTimeBased';
// import EditTaskNonTimeBased from '../screens/Managment/EditTaskNonTimeBased';
// import AddTaskLocationBased from '../screens/Managment/AddTaskLocationBased';
// import EditTaskLocationBased from '../screens/Managment/EditTaskLocationBased';
// import TaskOverviewScreen from '../screens/Tasks/TaskOverviewScreen';
// import ClashTaskScreen from '../screens/Tasks/ClashTaskScreen';

// // GROUP
// import AddMember from '../screens/Managment/AddMember';
// import CreateGroup from '../screens/Managment/CreateGroup';
// import TaskGroupOverviewScreen from '../screens/Tasks/TaskGroupOverviewScreen';
// import GroupMembersScreen from '../screens/Managment/GroupMember';

// // FORWARD / CONTACT
// import ForwardTaskTo from '../screens/Managment/ForwardTaskTo';
// import ContactScreen from '../screens/User/ContactScreen';

// // HISTORY
// import TimeBasedHistoryScreen from '../screens/User/TimeBasedHistoryScreen';
// import NonTimeBasedHistoryScreen from '../screens/Tasks/NonTimeBasedHistoryScreen';

// // REMINDER
// import ReminderAlarmScreen from '../screens/Tasks/ReminderAlarmScreen';

// // NOTIFICATION
// import NotificationScreen from '../screens/User/NotificationScreen';

// // SETTINGS
// import SettingScreen from '../screens/User/SettingScreen';

// const Stack = createNativeStackNavigator();

// const MainStack = () => {
//   return (
//     <Stack.Navigator
//       initialRouteName="HomeDashboard"
//       screenOptions={{
//         headerShown: false,
//       }}
//     >
//       {/* =========================
//           DASHBOARDS
//       ========================== */}
//       <Stack.Screen
//         name="HomeDashboard"
//         component={HomeDashboard}
//       />

//       <Stack.Screen
//         name="GroupDashboard"
//         component={GroupDashboard}
//       />

//       {/* =========================
//           GROUP
//       ========================== */}
//       <Stack.Screen
//         name="GroupMembersScreen"
//         component={GroupMembersScreen}
//       />

//       <Stack.Screen
//         name="AddMember"
//         component={AddMember}
//       />

//       <Stack.Screen
//         name="CreateGroup"
//         component={CreateGroup}
//       />

//       <Stack.Screen
//         name="TaskGroupOverviewScreen"
//         component={TaskGroupOverviewScreen}
//       />

//       {/* =========================
//           TASK CREATION
//       ========================== */}
//       <Stack.Screen
//         name="AddTaskTimeBased"
//         component={AddTaskTimeBased}
//       />

//       <Stack.Screen
//         name="AddTaskNonTimeBased"
//         component={AddTaskNonTimeBased}
//       />

//       <Stack.Screen
//         name="AddTaskLocationBased"
//         component={AddTaskLocationBased}
//       />

//       {/* =========================
//           TASK EDIT
//       ========================== */}
//       <Stack.Screen
//         name="EditTaskTimeBased"
//         component={EditTaskTimeBased}
//       />

//       <Stack.Screen
//         name="EditTaskNonTimeBased"
//         component={EditTaskNonTimeBased}
//       />

//       <Stack.Screen
//         name="EditTaskLocationBased"
//         component={EditTaskLocationBased}
//       />

//       {/* =========================
//           TASK DETAILS
//       ========================== */}
//       <Stack.Screen
//         name="TaskOverviewScreen"
//         component={TaskOverviewScreen}
//       />

//       <Stack.Screen
//         name="ClashTaskScreen"
//         component={ClashTaskScreen}
//       />

//       {/* =========================
//           FORWARD / CONTACT
//       ========================== */}
//       <Stack.Screen
//         name="ForwardTaskTo"
//         component={ForwardTaskTo}
//       />

//       <Stack.Screen
//         name="ContactScreen"
//         component={ContactScreen}
//       />

//       {/* =========================
//           HISTORY
//       ========================== */}
//       <Stack.Screen
//         name="TimeBasedHistoryScreen"
//         component={TimeBasedHistoryScreen}
//       />

//       <Stack.Screen
//         name="NonTimeBasedHistoryScreen"
//         component={NonTimeBasedHistoryScreen}
//       />

//       {/* =========================
//           REMINDER
//       ========================== */}
//       <Stack.Screen
//         name="ReminderAlarmScreen"
//         component={ReminderAlarmScreen}
//       />

//       {/* =========================
//           NOTIFICATION
//       ========================== */}
//       <Stack.Screen
//         name="NotificationScreen"
//         component={NotificationScreen}
//       />

//       {/* =========================
//           SETTINGS
//       ========================== */}
//       <Stack.Screen
//         name="SettingScreen"
//         component={SettingScreen}
//       />
//     </Stack.Navigator>
//   );
// };

// export default MainStack;









































// // import React from 'react';
// // import { createNativeStackNavigator } from '@react-navigation/native-stack';

// // // DASHBOARDS
// // import HomeDashboard from '../screens/Tasks/HomeDashboard';
// // import GroupDashboard from '../screens/Tasks/GroupDashboard';

// // // TASK SCREENS
// // import AddTaskTimeBased from '../screens/Managment/AddTaskTimeBased';
// // import AddTaskNonTimeBased from '../screens/Managment/AddTaskNonTimeBased';
// // import EditTaskTimeBased from '../screens/Managment/EditTaskTimeBased';
// // import EditTaskNonTimeBased from '../screens/Managment/EditTaskNonTimeBased';
// // import TaskOverviewScreen from '../screens/Tasks/TaskOverviewScreen';
// // import ClashTaskScreen from '../screens/Tasks/ClashTaskScreen';

// // // GROUP
// // import AddMember from '../screens/Managment/AddMember';
// // import CreateGroup from '../screens/Managment/CreateGroup';
// // import TaskGroupOverviewScreen from '../screens/Tasks/TaskGroupOverviewScreen';
// // import GroupMembersScreen from '../screens/Managment/GroupMember';

// // // FORWARD / CONTACT
// // import ForwardTaskTo from '../screens/Managment/ForwardTaskTo';
// // import ContactScreen from '../screens/User/ContactScreen';

// // // HISTORY
// // import TimeBasedHistoryScreen from '../screens/User/TimeBasedHistoryScreen';
// // import NonTimeBasedHistoryScreen from '../screens/Tasks/NonTimeBasedHistoryScreen';

// // // REMINDER
// // import ReminderAlarmScreen from '../screens/Tasks/ReminderAlarmScreen';

// // // NOTIFICATION
// // import NotificationScreen from '../screens/User/NotificationScreen';

// // // SETTINGS
// // import SettingScreen from '../screens/User/SettingScreen';

// // const Stack = createNativeStackNavigator();

// // const MainStack = () => {
// //   return (
// //     <Stack.Navigator
// //       initialRouteName="HomeDashboard"
// //       screenOptions={{
// //         headerShown: false,
// //       }}
// //     >
// //       {/* =========================
// //           DASHBOARDS
// //       ========================== */}
// //       <Stack.Screen
// //         name="HomeDashboard"
// //         component={HomeDashboard}
// //       />

// //       <Stack.Screen
// //         name="GroupDashboard"
// //         component={GroupDashboard}
// //       />

// //       {/* =========================
// //           GROUP
// //       ========================== */}
// //       <Stack.Screen
// //         name="GroupMembersScreen"
// //         component={GroupMembersScreen}
// //       />

// //       <Stack.Screen
// //         name="AddMember"
// //         component={AddMember}
// //       />

// //       <Stack.Screen
// //         name="CreateGroup"
// //         component={CreateGroup}
// //       />

// //       <Stack.Screen
// //         name="TaskGroupOverviewScreen"
// //         component={TaskGroupOverviewScreen}
// //       />

// //       {/* =========================
// //           TASK CREATION
// //       ========================== */}
// //       <Stack.Screen
// //         name="AddTaskTimeBased"
// //         component={AddTaskTimeBased}
// //       />

// //       <Stack.Screen
// //         name="AddTaskNonTimeBased"
// //         component={AddTaskNonTimeBased}
// //       />

// //       {/* =========================
// //           TASK EDIT
// //       ========================== */}
// //       <Stack.Screen
// //         name="EditTaskTimeBased"
// //         component={EditTaskTimeBased}
// //       />

// //       <Stack.Screen
// //         name="EditTaskNonTimeBased"
// //         component={EditTaskNonTimeBased}
// //       />

// //       {/* =========================
// //           TASK DETAILS
// //       ========================== */}
// //       <Stack.Screen
// //         name="TaskOverviewScreen"
// //         component={TaskOverviewScreen}
// //       />

// //       <Stack.Screen
// //         name="ClashTaskScreen"
// //         component={ClashTaskScreen}
// //       />

// //       {/* =========================
// //           FORWARD / CONTACT
// //       ========================== */}
// //       <Stack.Screen
// //         name="ForwardTaskTo"
// //         component={ForwardTaskTo}
// //       />

// //       <Stack.Screen
// //         name="ContactScreen"
// //         component={ContactScreen}
// //       />

// //       {/* =========================
// //           HISTORY
// //       ========================== */}
// //       <Stack.Screen
// //         name="TimeBasedHistoryScreen"
// //         component={TimeBasedHistoryScreen}
// //       />

// //       <Stack.Screen
// //         name="NonTimeBasedHistoryScreen"
// //         component={NonTimeBasedHistoryScreen}
// //       />

// //       {/* =========================
// //           REMINDER
// //       ========================== */}
// //       <Stack.Screen
// //         name="ReminderAlarmScreen"
// //         component={ReminderAlarmScreen}
// //       />

// //       {/* =========================
// //           NOTIFICATION
// //       ========================== */}
// //       <Stack.Screen
// //         name="NotificationScreen"
// //         component={NotificationScreen}
// //       />

// //       {/* =========================
// //           SETTINGS
// //       ========================== */}
// //       <Stack.Screen
// //         name="SettingScreen"
// //         component={SettingScreen}
// //       />
// //     </Stack.Navigator>
// //   );
// // };

// // export default MainStack;

















// // // import React from 'react';
// // // import { createNativeStackNavigator } from '@react-navigation/native-stack';

// // // // DASHBOARDS
// // // import HomeDashboard from '../screens/Tasks/HomeDashboard';
// // // import GroupDashboard from '../screens/Tasks/GroupDashboard';  // ← single dynamic dashboard

// // // // TASK SCREENS
// // // import AddTaskTimeBased from '../screens/Managment/AddTaskTimeBased';
// // // import AddTaskNonTimeBased from '../screens/Managment/AddTaskNonTimeBased';
// // // import EditTaskTimeBased from '../screens/Managment/EditTaskTimeBased';
// // // import EditTaskNonTimeBased from '../screens/Managment/EditTaskNonTimeBased';
// // // import TaskOverviewScreen from '../screens/Tasks/TaskOverviewScreen';
// // // import ClashTaskScreen from '../screens/Tasks/ClashTaskScreen';

// // // // GROUP
// // // import AddMember from '../screens/Managment/AddMember';
// // // import CreateGroup from '../screens/Managment/CreateGroup';
// // // import TaskGroupOverviewScreen from '../screens/Tasks/TaskGroupOverviewScreen';
// // // import GroupMembersScreen from '../screens/Managment/GroupMember';

// // // // FORWARD / CONTACT
// // // import ForwardTaskTo from '../screens/Managment/ForwardTaskTo';
// // // import ContactScreen from '../screens/User/ContactScreen';

// // // // HISTORY
// // // import TimeBasedHistoryScreen from '../screens/User/TimeBasedHistoryScreen';
// // // import NonTimeBasedHistoryScreen from '../screens/Tasks/NonTimeBasedHistoryScreen';

// // // // REMINDER
// // // import ReminderAlarmScreen from '../screens/Tasks/ReminderAlarmScreen';

// // // // NOTIFICATION
// // // import NotificationScreen from '../screens/User/NotificationScreen';

// // // // SETTINGS
// // // import SettingScreen from '../screens/User/SettingScreen';

// // // const Stack = createNativeStackNavigator();

// // // const MainStack = () => {
// // //   return (
// // //     <Stack.Navigator screenOptions={{ headerShown: false }}>

// // //       <Stack.Screen name="HomeDashboard" component={HomeDashboard} />
// // //       <Stack.Screen name="GroupDashboard" component={GroupDashboard} />

// // //       <Stack.Screen name="GroupMembersScreen" component={GroupMembersScreen}/>
// // //       <Stack.Screen name="AddTaskTimeBased" component={AddTaskTimeBased} />
// // //       <Stack.Screen name="AddTaskNonTimeBased" component={AddTaskNonTimeBased} />

// // //       <Stack.Screen name="EditTaskTimeBased" component={EditTaskTimeBased} />
// // //       <Stack.Screen name="EditTaskNonTimeBased" component={EditTaskNonTimeBased} />

// // //       <Stack.Screen name="TaskOverviewScreen" component={TaskOverviewScreen} />
// // //       <Stack.Screen name="ClashTaskScreen" component={ClashTaskScreen} />

// // //       <Stack.Screen name="AddMember" component={AddMember} />
// // //       <Stack.Screen name="CreateGroup" component={CreateGroup} />
// // //       <Stack.Screen name="TaskGroupOverviewScreen" component={TaskGroupOverviewScreen} />

// // //       <Stack.Screen name="ForwardTaskTo" component={ForwardTaskTo} />
// // //       <Stack.Screen name="ContactScreen" component={ContactScreen} />

// // //       <Stack.Screen name="TimeBasedHistoryScreen" component={TimeBasedHistoryScreen} />
// // //       <Stack.Screen name="NonTimeBasedHistoryScreen" component={NonTimeBasedHistoryScreen} />

// // //       <Stack.Screen name="ReminderAlarmScreen" component={ReminderAlarmScreen} />
// // //       <Stack.Screen name="NotificationScreen" component={NotificationScreen} />
// // //       <Stack.Screen name="SettingScreen" component={SettingScreen} />

// // //     </Stack.Navigator>
// // //   );
// // // };

// // // export default MainStack;