import React, { useState, useEffect } from "react";
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
} from "react-native";
import Icon from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "../../context/ThemeContext";
import { BASE_URL } from "../../config/api";

const { width } = Dimensions.get("window");

// ============================================================
// Helper: reset navigation to the Login screen inside AuthStack.
// ============================================================
const goToLogin = (navigation) => {
  navigation.reset({
    index: 0,
    routes: [
      {
        name: "AuthStack",
        state: {
          routes: [{ name: "Login" }],
        },
      },
    ],
  });
};

const normalizeGroupId = value => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }

  const numericId = Number(value);
  return Number.isSafeInteger(numericId) && numericId > 0
    ? String(numericId)
    : null;
};

const readGroupId = group =>
  normalizeGroupId(
    group?.id ?? group?.groupId ?? group?.Id ?? group?.GroupId
  );

const readGroupName = group =>
  String(
    group?.name ??
      group?.groupName ??
      group?.Name ??
      group?.GroupName ??
      ''
  ).trim();

const AddMember = ({ navigation, route }) => {
  const { theme } = useTheme();

  const groupIdParam = normalizeGroupId(
    route?.params?.groupId ??
      route?.params?.GroupId ??
      route?.params?.group?.id ??
      route?.params?.group?.groupId ??
      route?.params?.group?.Id ??
      route?.params?.group?.GroupId
  );
  const groupNameParam = String(
    route?.params?.groupName ??
      route?.params?.GroupName ??
      route?.params?.group?.name ??
      ''
  ).trim();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [memberName, setMemberName] = useState('');
  const [loading, setLoading] = useState(false);

  // Group picker
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(groupIdParam);
  const [selectedGroupName, setSelectedGroupName] = useState(groupNameParam);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Contact list
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showContacts, setShowContacts] = useState(false);

  const normalizedSelectedGroupId = normalizeGroupId(selectedGroupId);
  const groupMatchedByName = groups.find(
    group =>
      readGroupName(group).toLowerCase() ===
      selectedGroupName.trim().toLowerCase()
  );
  const effectiveGroupId =
    groupIdParam ??
    normalizedSelectedGroupId ??
    readGroupId(groupMatchedByName);

  useEffect(() => {
    fetchGroups();
    fetchContacts();
  }, []);

  // ==========================================
  // CHECK AUTHENTICATION
  // ==========================================
  const checkAuthentication = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please login again.", [
          {
            text: "OK",
            onPress: () => goToLogin(navigation),
          },
        ]);

        return false;
      }

      return true;
    } catch (error) {
      console.log("Authentication check error:", error);

      Alert.alert("Error", "Unable to verify your session.");

      return false;
    }
  };

  // ==========================================
  // FETCH GROUPS
  // ==========================================
  const fetchGroups = async () => {
    const authenticated = await checkAuthentication();

    if (!authenticated) return;

    try {
      setLoadingGroups(true);

      const token = await AsyncStorage.getItem("token");

      const response = await fetch(`${BASE_URL}/User/groups`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      let data;

      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error("Invalid response received from server.");
      }

      console.log("Fetch Groups Response:", data);

      if (response.ok && data?.success) {
        const responseGroups = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.groups)
            ? data.groups
            : [];

        const normalizedGroups = responseGroups
          .map(group => ({
            ...group,
            id: readGroupId(group),
            name: readGroupName(group),
            members: Array.isArray(group?.members)
              ? group.members
              : Array.isArray(group?.Members)
                ? group.Members
                : [],
          }))
          .filter(group => group.id);

        setGroups(normalizedGroups);

        const routeGroup = groupIdParam
          ? normalizedGroups.find(group => group.id === groupIdParam)
          : null;
        const selectedGroup = normalizedSelectedGroupId
          ? normalizedGroups.find(
              group => group.id === normalizedSelectedGroupId
            )
          : null;
        const namedGroup = groupNameParam
          ? normalizedGroups.find(
              group =>
                group.name.toLowerCase() === groupNameParam.toLowerCase()
            )
          : null;
        const groupToSelect =
          routeGroup ||
          selectedGroup ||
          namedGroup ||
          (normalizedGroups.length === 1 ? normalizedGroups[0] : null);

        if (groupToSelect) {
          setSelectedGroupId(groupToSelect.id);
          setSelectedGroupName(groupToSelect.name);
        }
      } else {
        Alert.alert("Error", data?.message || "Failed to load groups.");
      }
    } catch (error) {
      console.log("Fetch groups error:", error);

      if (error?.message === "Network request failed") {
        Alert.alert(
          "Connection Error",
          "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
        );
      } else {
        Alert.alert("Error", error?.message || "Failed to load groups.");
      }
    } finally {
      setLoadingGroups(false);
    }
  };

  // ==========================================
  // FETCH ALL CONTACTS
  // ==========================================
  const fetchContacts = async () => {
    const authenticated = await checkAuthentication();

    if (!authenticated) return;

    try {
      setLoadingContacts(true);

      const token = await AsyncStorage.getItem("token");

      const response = await fetch(`${BASE_URL}/User/groups`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      let data;

      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error("Invalid response received from server.");
      }

      console.log("Fetch Contacts Response:", data);

      if (response.ok && data?.success) {
        const allMembers = [];
        const seen = new Set();

        if (Array.isArray(data.data)) {
          data.data.forEach((group) => {
            if (!Array.isArray(group.members)) {
              return;
            }

            group.members.forEach((member, index) => {
              const name =
                member.displayName || member.name || "Unknown";

              const phone = member.phone || "";

              const key = `${name}_${phone}`;

              if (seen.has(key)) {
                return;
              }

              if (name === "Unknown" && !phone) {
                return;
              }

              seen.add(key);

              allMembers.push({
                id: `${member.id || index}_${group.id}`,
                name,
                phone,
                groupName: group.name || "Unknown Group",
                isRegistered: !!member.isRegistered,
              });
            });
          });
        }

        setContacts(allMembers);
      } else {
        Alert.alert("Error", data?.message || "Failed to load contacts.");
      }
    } catch (error) {
      console.log("Fetch contacts error:", error);

      if (error?.message === "Network request failed") {
        Alert.alert(
          "Connection Error",
          "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
        );
      } else {
        Alert.alert("Error", error?.message || "Failed to load contacts.");
      }
    } finally {
      setLoadingContacts(false);
    }
  };

  // ==========================================
  // ADD MEMBER
  // ==========================================
  const AddFunction = async () => {
    const authenticated = await checkAuthentication();

    if (!authenticated) return;

    if (!memberName.trim()) {
      Alert.alert("Error", "Please enter the member name");
      return;
    }

    if (!phoneNumber.trim()) {
      Alert.alert("Error", "Please enter the phone number");
      return;
    }

    if (!effectiveGroupId) {
      Alert.alert("Error", "Please select a group first");
      return;
    }

    try {
      setLoading(true);

      const token = await AsyncStorage.getItem("token");

      const response = await fetch(
        `${BASE_URL}/Managment/${effectiveGroupId}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: null,
            name: memberName.trim(),
            phone: phoneNumber.trim(),
          }),
        }
      );

      let data;

      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error("Invalid response received from server.");
      }

      console.log("Add Member Response:", data);

      if (response.ok && data?.success) {
        Alert.alert(
          "Success",
          `${memberName.trim()} added successfully.`
        );

        setPhoneNumber("");
        setMemberName("");

        // Refresh contact list
        await fetchContacts();
      } else {
        Alert.alert("Error", data?.message || "Failed to add member");
      }
    } catch (error) {
      console.log("Add member error:", error);

      if (error?.message === "Network request failed") {
        Alert.alert(
          "Connection Error",
          "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
        );
      } else {
        Alert.alert("Error", error?.message || "Server not reachable");
      }
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // SELECT GROUP
  // ==========================================
  const selectGroup = group => {
    const groupId = readGroupId(group);
    const groupName = readGroupName(group);

    if (!groupId) {
      Alert.alert(
        'Invalid Group',
        'This group did not include a valid ID. Refresh the group list or contact support.'
      );
      return;
    }

    setSelectedGroupId(groupId);
    setSelectedGroupName(groupName);
    setShowGroupPicker(false);
  };

  const dynamicTextColor = theme.text || "#1E293B";
  const dynamicCardBg = theme.card || "#FFFFFF";
  const dynamicSubtleBorder = theme.border || "#E2E8F0";

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.bg || "#F8FAFC" },
      ]}
    >
      <StatusBar
        barStyle={theme.dark ? "light-content" : "dark-content"}
        backgroundColor={theme.bg || "#F8FAFC"}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="arrow-back" size={22} color={dynamicTextColor} />
          </TouchableOpacity>

          <View
            style={[
              styles.headerBox,
              {
                backgroundColor: theme.headerBox || "#2563EB",
              },
            ]}
          >
            <Text style={styles.headerText}>ADD MEMBER</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        <Text style={[styles.title, { color: dynamicTextColor }]}>
          Add New Member
        </Text>

        {/* INFO BANNER */}
        <View style={styles.infoBanner}>
          <Icon
            name="information-circle-outline"
            size={20}
            color="#1D4ED8"
            style={{ marginTop: 2 }}
          />
          <Text style={styles.infoText}>
            Members added here are saved as{" "}
            <Text style={styles.boldInfoText}>External Contacts</Text>. They
            cannot receive tasks via the app (no forwarding).
          </Text>
        </View>

        {/* GROUP SELECTOR */}
        {!groupIdParam && (
          <View style={styles.fieldSection}>
            <Text style={[styles.label, { color: dynamicTextColor }]}>
              Select Group
            </Text>

            <TouchableOpacity
              style={[
                styles.groupPicker,
                {
                  backgroundColor: dynamicCardBg,
                  borderColor: dynamicSubtleBorder,
                },
              ]}
              onPress={() => setShowGroupPicker(!showGroupPicker)}
              activeOpacity={0.8}
            >
              <View style={styles.inlineRow}>
                <Icon
                  name="people-outline"
                  size={18}
                  color={effectiveGroupId ? "#2563EB" : "#94A3B8"}
                />
                <Text
                  style={[
                    styles.groupPickerText,
                    {
                      color: effectiveGroupId
                        ? dynamicTextColor
                        : "#94A3B8",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {selectedGroupName || "Tap to select a group..."}
                </Text>
              </View>

              <Icon
                name={showGroupPicker ? "chevron-up" : "chevron-down"}
                size={20}
                color={dynamicTextColor}
              />
            </TouchableOpacity>

            {showGroupPicker && (
              <View
                style={[
                  styles.dropdownBox,
                  {
                    backgroundColor: dynamicCardBg,
                    borderColor: dynamicSubtleBorder,
                  },
                ]}
              >
                {loadingGroups ? (
                  <ActivityIndicator
                    size="small"
                    color="#2563EB"
                    style={{ padding: 16 }}
                  />
                ) : groups.length === 0 ? (
                  <Text
                    style={[
                      styles.noGroupText,
                      { color: dynamicTextColor },
                    ]}
                  >
                    No groups found. Create a group first.
                  </Text>
                ) : (
                  groups.map((group) => {
                    const isSelected = selectedGroupId === group.id;
                    return (
                      <TouchableOpacity
                        key={group.id.toString()}
                        style={[
                          styles.dropdownItem,
                          isSelected && styles.dropdownItemSelected,
                        ]}
                        onPress={() => selectGroup(group)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            { color: dynamicTextColor },
                            isSelected && styles.dropdownItemTextSelected,
                          ]}
                        >
                          {group.name}
                        </Text>

                        {isSelected && (
                          <Icon name="checkmark" size={18} color="#16A34A" />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}
          </View>
        )}

        {/* GROUP INFO BANNER */}
        {groupIdParam && (
          <View style={styles.groupInfoBox}>
            <Icon name="people" size={18} color="#0284C7" />
            <Text style={styles.groupInfoText}>
              Adding to group ID:{" "}
              <Text style={{ fontWeight: "700" }}>{groupIdParam}</Text>
            </Text>
          </View>
        )}

        {/* FORM INPUTS CARD */}
        <View
          style={[
            styles.cardContainer,
            {
              backgroundColor: dynamicCardBg,
              borderColor: dynamicSubtleBorder,
            },
          ]}
        >
          {/* NAME */}
          <View style={styles.fieldSection}>
            <Text style={[styles.label, { color: dynamicTextColor }]}>
              Full Name
            </Text>
            <View style={styles.inputContainer}>
              <Icon
                name="person-outline"
                size={18}
                color="#94A3B8"
                style={styles.inputIcon}
              />
              <TextInput
                value={memberName}
                onChangeText={setMemberName}
                placeholder="Enter member name"
                placeholderTextColor="#94A3B8"
                style={[styles.input, { color: dynamicTextColor }]}
              />
            </View>
          </View>

          {/* PHONE */}
          <View style={styles.fieldSection}>
            <Text style={[styles.label, { color: dynamicTextColor }]}>
              Phone Number
            </Text>
            <View style={styles.inputContainer}>
              <Icon
                name="call-outline"
                size={18}
                color="#94A3B8"
                style={styles.inputIcon}
              />
              <TextInput
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="e.g. 03001234567"
                placeholderTextColor="#94A3B8"
                style={[styles.input, { color: dynamicTextColor }]}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* BUTTONS */}
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.addBtn,
                loading && styles.btnDisabled,
              ]}
              onPress={AddFunction}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.addBtnText}>ADD MEMBER</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* CREATE GROUP BUTTON */}
        <TouchableOpacity
          style={styles.createGroupBtn}
          onPress={() => navigation.navigate("CreateGroup")}
          activeOpacity={0.85}
        >
          <Icon name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.createGroupBtnText}>Create New Group</Text>
        </TouchableOpacity>

        {/* CONTACT LIST COLLAPSIBLE */}
        <TouchableOpacity
          style={[
            styles.contactsHeader,
            {
              backgroundColor: dynamicCardBg,
              borderColor: dynamicSubtleBorder,
            },
          ]}
          onPress={() => setShowContacts(!showContacts)}
          activeOpacity={0.8}
        >
          <View style={styles.inlineRow}>
            <Icon name="people-outline" size={20} color="#2563EB" />
            <Text style={[styles.contactsTitle, { color: dynamicTextColor }]}>
              Contact List ({contacts.length})
            </Text>
          </View>

          <Icon
            name={showContacts ? "chevron-up" : "chevron-down"}
            size={20}
            color={dynamicTextColor}
          />
        </TouchableOpacity>

        {showContacts && (
          <View
            style={[
              styles.contactsBox,
              {
                backgroundColor: dynamicCardBg,
                borderColor: dynamicSubtleBorder,
              },
            ]}
          >
            {loadingContacts ? (
              <ActivityIndicator
                size="small"
                color="#2563EB"
                style={{ margin: 24 }}
              />
            ) : contacts.length === 0 ? (
              <View style={styles.emptyContacts}>
                <Icon name="person-outline" size={36} color="#94A3B8" />
                <Text style={[styles.emptyText, { color: dynamicTextColor }]}>
                  No contacts yet.{"\n"}Add members to your groups.
                </Text>
              </View>
            ) : (
              contacts.map((contact, idx) => (
                <View
                  key={contact.id}
                  style={[
                    styles.contactRow,
                    idx !== contacts.length - 1 && styles.contactRowBorder,
                  ]}
                >
                  {/* AVATAR */}
                  <View
                    style={[
                      styles.avatar,
                      contact.isRegistered
                        ? styles.avatarRegistered
                        : styles.avatarExternal,
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        contact.isRegistered
                          ? styles.avatarTextRegistered
                          : styles.avatarTextExternal,
                      ]}
                    >
                      {contact.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  {/* INFO */}
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text
                      style={[
                        styles.contactName,
                        { color: dynamicTextColor },
                      ]}
                      numberOfLines={1}
                    >
                      {contact.name}
                    </Text>

                    {contact.phone ? (
                      <Text style={styles.contactPhone} numberOfLines={1}>
                        {contact.phone}
                      </Text>
                    ) : null}

                    <Text style={styles.contactGroup} numberOfLines={1}>
                      {contact.groupName}
                    </Text>
                  </View>

                  {/* BADGE */}
                  <View
                    style={[
                      styles.badge,
                      contact.isRegistered
                        ? styles.badgeRegistered
                        : styles.badgeExternal,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        contact.isRegistered
                          ? styles.badgeTextRegistered
                          : styles.badgeTextExternal,
                      ]}
                    >
                      {contact.isRegistered ? "Registered" : "External"}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* BOTTOM NAV */}
      <View
        style={[
          styles.bottom,
          {
            backgroundColor: theme.bottomNav || "#0F172A",
          },
        ]}
      >
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate("HomeDashboard")}
          activeOpacity={0.7}
        >
          <Icon name="home-outline" size={22} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate("ContactScreen")}
          activeOpacity={0.7}
        >
          <Icon name="people" size={24} color="#38BDF8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate("TimeBasedHistoryScreen")}
          activeOpacity={0.7}
        >
          <Icon name="time-outline" size={22} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate("SettingScreen")}
          activeOpacity={0.7}
        >
          <Icon name="settings-outline" size={22} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default AddMember;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 8 : 12,
    paddingBottom: 130,
  },

  header: {
    flexDirection: "row",
    justify: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  headerBox: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },

  headerText: {
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.8,
    color: "#FFFFFF",
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 16,
    letterSpacing: -0.5,
  },

  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#2563EB",
  },

  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#1E40AF",
    lineHeight: 19,
  },

  boldInfoText: {
    fontWeight: "700",
    color: "#1D4ED8",
  },

  fieldSection: {
    marginBottom: 16,
  },

  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 0.2,
  },

  cardContainer: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  inputIcon: {
    marginRight: 8,
  },

  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
  },

  groupPicker: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  groupPickerText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },

  dropdownBox: {
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    overflow: "hidden",
  },

  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  dropdownItemSelected: {
    backgroundColor: "#F0FDF4",
  },

  dropdownItemText: {
    fontSize: 14,
    fontWeight: "500",
  },

  dropdownItemTextSelected: {
    fontWeight: "700",
    color: "#166534",
  },

  noGroupText: {
    padding: 16,
    textAlign: "center",
    fontSize: 13,
    opacity: 0.7,
  },

  groupInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0F9FF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },

  groupInfoText: {
    fontSize: 13,
    color: "#0369A1",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },

  cancelBtn: {
    flex: 1,
    backgroundColor: "#64748B",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.5,
  },

  addBtn: {
    flex: 1,
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },

  addBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.5,
  },

  btnDisabled: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
    elevation: 0,
  },

  createGroupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D9488",
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: "#0D9488",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 2,
  },

  createGroupBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
    marginLeft: 8,
  },

  contactsHeader: {
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },

  contactsTitle: {
    fontSize: 14,
    fontWeight: "700",
  },

  contactsBox: {
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    overflow: "hidden",
  },

  emptyContacts: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  emptyText: {
    textAlign: "center",
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
    opacity: 0.7,
  },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },

  contactRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  avatarRegistered: {
    backgroundColor: "#DCFCE7",
  },

  avatarExternal: {
    backgroundColor: "#F1F5F9",
  },

  avatarText: {
    fontWeight: "700",
    fontSize: 16,
  },

  avatarTextRegistered: {
    color: "#15803D",
  },

  avatarTextExternal: {
    color: "#64748B",
  },

  contactName: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },

  contactPhone: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 2,
  },

  contactGroup: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
  },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  badgeRegistered: {
    backgroundColor: "#DCFCE7",
  },

  badgeExternal: {
    backgroundColor: "#F1F5F9",
  },

  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  badgeTextRegistered: {
    color: "#15803D",
  },

  badgeTextExternal: {
    color: "#64748B",
  },

  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingBottom: Platform.OS === "ios" ? 12 : 0,
  },

  iconBtn: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
});





































// import React, { useState, useEffect } from "react";
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
// } from "react-native";
// import Icon from '@react-native-vector-icons/ionicons';
// import AsyncStorage from "@react-native-async-storage/async-storage";

// import { useTheme } from "../../context/ThemeContext";
// import { BASE_URL } from "../../config/api";

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
//         name: "AuthStack",
//         state: {
//           routes: [{ name: "Login" }],
//         },
//       },
//     ],
//   });
// };

// const AddMember = ({ navigation, route }) => {
//   const { theme } = useTheme();

//   const groupIdParam = route?.params?.groupId || null;

//   const [phoneNumber, setPhoneNumber] = useState("");
//   const [memberName, setMemberName] = useState("");
//   const [loading, setLoading] = useState(false);

//   // Group picker
//   const [groups, setGroups] = useState([]);
//   const [selectedGroupId, setSelectedGroupId] =
//     useState(groupIdParam);
//   const [selectedGroupName, setSelectedGroupName] =
//     useState("");
//   const [showGroupPicker, setShowGroupPicker] =
//     useState(false);
//   const [loadingGroups, setLoadingGroups] =
//     useState(false);

//   // Contact list
//   const [contacts, setContacts] = useState([]);
//   const [loadingContacts, setLoadingContacts] =
//     useState(false);
//   const [showContacts, setShowContacts] =
//     useState(false);

//   const effectiveGroupId =
//     groupIdParam || selectedGroupId;

//   useEffect(() => {
//     fetchGroups();
//     fetchContacts();
//   }, []);

//   // ==========================================
//   // CHECK AUTHENTICATION
//   // ==========================================
//   const checkAuthentication = async () => {
//     try {
//       const token = await AsyncStorage.getItem("token");

//       if (!token) {
//         Alert.alert(
//           "Session Expired",
//           "Please login again.",
//           [
//             {
//               text: "OK",
//               onPress: () => goToLogin(navigation),
//             },
//           ]
//         );

//         return false;
//       }

//       return true;
//     } catch (error) {
//       console.log(
//         "Authentication check error:",
//         error
//       );

//       Alert.alert(
//         "Error",
//         "Unable to verify your session."
//       );

//       return false;
//     }
//   };

//   // ==========================================
//   // FETCH GROUPS
//   // ==========================================
//   const fetchGroups = async () => {
//     const authenticated =
//       await checkAuthentication();

//     if (!authenticated) return;

//     try {
//       setLoadingGroups(true);

//       const token =
//         await AsyncStorage.getItem("token");

//       // NOTE: correct route is "api/User/groups", not "api/groups".
//       // "api/groups" doesn't exist on the backend at all (404 with
//       // empty body -> "Unexpected end of input" when parsed).
//       const response = await fetch(
//         `${BASE_URL}/User/groups`,
//         {
//           method: "GET",
//           headers: {
//             Accept: "application/json",
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       let data;

//       try {
//         data = await response.json();
//       } catch (jsonError) {
//         throw new Error(
//           "Invalid response received from server."
//         );
//       }

//       console.log("Fetch Groups Response:", data);

//       if (response.ok && data?.success) {
//         setGroups(
//           Array.isArray(data.data)
//             ? data.data
//             : []
//         );
//       } else {
//         Alert.alert(
//           "Error",
//           data?.message ||
//             "Failed to load groups."
//         );
//       }
//     } catch (error) {
//       console.log(
//         "Fetch groups error:",
//         error
//       );

//       if (
//         error?.message ===
//         "Network request failed"
//       ) {
//         Alert.alert(
//           "Connection Error",
//           "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
//         );
//       } else {
//         Alert.alert(
//           "Error",
//           error?.message ||
//             "Failed to load groups."
//         );
//       }
//     } finally {
//       setLoadingGroups(false);
//     }
//   };

//   // ==========================================
//   // FETCH ALL CONTACTS
//   // ==========================================
//   const fetchContacts = async () => {
//     const authenticated =
//       await checkAuthentication();

//     if (!authenticated) return;

//     try {
//       setLoadingContacts(true);

//       const token =
//         await AsyncStorage.getItem("token");

//       // NOTE: must use "api/User/groups" here (not "api/Task/groups")
//       // because this endpoint is the only one that includes each
//       // group's members list (.Include(GroupMembers)) — which this
//       // screen needs to build the contact list.
//       const response = await fetch(
//         `${BASE_URL}/User/groups`,
//         {
//           method: "GET",
//           headers: {
//             Accept: "application/json",
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       let data;

//       try {
//         data = await response.json();
//       } catch (jsonError) {
//         throw new Error(
//           "Invalid response received from server."
//         );
//       }

//       console.log(
//         "Fetch Contacts Response:",
//         data
//       );

//       if (response.ok && data?.success) {
//         const allMembers = [];
//         const seen = new Set();

//         if (Array.isArray(data.data)) {
//           data.data.forEach((group) => {
//             if (!Array.isArray(group.members)) {
//               return;
//             }

//             group.members.forEach(
//               (member, index) => {
//                 const name =
//                   member.displayName ||
//                   member.name ||
//                   "Unknown";

//                 const phone =
//                   member.phone || "";

//                 const key = `${name}_${phone}`;

//                 if (seen.has(key)) {
//                   return;
//                 }

//                 if (
//                   name === "Unknown" &&
//                   !phone
//                 ) {
//                   return;
//                 }

//                 seen.add(key);

//                 allMembers.push({
//                   id: `${member.id || index}_${group.id}`,
//                   name,
//                   phone,
//                   groupName:
//                     group.name ||
//                     "Unknown Group",
//                   isRegistered:
//                     !!member.isRegistered,
//                 });
//               }
//             );
//           });
//         }

//         setContacts(allMembers);
//       } else {
//         Alert.alert(
//           "Error",
//           data?.message ||
//             "Failed to load contacts."
//         );
//       }
//     } catch (error) {
//       console.log(
//         "Fetch contacts error:",
//         error
//       );

//       if (
//         error?.message ===
//         "Network request failed"
//       ) {
//         Alert.alert(
//           "Connection Error",
//           "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
//         );
//       } else {
//         Alert.alert(
//           "Error",
//           error?.message ||
//             "Failed to load contacts."
//         );
//       }
//     } finally {
//       setLoadingContacts(false);
//     }
//   };

//   // ==========================================
//   // ADD MEMBER
//   // ==========================================
//   const AddFunction = async () => {
//     const authenticated =
//       await checkAuthentication();

//     if (!authenticated) return;

//     if (!memberName.trim()) {
//       Alert.alert(
//         "Error",
//         "Please enter the member name"
//       );
//       return;
//     }

//     if (!phoneNumber.trim()) {
//       Alert.alert(
//         "Error",
//         "Please enter the phone number"
//       );
//       return;
//     }

//     if (!effectiveGroupId) {
//       Alert.alert(
//         "Error",
//         "Please select a group first"
//       );
//       return;
//     }

//     try {
//       setLoading(true);

//       const token =
//         await AsyncStorage.getItem("token");

//       // NOTE: correct route is "api/Managment/{groupId}/members"
//       // (ManagmentController), not "api/groups/{groupId}/members"
//       // which does not exist on the backend.
//       const response = await fetch(
//         `${BASE_URL}/Managment/${effectiveGroupId}/members`,
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//             Accept: "application/json",
//             Authorization: `Bearer ${token}`,
//           },
//           body: JSON.stringify({
//             userId: null,
//             name: memberName.trim(),
//             phone: phoneNumber.trim(),
//           }),
//         }
//       );

//       let data;

//       try {
//         data = await response.json();
//       } catch (jsonError) {
//         throw new Error(
//           "Invalid response received from server."
//         );
//       }

//       console.log(
//         "Add Member Response:",
//         data
//       );

//       if (response.ok && data?.success) {
//         Alert.alert(
//           "Success",
//           `${memberName.trim()} added successfully.`
//         );

//         setPhoneNumber("");
//         setMemberName("");

//         // Refresh contact list
//         await fetchContacts();
//       } else {
//         Alert.alert(
//           "Error",
//           data?.message ||
//             "Failed to add member"
//         );
//       }
//     } catch (error) {
//       console.log(
//         "Add member error:",
//         error
//       );

//       if (
//         error?.message ===
//         "Network request failed"
//       ) {
//         Alert.alert(
//           "Connection Error",
//           "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
//         );
//       } else {
//         Alert.alert(
//           "Error",
//           error?.message ||
//             "Server not reachable"
//         );
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ==========================================
//   // SELECT GROUP
//   // ==========================================
//   const selectGroup = (group) => {
//     setSelectedGroupId(group.id);
//     setSelectedGroupName(group.name);
//     setShowGroupPicker(false);
//   };

//   return (
//     <SafeAreaView
//       style={[
//         styles.container,
//         { backgroundColor: theme.bg },
//       ]}
//     >
//       <ScrollView
//         contentContainerStyle={styles.content}
//         showsVerticalScrollIndicator={false}
//         keyboardShouldPersistTaps="handled"
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
//               {
//                 backgroundColor:
//                   theme.headerBox,
//               },
//             ]}
//           >
//             <Text
//               style={[
//                 styles.headerText,
//                 { color: theme.text },
//               ]}
//             >
//               ADD MEMBER
//             </Text>
//           </View>

//           <View style={{ width: 22 }} />
//         </View>

//         <Text
//           style={[
//             styles.title,
//             { color: theme.text },
//           ]}
//         >
//           Add New Member
//         </Text>

//         {/* INFO BANNER */}
//         <View style={styles.infoBanner}>
//           <Icon
//             name="information-circle-outline"
//             size={16}
//             color="#1565C0"
//           />

//           <Text style={styles.infoText}>
//             Members added here are saved as{" "}
//             <Text style={{ fontWeight: "700" }}>
//               External Contacts
//             </Text>
//             .{"\n"}
//             They cannot receive tasks via the app
//             (no forwarding).
//           </Text>
//         </View>

//         {/* GROUP SELECTOR */}
//         {!groupIdParam && (
//           <>
//             <Text
//               style={[
//                 styles.label,
//                 { color: theme.text },
//               ]}
//             >
//               Select Group:
//             </Text>

//             <TouchableOpacity
//               style={[
//                 styles.groupPicker,
//                 {
//                   backgroundColor:
//                     theme.card,
//                 },
//               ]}
//               onPress={() =>
//                 setShowGroupPicker(
//                   !showGroupPicker
//                 )
//               }
//             >
//               <Text
//                 style={[
//                   styles.groupPickerText,
//                   {
//                     color: effectiveGroupId
//                       ? theme.text
//                       : "#999",
//                   },
//                 ]}
//               >
//                 {selectedGroupName ||
//                   "Tap to select a group..."}
//               </Text>

//               <Icon
//                 name={
//                   showGroupPicker
//                     ? "chevron-up"
//                     : "chevron-down"
//                 }
//                 size={18}
//                 color={theme.text}
//               />
//             </TouchableOpacity>

//             {showGroupPicker && (
//               <View
//                 style={[
//                   styles.dropdownBox,
//                   {
//                     backgroundColor:
//                       theme.card,
//                   },
//                 ]}
//               >
//                 {loadingGroups ? (
//                   <ActivityIndicator
//                     size="small"
//                     color={theme.text}
//                     style={{
//                       padding: 10,
//                     }}
//                   />
//                 ) : groups.length === 0 ? (
//                   <Text
//                     style={[
//                       styles.noGroupText,
//                       {
//                         color: theme.text,
//                       },
//                     ]}
//                   >
//                     No groups found. Create a
//                     group first.
//                   </Text>
//                 ) : (
//                   groups.map((group) => (
//                     <TouchableOpacity
//                       key={group.id.toString()}
//                       style={[
//                         styles.dropdownItem,
//                         selectedGroupId ===
//                           group.id &&
//                           styles.dropdownItemSelected,
//                       ]}
//                       onPress={() =>
//                         selectGroup(group)
//                       }
//                     >
//                       <Text
//                         style={[
//                           styles.dropdownItemText,
//                           {
//                             color: theme.text,
//                           },
//                         ]}
//                       >
//                         {group.name}
//                       </Text>

//                       {selectedGroupId ===
//                         group.id && (
//                         <Icon
//                           name="checkmark"
//                           size={16}
//                           color="#4CAF50"
//                         />
//                       )}
//                     </TouchableOpacity>
//                   ))
//                 )}
//               </View>
//             )}
//           </>
//         )}

//         {/* GROUP INFO */}
//         {groupIdParam && (
//           <View style={styles.groupInfoBox}>
//             <Icon
//               name="people"
//               size={16}
//               color="#6ED3E8"
//             />

//             <Text
//               style={[
//                 styles.groupInfoText,
//                 { color: theme.text },
//               ]}
//             >
//               Adding to group ID:{" "}
//               {groupIdParam}
//             </Text>
//           </View>
//         )}

//         {/* NAME */}
//         <Text
//           style={[
//             styles.label,
//             { color: theme.text },
//           ]}
//         >
//           Name:
//         </Text>

//         <TextInput
//           value={memberName}
//           onChangeText={setMemberName}
//           placeholder="Enter member name"
//           placeholderTextColor="#999"
//           style={[
//             styles.input,
//             { color: theme.text },
//           ]}
//         />

//         {/* PHONE */}
//         <Text
//           style={[
//             styles.label,
//             { color: theme.text },
//           ]}
//         >
//           Phone Number:
//         </Text>

//         <TextInput
//           value={phoneNumber}
//           onChangeText={setPhoneNumber}
//           placeholder="e.g. 03001234567"
//           placeholderTextColor="#999"
//           style={[
//             styles.input,
//             { color: theme.text },
//           ]}
//           keyboardType="phone-pad"
//         />

//         {/* BUTTONS */}
//         <View style={styles.row}>
//           <TouchableOpacity
//             style={styles.cancelBtn}
//             onPress={() =>
//               navigation.goBack()
//             }
//           >
//             <Text style={styles.btnText}>
//               CANCEL
//             </Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[
//               styles.addBtn,
//               (!effectiveGroupId ||
//                 loading) &&
//                 styles.btnDisabled,
//             ]}
//             onPress={AddFunction}
//             disabled={
//               !effectiveGroupId || loading
//             }
//           >
//             {loading ? (
//               <ActivityIndicator color="#fff" />
//             ) : (
//               <Text style={styles.btnText}>
//                 ADD
//               </Text>
//             )}
//           </TouchableOpacity>
//         </View>

//         {/* CREATE GROUP */}
//         <TouchableOpacity
//           style={styles.createGroupBtn}
//           onPress={() =>
//             navigation.navigate(
//               "CreateGroup"
//             )
//           }
//         >
//           <Icon
//             name="add-circle-outline"
//             size={18}
//             color="#fff"
//           />

//           <Text style={styles.btnText}>
//             {"  "}Create New Group
//           </Text>
//         </TouchableOpacity>

//         {/* CONTACT LIST */}
//         <TouchableOpacity
//           style={[
//             styles.contactsHeader,
//             {
//               backgroundColor:
//                 theme.card,
//             },
//           ]}
//           onPress={() =>
//             setShowContacts(
//               !showContacts
//             )
//           }
//         >
//           <View
//             style={{
//               flexDirection: "row",
//               alignItems: "center",
//               gap: 8,
//             }}
//           >
//             <Icon
//               name="people-outline"
//               size={18}
//               color={theme.text}
//             />

//             <Text
//               style={[
//                 styles.contactsTitle,
//                 { color: theme.text },
//               ]}
//             >
//               Contact List ({contacts.length})
//             </Text>
//           </View>

//           <Icon
//             name={
//               showContacts
//                 ? "chevron-up"
//                 : "chevron-down"
//             }
//             size={18}
//             color={theme.text}
//           />
//         </TouchableOpacity>

//         {showContacts && (
//           <View
//             style={[
//               styles.contactsBox,
//               {
//                 backgroundColor:
//                   theme.card,
//               },
//             ]}
//           >
//             {loadingContacts ? (
//               <ActivityIndicator
//                 size="small"
//                 color={theme.text}
//                 style={{ margin: 16 }}
//               />
//             ) : contacts.length === 0 ? (
//               <View
//                 style={styles.emptyContacts}
//               >
//                 <IconIcon
//                   name="person-outline"
//                   size={30}
//                   color="#999"
//                 />

//                 <Text
//                   style={[
//                     styles.emptyText,
//                     {
//                       color: theme.text,
//                     },
//                   ]}
//                 >
//                   No contacts yet.{"\n"}
//                   Add members to your groups.
//                 </Text>
//               </View>
//             ) : (
//               contacts.map((contact) => (
//                 <View
//                   key={contact.id}
//                   style={styles.contactRow}
//                 >
//                   {/* AVATAR */}
//                   <View
//                     style={[
//                       styles.avatar,
//                       contact.isRegistered
//                         ? styles.avatarRegistered
//                         : styles.avatarExternal,
//                     ]}
//                   >
//                     <Text
//                       style={styles.avatarText}
//                     >
//                       {contact.name
//                         .charAt(0)
//                         .toUpperCase()}
//                     </Text>
//                   </View>

//                   {/* INFO */}
//                   <View
//                     style={{ flex: 1 }}
//                   >
//                     <Text
//                       style={[
//                         styles.contactName,
//                         {
//                           color:
//                             theme.text,
//                         },
//                       ]}
//                     >
//                       {contact.name}
//                     </Text>

//                     {contact.phone ? (
//                       <Text
//                         style={[
//                           styles.contactPhone,
//                           {
//                             color:
//                               theme.text,
//                           },
//                         ]}
//                       >
//                         {contact.phone}
//                       </Text>
//                     ) : null}

//                     <Text
//                       style={
//                         styles.contactGroup
//                       }
//                     >
//                       {contact.groupName}
//                     </Text>
//                   </View>

//                   {/* BADGE */}
//                   <View
//                     style={[
//                       styles.badge,
//                       contact.isRegistered
//                         ? styles.badgeRegistered
//                         : styles.badgeExternal,
//                     ]}
//                   >
//                     <Text
//                       style={styles.badgeText}
//                     >
//                       {contact.isRegistered
//                         ? "Registered"
//                         : "External"}
//                     </Text>
//                   </View>
//                 </View>
//               ))
//             )}
//           </View>
//         )}
//       </ScrollView>

//       {/* BOTTOM NAV */}
//       <View
//         style={[
//           styles.bottom,
//           {
//             backgroundColor:
//               theme.bottomNav,
//           },
//         ]}
//       >
//         <TouchableOpacity
//           style={styles.iconiconBtn}
//           onPress={() =>
//             navigation.navigate(
//               "HomeDashboard"
//             )
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
//             navigation.navigate(
//               "ContactScreen"
//             )
//           }
//         >
//           <Icon
//             name="people"
//             size={24}
//             color="#fff"
//           />
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate(
//               "TimeBasedHistoryScreen"
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
//             navigation.navigate(
//               "SettingScreen"
//             )
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

// export default AddMember;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },

//   content: {
//     padding: 20,
//     paddingBottom: 120,
//   },

//   header: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//   },

//   headerBox: {
//     paddingVertical: 6,
//     paddingHorizontal: 18,
//     borderRadius: 10,
//     elevation: 3,
//   },

//   headerText: {
//     fontWeight: "800",
//     fontSize: 16,
//   },

//   title: {
//     marginTop: 30,
//     fontSize: 22,
//     fontWeight: "700",
//     marginBottom: 14,
//   },

//   infoBanner: {
//     flexDirection: "row",
//     alignItems: "flex-start",
//     gap: 8,
//     backgroundColor: "#E3F2FD",
//     borderRadius: 10,
//     padding: 12,
//     marginBottom: 16,
//     borderLeftWidth: 4,
//     borderLeftColor: "#1565C0",
//   },

//   infoText: {
//     flex: 1,
//     fontSize: 12,
//     color: "#1565C0",
//     lineHeight: 18,
//   },

//   label: {
//     fontWeight: "600",
//     marginBottom: 8,
//     marginTop: 6,
//   },

//   input: {
//     backgroundColor: "#EDEDED",
//     borderRadius: 10,
//     padding: 14,
//     marginBottom: 16,
//     fontSize: 14,
//   },

//   groupPicker: {
//     borderRadius: 10,
//     padding: 14,
//     marginBottom: 4,
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     elevation: 2,
//   },

//   groupPickerText: {
//     fontSize: 14,
//   },

//   dropdownBox: {
//     borderRadius: 10,
//     marginBottom: 16,
//     elevation: 5,
//     overflow: "hidden",
//   },

//   dropdownItem: {
//     paddingVertical: 14,
//     paddingHorizontal: 18,
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     borderBottomWidth: 1,
//     borderBottomColor: "#e0e0e0",
//   },

//   dropdownItemSelected: {
//     backgroundColor: "#E8F5E9",
//   },

//   dropdownItemText: {
//     fontSize: 14,
//     fontWeight: "500",
//   },

//   noGroupText: {
//     padding: 14,
//     textAlign: "center",
//     opacity: 0.7,
//   },

//   groupInfoBox: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 8,
//     backgroundColor: "#E3F7FF",
//     borderRadius: 8,
//     padding: 10,
//     marginBottom: 16,
//   },

//   groupInfoText: {
//     fontSize: 12,
//   },

//   row: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     marginTop: 30,
//   },

//   cancelBtn: {
//     width: "45%",
//     backgroundColor: "#555",
//     paddingVertical: 14,
//     borderRadius: 30,
//     alignItems: "center",
//   },

//   addBtn: {
//     width: "45%",
//     backgroundColor: "#000",
//     paddingVertical: 14,
//     borderRadius: 30,
//     alignItems: "center",
//   },

//   btnDisabled: {
//     backgroundColor: "#999",
//   },

//   btnText: {
//     color: "#fff",
//     fontWeight: "800",
//   },

//   createGroupBtn: {
//     marginTop: 22,
//     alignSelf: "center",
//     backgroundColor: "#6ED3E8",
//     paddingVertical: 14,
//     paddingHorizontal: 30,
//     borderRadius: 30,
//     flexDirection: "row",
//     alignItems: "center",
//   },

//   contactsHeader: {
//     marginTop: 28,
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     padding: 14,
//     borderRadius: 12,
//     elevation: 2,
//   },

//   contactsTitle: {
//     fontSize: 15,
//     fontWeight: "700",
//   },

//   contactsBox: {
//     borderRadius: 12,
//     marginTop: 4,
//     overflow: "hidden",
//     elevation: 2,
//   },

//   contactRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     padding: 14,
//     borderBottomWidth: 1,
//     borderBottomColor: "#e0e0e0",
//   },

//   avatar: {
//     width: 42,
//     height: 42,
//     borderRadius: 21,
//     justifyContent: "center",
//     alignItems: "center",
//     marginRight: 12,
//   },

//   avatarRegistered: {
//     backgroundColor: "#4CAF50",
//   },

//   avatarExternal: {
//     backgroundColor: "#FF9800",
//   },

//   avatarText: {
//     color: "#fff",
//     fontWeight: "800",
//     fontSize: 16,
//   },

//   contactName: {
//     fontSize: 14,
//     fontWeight: "600",
//   },

//   contactPhone: {
//     fontSize: 11,
//     opacity: 0.7,
//     marginTop: 2,
//   },

//   contactGroup: {
//     fontSize: 10,
//     color: "#6ED3E8",
//     marginTop: 2,
//     fontWeight: "600",
//   },

//   badge: {
//     paddingHorizontal: 8,
//     paddingVertical: 3,
//     borderRadius: 10,
//     alignSelf: "center",
//   },

//   badgeRegistered: {
//     backgroundColor: "#E8F5E9",
//   },

//   badgeExternal: {
//     backgroundColor: "#FFF3E0",
//   },

//   badgeText: {
//     fontSize: 10,
//     fontWeight: "700",
//     color: "#555",
//   },

//   emptyContacts: {
//     padding: 24,
//     alignItems: "center",
//     gap: 8,
//   },

//   emptyText: {
//     textAlign: "center",
//     opacity: 0.6,
//     lineHeight: 20,
//   },

//   bottom: {
//     position: "absolute",
//     bottom: 0,
//     width: "100%",
//     height: 65,
//     flexDirection: "row",
//     justifyContent: "space-around",
//     alignItems: "center",
//   },

//   iconBtn: {
//     flex: 1,
//     alignItems: "center",
//     justifyContent: "center",
//   },
// });
