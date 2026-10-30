// Day streaks: a day counts once you solve LABS_PER_DAY labs or topology tasks in it while logged in.
// Kept in Supabase user_metadata as {streak, best, last_day, solves, solves_day}; auth.js saves it.

const LABS_PER_DAY = 3;

const dayKey = (d = new Date()) => d.toLocaleDateString('en-CA'); // local date as YYYY-MM-DD

function dayBefore(day) {
  const d = new Date(day + 'T12:00'); // midday, so DST changes can't skip a day
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

// today's solve count so far
const solvesToday = (meta, today) => meta.solves_day === today ? meta.solves || 0 : 0;

// the fields to save after one more solve on `today`; the streak moves on the LABS_PER_DAY-th solve
function nextStreak(meta, today) {
  const solves = solvesToday(meta, today) + 1;
  const out = { solves, solves_day: today };
  if (solves < LABS_PER_DAY || meta.last_day === today) return out;
  const streak = meta.last_day === dayBefore(today) ? (meta.streak || 0) + 1 : 1;
  return { ...out, streak, best: Math.max(streak, meta.best || 0), last_day: today };
}

// the streak still running on `today`: solved today or yesterday, otherwise 0
const liveStreak = (meta, today) =>
  meta.last_day === today || meta.last_day === dayBefore(today) ? meta.streak || 0 : 0;
