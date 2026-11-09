import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from "react-native";
import Icon from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "../../context/ThemeContext";
import { BASE_URL } from "../../config/api";

const SignUpScreen = ({ navigation }) => {
  const { theme } = useTheme();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);

  // ==============================
  // REGISTER FUNCTION
  // ==============================
  const handleRegister = async () => {
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phoneNumber: phoneNumber.trim(),
          password,
          confirmPassword,
        }),
      });

      let data;

      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error("Invalid response received from server");
      }

      console.log("Register Response:", data);

      // ==============================
      // SUCCESS
      // ==============================
      if (response.ok && data?.success) {
        const userData = data?.data;

        // Save JWT token if returned
        if (userData?.token) {
          await AsyncStorage.setItem("token", userData.token);
        }

        // Save user ID if returned
        if (
          userData?.userId !== undefined &&
          userData?.userId !== null
        ) {
          await AsyncStorage.setItem(
            "userId",
            userData.userId.toString()
          );
        }

        // Save user name if returned
        if (userData?.fullName) {
          await AsyncStorage.setItem(
            "userName",
            userData.fullName
          );
        }

        Alert.alert(
          "Success",
          data.message || "Registration Successful",
          [
            {
              text: "Continue",
              onPress: () => {
                // If registration returns a token, user is authenticated
                if (userData?.token) {
                  navigation.replace("MainStack");
                } else {
                  navigation.replace("Login");
                }
              },
            },
          ]
        );
      } else {
        // ==============================
        // API ERROR
        // ==============================
        Alert.alert(
          "Register Failed",
          data?.message || "Something went wrong"
        );
      }
    } catch (error) {
      console.log("Register Error:", error);

      if (error?.message === "Network request failed") {
        Alert.alert(
          "Connection Error",
          "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
        );
      } else {
        Alert.alert(
          "Error",
          error?.message || "Server not reachable"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Safe Fallbacks for Theme Properties
  const backgroundColor = theme?.bg || "#F8FAFC";
  const textColor = theme?.text || "#0F172A";
  const subTextColor = theme?.subText || "#64748B";
  const cardBg = theme?.cardBg || "#FFFFFF";
  const primaryColor = theme?.primary || "#2563EB";
  const borderColor = theme?.border || "#E2E8F0";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar
        barStyle={theme?.dark ? "light-content" : "dark-content"}
        backgroundColor={backgroundColor}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentWrapper}>
            {/* Header Navigation */}
            <View style={styles.header}>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  { backgroundColor: cardBg, borderColor },
                ]}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Icon
                  name="arrow-back-outline"
                  size={20}
                  color={textColor}
                />
              </TouchableOpacity>
            </View>

            {/* Header Title Section */}
            <View style={styles.titleSection}>
              <Text style={[styles.title, { color: textColor }]}>
                Create Account
              </Text>
              <Text style={[styles.subtitle, { color: subTextColor }]}>
                Sign up to get started with your new account
              </Text>
            </View>

            {/* Form Fields Container */}
            <View style={styles.form}>
              {/* First Name & Last Name (Row on larger screens, stacked on compact mobile) */}
              <View style={styles.nameRow}>
                <View style={[styles.fieldGroup, styles.halfWidth]}>
                  <Text style={[styles.label, { color: textColor }]}>
                    FIRST NAME *
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      { backgroundColor: cardBg, borderColor },
                    ]}
                  >
                    <Icon
                      name="person-outline"
                      size={18}
                      color={subTextColor}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      placeholder="MANNAN"
                      placeholderTextColor={subTextColor}
                      style={[styles.input, { color: textColor }]}
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View style={[styles.fieldGroup, styles.halfWidth]}>
                  <Text style={[styles.label, { color: textColor }]}>
                    LAST NAME *
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      { backgroundColor: cardBg, borderColor },
                    ]}
                  >
                    <Icon
                      name="person-outline"
                      size={18}
                      color={subTextColor}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      placeholder="RANA"
                      placeholderTextColor={subTextColor}
                      style={[styles.input, { color: textColor }]}
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              </View>

              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: textColor }]}>
                  EMAIL ADDRESS *
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    { backgroundColor: cardBg, borderColor },
                  ]}
                >
                  <Icon
                    name="mail-outline"
                    size={18}
                    color={subTextColor}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="name@example.com"
                    placeholderTextColor={subTextColor}
                    style={[styles.input, { color: textColor }]}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Phone Number */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: textColor }]}>
                  PHONE NUMBER (OPTIONAL)
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    { backgroundColor: cardBg, borderColor },
                  ]}
                >
                  <Icon
                    name="call-outline"
                    size={18}
                    color={subTextColor}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="+92 333 5678421"
                    placeholderTextColor={subTextColor}
                    style={[styles.input, { color: textColor }]}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: textColor }]}>
                  PASSWORD *
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    { backgroundColor: cardBg, borderColor },
                  ]}
                >
                  <Icon
                    name="lock-closed-outline"
                    size={18}
                    color={subTextColor}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Create password"
                    placeholderTextColor={subTextColor}
                    style={[styles.input, { color: textColor }]}
                    secureTextEntry={secure}
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: textColor }]}>
                  CONFIRM PASSWORD *
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    { backgroundColor: cardBg, borderColor },
                  ]}
                >
                  <Icon
                    name="lock-closed-outline"
                    size={18}
                    color={subTextColor}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Re-enter password"
                    placeholderTextColor={subTextColor}
                    style={[styles.input, { color: textColor }]}
                    secureTextEntry={secure}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setSecure(!secure)}
                    activeOpacity={0.6}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon
                      name={secure ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={subTextColor}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Signup Action Button */}
              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: primaryColor },
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer Links */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: subTextColor }]}>
                Already have an account?{" "}
                <Text
                  style={[styles.loginText, { color: primaryColor }]}
                  onPress={() => navigation.navigate("Login")}
                >
                  Login
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignUpScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 12 : 8,
    paddingBottom: 28,
    alignItems: "center",
  },
  contentWrapper: {
    width: "100%",
    maxWidth: 480, // Responsive container max-width for tablets & desktop views
    justifyContent: "space-between",
    flex: 1,
  },
  header: {
    height: 48,
    justifyContent: "center",
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  titleSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
  },
  form: {
    width: "100%",
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    height: "100%",
  },
  eyeButton: {
    padding: 6,
    marginLeft: 4,
  },
  button: {
    height: 52,
    borderRadius: 12,
    marginTop: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footer: {
    marginTop: 28,
    alignItems: "center",
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 14,
  },
  loginText: {
    fontWeight: "700",
  },
});




























// import React, { useState } from "react";
// import {
//   View,
//   Text,
//   StyleSheet,
//   SafeAreaView,
//   TouchableOpacity,
//   TextInput,
//   ScrollView,
//   Alert,
//   ActivityIndicator,
// } from "react-native";
// import Icon from '@react-native-vector-icons/ionicons';
// import AsyncStorage from "@react-native-async-storage/async-storage";

// import { useTheme } from "../../context/ThemeContext";
// import { BASE_URL } from "../../config/api";

// const SignUpScreen = ({ navigation }) => {
//   const { theme } = useTheme();

//   const [firstName, setFirstName] = useState("");
//   const [lastName, setLastName] = useState("");
//   const [email, setEmail] = useState("");
//   const [phoneNumber, setPhoneNumber] = useState("");
//   const [password, setPassword] = useState("");
//   const [confirmPassword, setConfirmPassword] = useState("");
//   const [secure, setSecure] = useState(true);
//   const [loading, setLoading] = useState(false);

//   // ==============================
//   // REGISTER FUNCTION
//   // ==============================
//   const handleRegister = async () => {
//     if (
//       !firstName.trim() ||
//       !lastName.trim() ||
//       !email.trim() ||
//       !password ||
//       !confirmPassword
//     ) {
//       Alert.alert("Error", "Please fill all required fields");
//       return;
//     }

//     if (password !== confirmPassword) {
//       Alert.alert("Error", "Passwords do not match");
//       return;
//     }

//     try {
//       setLoading(true);

//       const response = await fetch(`${BASE_URL}/auth/register`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Accept: "application/json",
//         },
//         body: JSON.stringify({
//           firstName: firstName.trim(),
//           lastName: lastName.trim(),
//           email: email.trim(),
//           phoneNumber: phoneNumber.trim(),
//           password,
//           confirmPassword,
//         }),
//       });

//       let data;

//       try {
//         data = await response.json();
//       } catch (jsonError) {
//         throw new Error("Invalid response received from server");
//       }

//       console.log("Register Response:", data);

//       // ==============================
//       // SUCCESS
//       // ==============================
//       if (response.ok && data?.success) {
//         const userData = data?.data;

//         // Save JWT token if returned
//         if (userData?.token) {
//           await AsyncStorage.setItem(
//             "token",
//             userData.token
//           );
//         }

//         // Save user ID if returned
//         if (
//           userData?.userId !== undefined &&
//           userData?.userId !== null
//         ) {
//           await AsyncStorage.setItem(
//             "userId",
//             userData.userId.toString()
//           );
//         }

//         // Save user name if returned
//         if (userData?.fullName) {
//           await AsyncStorage.setItem(
//             "userName",
//             userData.fullName
//           );
//         }

//         Alert.alert(
//           "Success",
//           data.message || "Registration Successful",
//           [
//             {
//               text: "Continue",
//               onPress: () => {
//                 // If registration returns a token,
//                 // user is already authenticated.
//                 if (userData?.token) {
//                   navigation.replace("MainStack");
//                 } else {
//                   navigation.replace("Login");
//                 }
//               },
//             },
//           ]
//         );
//       } else {
//         // ==============================
//         // API ERROR
//         // ==============================
//         Alert.alert(
//           "Register Failed",
//           data?.message || "Something went wrong"
//         );
//       }
//     } catch (error) {
//       console.log("Register Error:", error);

//       if (error?.message === "Network request failed") {
//         Alert.alert(
//           "Connection Error",
//           "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
//         );
//       } else {
//         Alert.alert(
//           "Error",
//           error?.message || "Server not reachable"
//         );
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <SafeAreaView
//       style={[
//         styles.container,
//         { backgroundColor: theme.bg },
//       ]}
//     >
//       <ScrollView
//         showsVerticalScrollIndicator={false}
//         keyboardShouldPersistTaps="handled"
//       >
//         {/* Back Button */}
//         <TouchableOpacity
//           style={styles.backButton}
//           onPress={() => navigation.goBack()}
//         >
//           <Icon
//             name="arrow-left"
//             size={24}
//             color={theme.text}
//           />
//         </TouchableOpacity>

//         {/* Title */}
//         <Text
//           style={[
//             styles.title,
//             { color: theme.text },
//           ]}
//         >
//           SIGNUP
//         </Text>

//         {/* First Name */}
//         <View style={styles.inputContainer}>
//           <Icon
//             name="user"
//             size={18}
//             color="#333"
//           />

//           <TextInput
//             placeholder="First Name"
//             placeholderTextColor="#777"
//             style={styles.input}
//             value={firstName}
//             onChangeText={setFirstName}
//             autoCapitalize="words"
//           />
//         </View>

//         {/* Last Name */}
//         <View style={styles.inputContainer}>
//           <Icon
//             name="user"
//             size={18}
//             color="#333"
//           />

//           <TextInput
//             placeholder="Last Name"
//             placeholderTextColor="#777"
//             style={styles.input}
//             value={lastName}
//             onChangeText={setLastName}
//             autoCapitalize="words"
//           />
//         </View>

//         {/* Email */}
//         <View style={styles.inputContainer}>
//           <Icon
//             name="mail"
//             size={18}
//             color="#333"
//           />

//           <TextInput
//             placeholder="Email"
//             placeholderTextColor="#777"
//             style={styles.input}
//             value={email}
//             onChangeText={setEmail}
//             keyboardType="email-address"
//             autoCapitalize="none"
//             autoCorrect={false}
//           />
//         </View>

//         {/* Phone Number */}
//         <View style={styles.inputContainer}>
//           <Icon
//             name="phone"
//             size={18}
//             color="#333"
//           />

//           <TextInput
//             placeholder="Phone Number (Optional)"
//             placeholderTextColor="#777"
//             style={styles.input}
//             value={phoneNumber}
//             onChangeText={setPhoneNumber}
//             keyboardType="phone-pad"
//           />
//         </View>

//         {/* Password */}
//         <View style={styles.inputContainer}>
//           <Icon
//             name="lock"
//             size={18}
//             color="#333"
//           />

//           <TextInput
//             placeholder="Password"
//             placeholderTextColor="#777"
//             style={styles.input}
//             secureTextEntry={secure}
//             value={password}
//             onChangeText={setPassword}
//             autoCapitalize="none"
//             autoCorrect={false}
//           />
//         </View>

//         {/* Confirm Password */}
//         <View style={styles.inputContainer}>
//           <Icon
//             name="lock"
//             size={18}
//             color="#333"
//           />

//           <TextInput
//             placeholder="Confirm Password"
//             placeholderTextColor="#777"
//             style={styles.input}
//             secureTextEntry={secure}
//             value={confirmPassword}
//             onChangeText={setConfirmPassword}
//             autoCapitalize="none"
//             autoCorrect={false}
//           />

//           <TouchableOpacity
//             style={styles.eyeButton}
//             onPress={() => setSecure(!secure)}
//           >
//             <Icon
//               name={secure ? "eye-off" : "eye"}
//               size={18}
//               color="#333"
//             />
//           </TouchableOpacity>
//         </View>

//         {/* Signup Button */}
//         <TouchableOpacity
//           style={[
//             styles.button,
//             loading && styles.buttonDisabled,
//           ]}
//           onPress={handleRegister}
//           disabled={loading}
//         >
//           {loading ? (
//             <ActivityIndicator color="#fff" />
//           ) : (
//             <Text style={styles.buttonText}>
//               SIGNUP
//             </Text>
//           )}
//         </TouchableOpacity>

//         {/* Footer */}
//         <View style={styles.footer}>
//           <Text
//             style={[
//               styles.footerText,
//               { color: theme.text },
//             ]}
//           >
//             Already have an account?{" "}

//             <Text
//               style={styles.loginText}
//               onPress={() =>
//                 navigation.navigate("Login")
//               }
//             >
//               Login
//             </Text>
//           </Text>
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   );
// };

// export default SignUpScreen;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     padding: 20,
//   },

//   backButton: {
//     alignSelf: "flex-start",
//     padding: 4,
//   },

//   title: {
//     textAlign: "center",
//     fontSize: 22,
//     fontWeight: "700",
//     marginVertical: 30,
//     letterSpacing: 2,
//   },

//   inputContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     backgroundColor: "#D9DEE4",
//     borderRadius: 30,
//     paddingHorizontal: 15,
//     height: 55,
//     marginBottom: 15,
//     elevation: 3,
//   },

//   input: {
//     flex: 1,
//     marginLeft: 10,
//     color: "#000",
//   },

//   eyeButton: {
//     padding: 5,
//   },

//   button: {
//     backgroundColor: "#000",
//     marginTop: 25,
//     borderRadius: 30,
//     height: 50,
//     justifyContent: "center",
//     alignItems: "center",
//     elevation: 4,
//   },

//   buttonDisabled: {
//     opacity: 0.7,
//   },

//   buttonText: {
//     color: "#fff",
//     fontWeight: "700",
//     letterSpacing: 1,
//   },

//   footer: {
//     marginTop: 25,
//     alignItems: "center",
//     paddingBottom: 30,
//   },

//   footerText: {
//     fontSize: 13,
//   },

//   loginText: {
//     color: "#2F80ED",
//     fontWeight: "600",
//   },
// });
