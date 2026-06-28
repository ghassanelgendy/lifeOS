export function getWeeklyWrapKey(d: Date): string {
  const target = new Date(d.getTime());
  const day = target.getDay();
  if (day === 0) {
    target.setDate(target.getDate() - 1); // Sunday -> Saturday
  }
  return `${target.getFullYear()}-${(target.getMonth() + 1).toString().padStart(2, '0')}-${target.getDate().toString().padStart(2, '0')}`;
}

export function getMonthlyWrapKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function checkWrapStatus(now: Date = new Date()) {
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Saturday (6) or Sunday (0)
  const isWeeklyWrapDay = dayOfWeek === 6 || dayOfWeek === 0;
  // Last 3 days of month (e.g. 28, 29, 30 in a 30-day month)
  const isMonthlyWrapDay = dayOfMonth >= lastDayOfMonth - 2;

  const weeklyWrapKey = getWeeklyWrapKey(now);
  const monthlyWrapKey = getMonthlyWrapKey(now);

  return {
    isWeeklyWrapDay,
    isMonthlyWrapDay,
    weeklyWrapKey,
    monthlyWrapKey,
  };
}
