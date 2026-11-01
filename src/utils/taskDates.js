// API dates are local wall-clock calendar values, not UTC instants.
export const dateOnlyString = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const parseTaskDate = (dateValue, timeValue) => {
  const datePart = String(dateValue || '').slice(0, 10);
  const timePart = String(timeValue || '00:00:00').slice(0, 8);
  const parsed = new Date(`${datePart}T${timePart.length === 5 ? `${timePart}:00` : timePart}`);
  return parsed;
};
