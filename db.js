const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dbPath = path.join(__dirname, "aimlog-data.json");

function load() {
  try {
    if (fs.existsSync(dbPath)) {
      const d = JSON.parse(fs.readFileSync(dbPath, "utf8"));
      d.users = d.users || [];
      d.authTokens = d.authTokens || {};
      d.practices = d.practices || [];
      d.competitions = d.competitions || [];
      return d;
    }
  } catch (e) {
    console.error("DB load:", e.message);
  }
  return { users: [], authTokens: {}, practices: [], competitions: [] };
}

function save(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ——— Auth ———

function register({ name, email, password }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanName = String(name || "").trim();
  if (cleanName.length < 2) throw new Error("Name must be at least 2 characters");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Enter a valid email");
  if (!password || String(password).length < 6) throw new Error("Password must be at least 6 characters");

  const data = load();
  if (data.users.some((u) => u.email === cleanEmail)) throw new Error("Email already registered");

  const salt = crypto.randomBytes(16).toString("hex");
  const user = {
    id: uid(),
    name: cleanName,
    email: cleanEmail,
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  const token = createToken();
  data.authTokens[token] = { userId: user.id, createdAt: Date.now() };
  save(data);
  return { token, user: publicUser(user) };
}

function login({ email, password }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const data = load();
  const user = data.users.find((u) => u.email === cleanEmail);
  if (!user) throw new Error("Invalid email or password");
  if (hashPassword(password, user.salt) !== user.passwordHash) {
    throw new Error("Invalid email or password");
  }
  const token = createToken();
  data.authTokens[token] = { userId: user.id, createdAt: Date.now() };
  save(data);
  return { token, user: publicUser(user) };
}

function logout(token) {
  if (!token) return;
  const data = load();
  delete data.authTokens[token];
  save(data);
}

function getUserFromToken(token) {
  if (!token) return null;
  const data = load();
  const entry = data.authTokens[token];
  if (!entry) return null;
  if (Date.now() - entry.createdAt > 30 * 24 * 60 * 60 * 1000) {
    delete data.authTokens[token];
    save(data);
    return null;
  }
  const user = data.users.find((u) => u.id === entry.userId);
  return user ? publicUser(user) : null;
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt };
}

function updateProfile(userId, { name }) {
  const data = load();
  const user = data.users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found");
  const cleanName = String(name || "").trim();
  if (cleanName.length < 2) throw new Error("Name must be at least 2 characters");
  user.name = cleanName;
  save(data);
  return publicUser(user);
}

// ——— Practice ———

function validateShots(shots) {
  if (!Array.isArray(shots) || shots.length === 0) {
    throw new Error("Add at least one shot");
  }
  const cleaned = [];
  for (let i = 0; i < shots.length; i++) {
    const n = Number(shots[i]);
    if (!Number.isFinite(n) || n < 0 || n > 10.9) {
      throw new Error(`Shot ${i + 1} must be between 0 and 10.9`);
    }
    cleaned.push(round1(n));
  }
  return cleaned;
}

function practiceStats(shots) {
  const totalShots = shots.length;
  const totalScore = round1(shots.reduce((a, b) => a + b, 0));
  const maxScore = round1(totalShots * 10);
  const average = totalShots ? round2(totalScore / totalShots) : 0;
  return { totalShots, totalScore, maxScore, average };
}

function listPractices(userId) {
  return load()
    .practices.filter((p) => p.userId === userId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .map(summaryPractice);
}

function getPractice(userId, id) {
  const p = load().practices.find((x) => x.id === id && x.userId === userId);
  return p || null;
}

function summaryPractice(p) {
  return {
    id: p.id,
    date: p.date,
    equipment: p.equipment,
    distance: p.distance,
    totalShots: p.totalShots,
    totalScore: p.totalScore,
    maxScore: p.maxScore,
    average: p.average,
    notes: p.notes,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function createPractice(userId, body) {
  const shots = validateShots(body.shots);
  const stats = practiceStats(shots);
  const data = load();
  const practice = {
    id: uid(),
    userId,
    date: body.date || new Date().toISOString().slice(0, 10),
    equipment: body.equipment ? String(body.equipment).trim() : null,
    distance: body.distance ? String(body.distance).trim() : null,
    notes: body.notes ? String(body.notes).trim() : null,
    shots,
    ...stats,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.practices.push(practice);
  save(data);
  return practice;
}

function updatePractice(userId, id, body) {
  const data = load();
  const idx = data.practices.findIndex((p) => p.id === id && p.userId === userId);
  if (idx < 0) return null;
  const shots = validateShots(body.shots);
  const stats = practiceStats(shots);
  const prev = data.practices[idx];
  data.practices[idx] = {
    ...prev,
    date: body.date || prev.date,
    equipment: body.equipment != null ? (String(body.equipment).trim() || null) : prev.equipment,
    distance: body.distance != null ? (String(body.distance).trim() || null) : prev.distance,
    notes: body.notes != null ? (String(body.notes).trim() || null) : prev.notes,
    shots,
    ...stats,
    updatedAt: new Date().toISOString(),
  };
  save(data);
  return data.practices[idx];
}

function deletePractice(userId, id) {
  const data = load();
  const before = data.practices.length;
  data.practices = data.practices.filter((p) => !(p.id === id && p.userId === userId));
  if (data.practices.length === before) return false;
  save(data);
  return true;
}

// ——— Competitions ———

function listCompetitions(userId) {
  return load()
    .competitions.filter((c) => c.userId === userId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function getCompetition(userId, id) {
  return load().competitions.find((c) => c.id === id && c.userId === userId) || null;
}

function createCompetition(userId, body) {
  const name = String(body.name || body.competitionName || "").trim();
  if (!name) throw new Error("Competition name is required");
  const totalShots = Number(body.totalShots);
  const totalScore = Number(body.totalScore);
  if (!Number.isFinite(totalShots) || totalShots < 1) throw new Error("Enter number of shots");
  if (!Number.isFinite(totalScore) || totalScore < 0) throw new Error("Enter a valid total score");
  const maxScore = round1(totalShots * 10);
  if (totalScore > maxScore + 0.05) throw new Error(`Total score cannot exceed max (${maxScore})`);
  const average = round2(totalScore / totalShots);
  const rank = body.rank != null && body.rank !== "" ? Number(body.rank) : null;
  if (rank != null && (!Number.isFinite(rank) || rank < 1)) throw new Error("Rank must be 1 or higher");

  const data = load();
  const competition = {
    id: uid(),
    userId,
    name,
    date: body.date || new Date().toISOString().slice(0, 10),
    totalShots: Math.floor(totalShots),
    totalScore: round1(totalScore),
    maxScore,
    average,
    rank,
    coachComments: body.coachComments ? String(body.coachComments).trim() : null,
    equipment: body.equipment ? String(body.equipment).trim() : null,
    distance: body.distance ? String(body.distance).trim() : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.competitions.push(competition);
  save(data);
  return competition;
}

function updateCompetition(userId, id, body) {
  const data = load();
  const idx = data.competitions.findIndex((c) => c.id === id && c.userId === userId);
  if (idx < 0) return null;
  const name = String(body.name || body.competitionName || "").trim();
  if (!name) throw new Error("Competition name is required");
  const totalShots = Number(body.totalShots);
  const totalScore = Number(body.totalScore);
  if (!Number.isFinite(totalShots) || totalShots < 1) throw new Error("Enter number of shots");
  if (!Number.isFinite(totalScore) || totalScore < 0) throw new Error("Enter a valid total score");
  const maxScore = round1(totalShots * 10);
  if (totalScore > maxScore + 0.05) throw new Error(`Total score cannot exceed max (${maxScore})`);
  const average = round2(totalScore / totalShots);
  const rank = body.rank != null && body.rank !== "" ? Number(body.rank) : null;
  if (rank != null && (!Number.isFinite(rank) || rank < 1)) throw new Error("Rank must be 1 or higher");

  const prev = data.competitions[idx];
  data.competitions[idx] = {
    ...prev,
    name,
    date: body.date || prev.date,
    totalShots: Math.floor(totalShots),
    totalScore: round1(totalScore),
    maxScore,
    average,
    rank,
    coachComments:
      body.coachComments != null ? (String(body.coachComments).trim() || null) : prev.coachComments,
    equipment: body.equipment != null ? (String(body.equipment).trim() || null) : prev.equipment,
    distance: body.distance != null ? (String(body.distance).trim() || null) : prev.distance,
    updatedAt: new Date().toISOString(),
  };
  save(data);
  return data.competitions[idx];
}

function deleteCompetition(userId, id) {
  const data = load();
  const before = data.competitions.length;
  data.competitions = data.competitions.filter((c) => !(c.id === id && c.userId === userId));
  if (data.competitions.length === before) return false;
  save(data);
  return true;
}

// ——— Dashboard & stats ———

function getDashboard(userId) {
  const practices = listPractices(userId);
  const competitions = listCompetitions(userId);

  const practiceAvgs = practices.map((p) => p.average);
  const compScores = competitions.map((c) => c.totalScore);
  const allScores = [
    ...practices.map((p) => p.totalScore),
    ...competitions.map((c) => c.totalScore),
  ];

  const byDate = {};
  for (const p of [...practices].reverse().slice(-30)) {
    if (!byDate[p.date]) byDate[p.date] = [];
    byDate[p.date].push(p.average);
  }
  const trend = Object.keys(byDate)
    .sort()
    .map((date) => ({
      date: date.slice(5),
      avg: round2(byDate[date].reduce((a, b) => a + b, 0) / byDate[date].length),
    }));

  const recent = [
    ...practices.slice(0, 5).map((p) => ({
      type: "practice",
      id: p.id,
      title: "Practice",
      date: p.date,
      score: p.totalScore,
      maxScore: p.maxScore,
      average: p.average,
      shots: p.totalShots,
    })),
    ...competitions.slice(0, 5).map((c) => ({
      type: "competition",
      id: c.id,
      title: c.name,
      date: c.date,
      score: c.totalScore,
      maxScore: c.maxScore,
      average: c.average,
      shots: c.totalShots,
      rank: c.rank,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return {
    totalPractices: practices.length,
    totalCompetitions: competitions.length,
    averageScore: practiceAvgs.length
      ? round2(practiceAvgs.reduce((a, b) => a + b, 0) / practiceAvgs.length)
      : null,
    bestScore: allScores.length ? Math.max(...allScores) : null,
    trend,
    recent,
  };
}

function getStatistics(userId) {
  const practices = listPractices(userId);
  const competitions = listCompetitions(userId);
  const totalShots = practices.reduce((a, p) => a + p.totalShots, 0);
  const practiceAvgs = practices.map((p) => p.average);
  const compAvgs = competitions.map((c) => c.average);
  const allTotals = [
    ...practices.map((p) => p.totalScore),
    ...competitions.map((c) => c.totalScore),
  ];
  const ranks = competitions.filter((c) => c.rank != null).map((c) => c.rank);

  const practiceTrend = [...practices]
    .reverse()
    .slice(-20)
    .map((p) => ({ date: p.date.slice(5), avg: p.average, score: p.totalScore }));
  const compTrend = [...competitions]
    .reverse()
    .slice(-20)
    .map((c) => ({ date: c.date.slice(5), avg: c.average, score: c.totalScore, rank: c.rank }));

  return {
    totalPractices: practices.length,
    totalCompetitions: competitions.length,
    totalShots,
    averagePracticeScore: practiceAvgs.length
      ? round2(practiceAvgs.reduce((a, b) => a + b, 0) / practiceAvgs.length)
      : null,
    averageCompetitionScore: compAvgs.length
      ? round2(compAvgs.reduce((a, b) => a + b, 0) / compAvgs.length)
      : null,
    highestScore: allTotals.length ? Math.max(...allTotals) : null,
    lowestScore: allTotals.length ? Math.min(...allTotals) : null,
    bestAverage: practiceAvgs.length ? Math.max(...practiceAvgs) : null,
    bestRank: ranks.length ? Math.min(...ranks) : null,
    ranks,
    practiceTrend,
    compTrend,
  };
}

module.exports = {
  register,
  login,
  logout,
  getUserFromToken,
  updateProfile,
  listPractices,
  getPractice,
  createPractice,
  updatePractice,
  deletePractice,
  listCompetitions,
  getCompetition,
  createCompetition,
  updateCompetition,
  deleteCompetition,
  getDashboard,
  getStatistics,
};
