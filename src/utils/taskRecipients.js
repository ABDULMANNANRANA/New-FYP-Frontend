import { dateOnlyString } from './taskDates';
import { taskCoordinates, taskRadiusMeters } from '../services/location';

const positiveId = value => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
export const initialRecipientKey = params => {
  const explicit = params?.draft?.recipientKey ?? params?.recipientKey;
  if (explicit !== undefined && explicit !== null) return String(explicit);
  const groupId = positiveId(params?.groupId);
  return groupId ? `group:${groupId}` : 'self';
};
export const buildRecipientSections = data => {
  const seenContacts = new Set();
  const seenGroups = new Set();
  const contacts = (Array.isArray(data?.contacts) ? data.contacts : []).flatMap(contact => {
    const userId = positiveId(contact.userId);
    if (!userId || userId === positiveId(data?.currentUserId) || seenContacts.has(userId)) return [];
    seenContacts.add(userId);
    const name = String(contact.name || 'Registered contact').trim();
    const phone = String(contact.phone || '').trim();
    return [{ key: `contact:${userId}`, type: 'contact', userId, name, phone,
      label: phone ? `${name} - ${phone}` : name }];
  }).sort((a, b) => a.name.localeCompare(b.name));
  const groups = (Array.isArray(data?.groups) ? data.groups : []).flatMap(group => {
    const groupId = positiveId(group.groupId);
    if (!groupId || seenGroups.has(groupId)) return [];
    seenGroups.add(groupId);
    const name = String(group.name || 'Group').trim();
    return [{ key: `group:${groupId}`, type: 'group', groupId, name, label: name }];
  }).sort((a, b) => a.name.localeCompare(b.name));
  return [
    { title: '', data: [{ key: 'self', type: 'self', label: 'Myself (personal task)', name: 'Myself' }] },
    { title: 'Contacts', data: contacts },
    { title: 'Groups', data: groups },
  ];
};
export const createTaskPayload = ({ mode, locationSchedule, title, description, date,
  recipient, geofence, mentionedUserIds = [] }) => {
  if (!recipient || !['self', 'contact', 'group'].includes(recipient.type)) {
    throw new Error('Please choose an available task recipient.');
  }
  if (recipient.type === 'contact' && !positiveId(recipient.userId)) throw new Error('Invalid contact.');
  if (recipient.type === 'group' && !positiveId(recipient.groupId)) throw new Error('Invalid group.');
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error('Please choose a valid date.');
  if (mode === 'location' && !['time', 'non'].includes(locationSchedule)) {
    throw new Error('Choose Time Based or Non Time Based for this location task.');
  }
  const coordinates = mode === 'location' ? taskCoordinates(geofence) : null;
  if (mode === 'location' && !coordinates) throw new Error('Choose a reminder place on the map or use your current location.');
  const isTimeBased = mode === 'time' || (mode === 'location' && locationSchedule === 'time');
  return {
    title: title.trim(), description: description.trim(),
    dueDate: dateOnlyString(date),
    dueTime: isTimeBased ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00` : null,
    isTimeBased,
    groupId: recipient.type === 'group' ? recipient.groupId : null,
    assignedTo: recipient.type === 'contact' ? recipient.userId : null,
    mentionedUserIds: recipient.type === 'group' ? [...new Set(mentionedUserIds.map(positiveId).filter(Boolean))] : [],
    latitude: coordinates?.latitude ?? null, longitude: coordinates?.longitude ?? null,
    geofenceEnabled: mode === 'location' && geofence?.geofenceEnabled !== false,
    geofenceRadiusMeters: taskRadiusMeters(geofence),
  };
};
