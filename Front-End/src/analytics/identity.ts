// Anonymous visitor + session ids for analytics. No personal data is stored.

const ANON_KEY = "ss-anon-id";
const SESSION_KEY = "ss-session";
const SESSION_IDLE_MS = 30 * 60 * 1000;

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

// In-memory fallbacks when storage is blocked (private mode, disabled cookies)
let memoryAnon: string | null = null;
let memorySession: { id: string; last: number } | null = null;

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable; memory fallback still works for this tab
  }
};

// Persistent per browser; also the unit for experiment assignment
export const getAnonId = () => {
  const stored = read(ANON_KEY) ?? memoryAnon;
  if (stored) return stored;
  const id = randomId();
  memoryAnon = id;
  write(ANON_KEY, id);
  return id;
};

// Rolls over after 30 minutes without activity
export const getSessionId = () => {
  const now = Date.now();
  let session = memorySession;
  try {
    session = JSON.parse(read(SESSION_KEY) || "null") ?? memorySession;
  } catch {
    // corrupt value; start a new session
  }
  if (!session || now - session.last > SESSION_IDLE_MS) session = { id: randomId(), last: now };
  session.last = now;
  memorySession = session;
  write(SESSION_KEY, JSON.stringify(session));
  return session.id;
};
