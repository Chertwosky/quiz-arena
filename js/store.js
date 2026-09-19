import { createDemoPack } from "./defaults.js";
import seedPacks from "./seed-packs.js";

const PACKS_KEY = "quiz-arena:packs";
const SESSION_KEY = "quiz-arena:session";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function ensurePacks() {
  const packs = read(PACKS_KEY, null);
  if (!packs || !packs.length) {
    const seeded = Array.isArray(seedPacks) && seedPacks.length ? structuredClone(seedPacks) : [createDemoPack()];
    write(PACKS_KEY, seeded);
    return seeded;
  }
  return packs;
}

export function getPacks() {
  return ensurePacks();
}

export function getPack(id) {
  return getPacks().find((pack) => pack.id === id) || null;
}

export function savePack(pack) {
  const packs = getPacks();
  const index = packs.findIndex((item) => item.id === pack.id);
  if (index >= 0) packs[index] = pack;
  else packs.unshift(pack);
  write(PACKS_KEY, packs);
  return pack;
}

export function deletePack(id) {
  write(
    PACKS_KEY,
    getPacks().filter((pack) => pack.id !== id)
  );
}

export function appendScoreLog(session, teamId, delta, reason) {
  session.scoreLog = session.scoreLog || [];
  session.scoreLog.push({
    at: Date.now(),
    teamId,
    delta,
    reason: reason || "host",
  });
}

export function importPack(pack) {
  const copy = structuredClone(pack);
  copy.id = copy.id || crypto.randomUUID();
  copy.createdAt = Date.now();
  return savePack(copy);
}

export function getSession() {
  return read(SESSION_KEY, null);
}

export function saveSession(session) {
  write(SESSION_KEY, session);
  return session;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function createSession(packId) {
  const session = {
    packId,
    teams: [],
    answered: {},
    pickerTeamId: null,
    phase: "teams",
    round: null,
  };
  return saveSession(session);
}

export function resetAnswers(session) {
  session.answered = {};
  session.round = null;
  session.phase = "board";
  session.scoreLog = [];
  (session.teams || []).forEach((team) => {
    team.score = 0;
  });
  session.pickerTeamId = session.teams[0]?.id || session.pickerTeamId;
  return saveSession(session);
}
