const DAY = 86400000;
const OFFSET = 8 * 3600000;

export function hkPeriodBounds(now = Date.now()) {
  const shifted = now + OFFSET;
  const today = Math.floor(shifted / DAY) * DAY - OFFSET;
  const weekday = new Date(shifted).getUTCDay();
  const week = today - ((weekday + 6) % 7) * DAY;
  return { today, tomorrow: today + DAY, week, nextWeek: week + 7 * DAY };
}

export function isArchivedTask(task, now = Date.now()) {
  if (!task.completed) return false;
  const finished = Number(task.completed_at ?? task.updated);
  return Number.isFinite(finished) && finished < hkPeriodBounds(now).week;
}

export function tasksForPeriod(tasks, period, now = Date.now()) {
  const bounds = hkPeriodBounds(now);
  return tasks.filter(task => {
    if (isArchivedTask(task, now) || task.due == null) return false;
    const due = Number(task.due);
    if (period === 'today') return due >= bounds.today && due < bounds.tomorrow;
    if (period === 'week') return due >= bounds.week && due < bounds.nextWeek;
    return due >= bounds.today;
  });
}

export function periodProgress(tasks, period, now = Date.now()) {
  const matching = tasksForPeriod(tasks, period, now);
  const done = matching.filter(task => task.completed).length;
  return { done, total: matching.length, percent: matching.length ? Math.round(done / matching.length * 100) : 0 };
}

export function nextHkMidnight(now = Date.now()) {
  return hkPeriodBounds(now).tomorrow;
}
