const http = require("http");
const fs = require("fs");
const path = require("path");
const db = require("./db");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(body);
}

function sendNoContent(res) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function getToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return null;
}

function requireUser(req, res) {
  const user = db.getUserFromToken(getToken(req));
  if (!user) {
    sendJson(res, 401, { error: "Please sign in" });
    return null;
  }
  return user;
}

function serveStatic(req, res) {
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(PUBLIC, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ""));
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC, "index.html"), (err2, html) => {
        if (err2) {
          res.writeHead(404);
          return res.end("Not found");
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end();
  }

  const url = req.url.split("?")[0];

  try {
    // Auth (public)
    if (req.method === "POST" && url === "/api/auth/register") {
      try {
        return sendJson(res, 201, db.register(await readBody(req)));
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    }
    if (req.method === "POST" && url === "/api/auth/login") {
      try {
        return sendJson(res, 200, db.login(await readBody(req)));
      } catch (e) {
        return sendJson(res, 401, { error: e.message });
      }
    }
    if (req.method === "POST" && url === "/api/auth/logout") {
      db.logout(getToken(req));
      return sendNoContent(res);
    }
    if (req.method === "GET" && url === "/api/auth/me") {
      const user = db.getUserFromToken(getToken(req));
      if (!user) return sendJson(res, 401, { error: "Not signed in" });
      return sendJson(res, 200, { user });
    }

    if (!url.startsWith("/api/")) return serveStatic(req, res);

    const user = requireUser(req, res);
    if (!user) return;

    // Profile
    if (req.method === "PUT" && url === "/api/profile") {
      try {
        return sendJson(res, 200, { user: db.updateProfile(user.id, await readBody(req)) });
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    }

    // Dashboard / stats
    if (req.method === "GET" && url === "/api/dashboard") {
      return sendJson(res, 200, db.getDashboard(user.id));
    }
    if (req.method === "GET" && url === "/api/statistics") {
      return sendJson(res, 200, db.getStatistics(user.id));
    }

    // Practices
    if (req.method === "GET" && url === "/api/practices") {
      return sendJson(res, 200, db.listPractices(user.id));
    }
    if (req.method === "GET" && url.startsWith("/api/practices/")) {
      const id = decodeURIComponent(url.slice("/api/practices/".length));
      const p = db.getPractice(user.id, id);
      if (!p) return sendJson(res, 404, { error: "Practice not found" });
      return sendJson(res, 200, p);
    }
    if (req.method === "POST" && url === "/api/practices") {
      try {
        return sendJson(res, 201, db.createPractice(user.id, await readBody(req)));
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    }
    if (req.method === "PUT" && url.startsWith("/api/practices/")) {
      const id = decodeURIComponent(url.slice("/api/practices/".length));
      try {
        const p = db.updatePractice(user.id, id, await readBody(req));
        if (!p) return sendJson(res, 404, { error: "Practice not found" });
        return sendJson(res, 200, p);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    }
    if (req.method === "DELETE" && url.startsWith("/api/practices/")) {
      const id = decodeURIComponent(url.slice("/api/practices/".length));
      if (!db.deletePractice(user.id, id)) return sendJson(res, 404, { error: "Practice not found" });
      return sendNoContent(res);
    }

    // Competitions
    if (req.method === "GET" && url === "/api/competitions") {
      return sendJson(res, 200, db.listCompetitions(user.id));
    }
    if (req.method === "GET" && url.startsWith("/api/competitions/")) {
      const id = decodeURIComponent(url.slice("/api/competitions/".length));
      const c = db.getCompetition(user.id, id);
      if (!c) return sendJson(res, 404, { error: "Competition not found" });
      return sendJson(res, 200, c);
    }
    if (req.method === "POST" && url === "/api/competitions") {
      try {
        return sendJson(res, 201, db.createCompetition(user.id, await readBody(req)));
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    }
    if (req.method === "PUT" && url.startsWith("/api/competitions/")) {
      const id = decodeURIComponent(url.slice("/api/competitions/".length));
      try {
        const c = db.updateCompetition(user.id, id, await readBody(req));
        if (!c) return sendJson(res, 404, { error: "Competition not found" });
        return sendJson(res, 200, c);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    }
    if (req.method === "DELETE" && url.startsWith("/api/competitions/")) {
      const id = decodeURIComponent(url.slice("/api/competitions/".length));
      if (!db.deleteCompetition(user.id, id)) {
        return sendJson(res, 404, { error: "Competition not found" });
      }
      return sendNoContent(res);
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: "Something went wrong. Please try again." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("AimLog running at http://localhost:" + PORT);
});
