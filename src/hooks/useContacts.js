import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiClient } from '../utils/apiClient';

export const useContacts = () => {
  const [data, setData] = useState({ contacts: [], received: [], sent: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState('');
  const active = useRef(false);
  const mounted = useRef(true);
  const requestNumber = useRef(0);
  const controller = useRef(null);
  const operation = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const reload = useCallback(async (quiet = false) => {
    if (!active.current || (quiet && operation.current)) return;
    const number = ++requestNumber.current;
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    if (!quiet) setLoading(true);
    try {
      const [contacts, requests] = await Promise.all([
        apiClient('/User/contacts', { signal: next.signal }),
        apiClient('/User/contact-requests', { signal: next.signal }),
      ]);
      if (!contacts?.success || !Array.isArray(contacts.data) || !requests?.success ||
          !Array.isArray(requests.data?.received) || !Array.isArray(requests.data?.sent)) {
        throw new Error('Contact requests could not be loaded. Update the backend and apply the contact-request migration.');
      }
      if (active.current && number === requestNumber.current) {
        setData({ contacts: contacts.data, received: requests.data.received, sent: requests.data.sent });
        setError('');
      }
    } catch (failure) {
      if (active.current && number === requestNumber.current) setError(failure.message || 'Could not load contacts.');
    } finally {
      if (active.current && number === requestNumber.current) setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    active.current = true;
    reload();
    const timer = setInterval(() => { if (AppState.currentState === 'active') reload(true); }, 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') reload(true); });
    return () => { active.current = false; ++requestNumber.current; controller.current?.abort(); clearInterval(timer); subscription.remove(); };
  }, [reload]));
  const mutate = useCallback(async (key, endpoint, options) => {
    if (operation.current) return false;
    operation.current = true;
    setBusy(key); setFeedback('');
    try {
      const result = await apiClient(endpoint, options);
      if (!result?.success) throw new Error('The server did not confirm the change.');
      if (mounted.current) setFeedback(result.message || 'Contacts updated.');
      await reload();
      return mounted.current;
    } catch (failure) {
      // A lost response can still mean the operation committed; refresh before retrying.
      await reload();
      if (!mounted.current) return false;
      throw failure;
    } finally {
      operation.current = false;
      if (mounted.current) setBusy('');
    }
  }, [reload]);
  const send = useCallback(input => mutate('send', '/User/contact-requests', { method: 'POST', body: JSON.stringify(input) }), [mutate]);
  const respond = useCallback((request, action) => mutate(`${action}:${request.id}`,
    `/User/contact-requests/${request.id}/${action}`, { method: 'POST', body: JSON.stringify({ version: request.version }) }), [mutate]);
  const remove = useCallback(contact => mutate(`delete:${contact.id}`, `/User/contacts/${contact.id}`, { method: 'DELETE' }), [mutate]);
  return { ...data, loading, error, feedback, busy, reload, send, respond, remove };
};
