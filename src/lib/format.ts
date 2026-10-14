export function formatTime(h: number, m: number) {
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${m < 10 ? "0" : ""}${m} ${ap}`;
}
