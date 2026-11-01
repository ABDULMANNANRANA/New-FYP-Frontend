import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { apiClient } from '../utils/apiClient';
import { buildRecipientSections } from '../utils/taskRecipients';

export const useTaskRecipients = initialKey => {
  const focused = useIsFocused();
  const [selectedKey, setSelectedKey] = useState(initialKey || 'self');
  const [directory, setDirectory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!focused) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    (async () => {
      try {
        const response = await apiClient('/Managment/task-recipients', { signal: controller.signal });
        if (!response?.success || !Array.isArray(response?.data?.contacts) || !Array.isArray(response?.data?.groups)) {
          throw new Error('The task recipient list could not be loaded. Update and restart the backend.');
        }
        if (active) setDirectory(response.data);
      } catch (failure) {
        if (active) { setDirectory(null); setError(failure.message || 'Unable to load task recipients.'); }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [focused, revision]);
  const sections = useMemo(() => buildRecipientSections(directory), [directory]);
  const selected = useMemo(() => sections.flatMap(section => section.data)
    .find(item => item.key === selectedKey) || null, [sections, selectedKey]);
  return { selectedKey, setSelectedKey, selected, sections, loading, error, reload,
    currentUserId: directory?.currentUserId, ready: !loading && !error && !!directory && !!selected };
};
