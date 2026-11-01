import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, RefreshControl,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/ionicons';
import { useTheme } from '../context/ThemeContext';
import { useContacts } from '../hooks/useContacts';

const ContactManager = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const contacts = useContacts();
  const [phone, setPhone] = useState('');
  const [alias, setAlias] = useState('');
  const [tab, setTab] = useState('contacts');
  const [search, setSearch] = useState('');
  const text = theme.text || '#0F172A';
  const muted = theme.subText || '#64748B';
  const surface = theme.card || '#FFFFFF';
  const border = theme.border || (isDark ? '#334155' : '#DCE5E8');
  const primary = isDark ? '#2DD4BF' : '#099D9F';
  const locked = !!contacts.busy;
  const shown = contacts.contacts.filter(person => `${person.name} ${person.phone}`.toLowerCase().includes(search.trim().toLowerCase()));
  const send = async () => {
    if (locked) return;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 17) { Alert.alert('Phone required', 'Enter the phone number of a registered app user.'); return; }
    try {
      if (await contacts.send({ phone: phone.trim(), alias: alias.trim() || null })) {
        setPhone(''); setAlias(''); setTab('pending');
      }
    } catch (failure) { Alert.alert('Could not send request', failure.message || 'Please try again.'); }
  };
  const respond = async (request, action) => {
    try { await contacts.respond(request, action); }
    catch (failure) { Alert.alert('Could not update request', failure.message || 'Refresh and try again.'); }
  };
  const remove = person => Alert.alert('Remove contact?', person.contactUserId
    ? `Remove ${person.name}? This removes the accepted contact connection for both of you. Reconnecting requires a new request. Your groups and existing tasks will not be deleted.`
    : `Remove ${person.name} from your saved contacts? Your groups and existing tasks will not be deleted.`, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      try { await contacts.remove(person); }
      catch (failure) { Alert.alert('Could not remove contact', failure.message || 'Please try again.'); }
    } },
  ]);
  const requestRow = (request, incoming) => <View key={request.id} style={[styles.row, { backgroundColor: surface, borderColor: border }]}>
    <View style={[styles.avatar, { backgroundColor: isDark ? '#3F351B' : '#FFF0CE' }]}><Icon name="person-add-outline" size={18} color="#B7791F" /></View>
    <View style={styles.person}><Text style={[styles.name, { color: text }]}>{request.name}</Text><Text style={[styles.phone, { color: muted }]}>{request.phone}</Text>
      {!incoming ? <Text style={[styles.waiting, { color: muted }]}>Waiting for acceptance</Text> : null}</View>
    {incoming ? <>
      <TouchableOpacity testID={`accept-request-${request.id}`} disabled={locked} onPress={() => respond(request, 'accept')}
        accessibilityLabel={`Accept request from ${request.name}`} style={styles.action}>
        <Icon name="checkmark-circle" size={29} color={locked ? muted : '#16A34A'} />
      </TouchableOpacity>
      <TouchableOpacity testID={`reject-request-${request.id}`} disabled={locked} onPress={() => respond(request, 'reject')}
        accessibilityLabel={`Reject request from ${request.name}`} style={styles.action}>
        <Icon name="close-circle" size={29} color={locked ? muted : '#DC2626'} />
      </TouchableOpacity>
    </> : <TouchableOpacity testID={`cancel-request-${request.id}`} disabled={locked} onPress={() => respond(request, 'cancel')}
      accessibilityLabel={`Cancel request to ${request.name}`} style={styles.action}>
      <Text style={[styles.cancel, { color: muted }]}>Cancel</Text>
    </TouchableOpacity>}
  </View>;
  return <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg || '#F5F9F9' }]}>
    <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg || '#F5F9F9'} />
    <View style={[styles.header, { borderBottomColor: border }]}>
      <TouchableOpacity accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.action}><Icon name="arrow-back" size={24} color={text} /></TouchableOpacity>
      <Text style={[styles.title, { color: text }]}>Contacts & Members</Text>
      <TouchableOpacity accessibilityLabel="Refresh contacts" onPress={() => contacts.reload()} disabled={locked} style={styles.action}><Icon name="refresh-outline" size={22} color={primary} /></TouchableOpacity>
    </View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={contacts.loading} onRefresh={() => contacts.reload()} tintColor={primary} />}>
        <View style={[styles.form, { backgroundColor: surface, borderColor: border }]}>
          <Text style={[styles.formTitle, { color: text }]}>ADD CONTACT BY PHONE NUMBER</Text>
          <TextInput testID="contact-phone" accessibilityLabel="Registered contact phone number" value={phone} onChangeText={setPhone}
            placeholder="PHONE NUMBER (Must be a registered user)" placeholderTextColor={muted} keyboardType="phone-pad"
            maxLength={32} editable={!locked} style={[styles.input, { color: text, borderColor: border }]} />
          <TextInput testID="contact-alias" accessibilityLabel="Contact alias or nickname" value={alias} onChangeText={setAlias}
            placeholder="ENTER NAME" placeholderTextColor={muted}
            maxLength={150} editable={!locked} style={[styles.input, { color: text, borderColor: border }]} />
          <TouchableOpacity testID="send-contact-request" accessibilityRole="button" disabled={locked || !phone.trim()} onPress={send}
            style={[styles.send, { backgroundColor: isDark ? '#0F766E' : primary, opacity: locked || !phone.trim() ? 0.6 : 1 }]}>
            {contacts.busy === 'send' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.sendText}>SEND CONTACT REQUEST</Text>}
          </TouchableOpacity>
          <Text style={[styles.hint, { color: muted }]}>New contacts appear in both contact lists only after acceptance. Your existing saved contacts are preserved.</Text>
        </View>
        <TouchableOpacity testID="create-new-group" disabled={locked} onPress={() => navigation.navigate('CreateGroup')} style={styles.groupLink}>
          <Icon name="people-outline" size={17} color={primary} /><Text style={[styles.groupText, { color: primary }]}>CREATE A NEW GROUP</Text>
        </TouchableOpacity>
        {contacts.feedback ? <View accessibilityRole="alert" style={[styles.feedback, { backgroundColor: isDark ? '#123D2C' : '#DCFCE7' }]}>
          <Text style={[styles.feedbackText, { color: isDark ? '#86EFAC' : '#166534' }]}>{contacts.feedback}</Text></View> : null}
        {contacts.error ? <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>{contacts.error}</Text>
          <TouchableOpacity onPress={() => contacts.reload()}><Text style={[styles.retry, { color: primary }]}>Retry</Text></TouchableOpacity></View> : null}
        <View style={[styles.tabs, { borderBottomColor: border }]}>
          <TouchableOpacity testID="my-contacts-tab" accessibilityRole="tab" accessibilityState={{ selected: tab === 'contacts' }} onPress={() => setTab('contacts')}
            style={[styles.tab, { borderBottomColor: tab === 'contacts' ? primary : 'transparent' }]}><Text style={[styles.tabText, { color: tab === 'contacts' ? primary : muted }]}>MY CONTACTS</Text></TouchableOpacity>
          <TouchableOpacity testID="pending-requests-tab" accessibilityRole="tab" accessibilityState={{ selected: tab === 'pending' }} onPress={() => setTab('pending')}
            style={[styles.tab, { borderBottomColor: tab === 'pending' ? primary : 'transparent' }]}><Text style={[styles.tabText, { color: tab === 'pending' ? primary : muted }]}>PENDING REQUESTS ({contacts.received.length + contacts.sent.length})</Text></TouchableOpacity>
        </View>
        {contacts.loading ? <ActivityIndicator color={primary} style={styles.spinner} /> : null}
        {tab === 'contacts' ? <>
          <TextInput accessibilityLabel="Search contacts" placeholder="Search contacts" placeholderTextColor={muted} value={search} onChangeText={setSearch}
            style={[styles.input, { color: text, borderColor: border, backgroundColor: surface }]} />
          {!contacts.loading && shown.length === 0 ? <Text style={[styles.empty, { color: muted }]}>{search ? 'No matching contacts.' : 'No contacts yet. Send a request above to connect.'}</Text> : null}
          {shown.map(person => <View key={person.id} testID={`accepted-contact-${person.id}`} style={[styles.row, { backgroundColor: surface, borderColor: border }]}>
            <View style={[styles.avatar, { backgroundColor: isDark ? '#164E4D' : '#D7F1F0' }]}><Text style={[styles.initial, { color: primary }]}>{String(person.name || '?').charAt(0).toUpperCase()}</Text></View>
            <View style={styles.person}><Text style={[styles.name, { color: text }]}>{person.name}</Text><Text style={[styles.phone, { color: muted }]}>{person.phone}</Text></View>
            <TouchableOpacity testID={`remove-contact-${person.id}`} disabled={locked} accessibilityLabel={`Remove ${person.name}`} onPress={() => remove(person)} style={styles.action}>
              <Icon name="trash-outline" size={21} color={locked ? muted : '#DC2626'} /></TouchableOpacity>
          </View>)}
        </> : <>
          <Text style={[styles.section, { color: text }]}>Received requests</Text>
          {contacts.received.map(request => requestRow(request, true))}
          {!contacts.loading && contacts.received.length === 0 ? <Text style={[styles.empty, { color: muted }]}>No received requests.</Text> : null}
          <Text style={[styles.section, { color: text }]}>Sent requests</Text>
          {contacts.sent.map(request => requestRow(request, false))}
          {!contacts.loading && contacts.sent.length === 0 ? <Text style={[styles.empty, { color: muted }]}>No sent requests.</Text> : null}
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
    <View style={[styles.footer, { backgroundColor: surface, borderTopColor: border }]}>{[
      ['HomeDashboard', 'home-outline', 'Home'], ['ContactScreen', 'people-outline', 'Contacts'],
      ['HistoryScreen', 'time-outline', 'History'], ['SettingScreen', 'settings-outline', 'Settings'],
    ].map(([screen, icon, label]) => <TouchableOpacity key={screen} onPress={() => navigation.navigate(screen)} style={styles.footerItem}>
      <Icon name={icon} size={21} color={screen === 'ContactScreen' ? primary : muted} /><Text style={[styles.footerText, { color: screen === 'ContactScreen' ? primary : muted }]}>{label}</Text>
    </TouchableOpacity>)}</View>
  </SafeAreaView>;
};
const styles = StyleSheet.create({
  screen: { flex: 1 }, flex: { flex: 1 }, header: { paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' }, content: { width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 16, paddingBottom: 30 },
  form: { borderWidth: 1, borderRadius: 14, padding: 16 }, formTitle: { fontWeight: '800', fontSize: 12, letterSpacing: 0.6, marginBottom: 14 },
  input: { minHeight: 47, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, fontSize: 13, marginBottom: 12 },
  send: { minHeight: 46, borderRadius: 24, justifyContent: 'center', alignItems: 'center' }, sendText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 }, hint: { fontSize: 11, lineHeight: 17, marginTop: 10 },
  groupLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 19 }, groupText: { textDecorationLine: 'underline', fontWeight: '700', fontSize: 12 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 17 }, tab: { flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 2 }, tabText: { fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 9, gap: 10 }, avatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  initial: { fontSize: 16, fontWeight: '700' }, person: { flex: 1 }, name: { fontWeight: '700', fontSize: 14 }, phone: { fontSize: 12, marginTop: 3 }, waiting: { fontSize: 11, marginTop: 6 },
  action: { padding: 7, minHeight: 42, minWidth: 40, justifyContent: 'center', alignItems: 'center' }, cancel: { fontSize: 12, fontWeight: '700' }, section: { fontWeight: '800', fontSize: 14, marginBottom: 12, marginTop: 8 },
  empty: { textAlign: 'center', fontSize: 13, paddingVertical: 24 }, feedback: { padding: 13, borderRadius: 9, marginBottom: 12 }, feedbackText: { fontSize: 12, lineHeight: 18 },
  errorBox: { padding: 12, borderRadius: 9, backgroundColor: '#FEF2F2', marginBottom: 12 }, error: { color: '#B91C1C', fontSize: 12, lineHeight: 18 }, retry: { fontWeight: '700', paddingTop: 10 }, spinner: { marginBottom: 14 },
  footer: { flexDirection: 'row', paddingVertical: 10, borderTopWidth: 1 }, footerItem: { flex: 1, alignItems: 'center', gap: 4 }, footerText: { fontSize: 10 },
});
export default ContactManager;
