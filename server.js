const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;
const players = new Map();

// ===== MIDDLEWARE =====
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(__dirname));

// ===== ADS.TXT FOR ADSENSE =====
app.get("/ads.txt", (_req, res) => {
  res.type("text/plain");
  res.send("google.com, pub-5432698430900280, DIRECT, f08c47fec0942fa0");
});

// ===== HEALTH CHECK =====
app.get("/health", (_req, res) => res.json({ ok: true, game: "VIBING RP KCM" }));

// ===== SIGNUP / LOGIN SYSTEM =====
let users = [];
const usersFile = path.join(__dirname, "users.json");

if (fs.existsSync(usersFile)) {
  try {
    users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
  } catch (e) {
    users = [];
  }
}

function saveUsers() {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

app.post("/signup", (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: "Username already taken" });
  }
  const newUser = {
    id: Date.now(),
    username,
    email: email || "",
    password,
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  saveUsers();
  res.json({ success: true, message: "Signup successful!", user: { username, id: newUser.id } });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(400).json({ error: "Invalid username or password" });
  }
  res.json({ success: true, message: "Login successful!", user: { username: user.username, id: user.id } });
});

app.get("/api/users", (_req, res) => {
  res.json(users.map(u => ({ username: u.username, id: u.id })));
});

// ===== SOCKET.IO MULTIPLAYER (YOUR ORIGINAL CODE) =====
io.on("connection", (socket) => {
  socket.emit("players:current", Array.from(players.values()));

  socket.on("player:join", (data = {}) => {
    const player = {
      id: socket.id,
      name: String(data.name || "Player").slice(0, 24),
      x: Number.isFinite(data.x) ? data.x : 0,
      y: Number.isFinite(data.y) ? data.y : 0,
      z: Number.isFinite(data.z) ? data.z : 0,
      heading: Number.isFinite(data.heading) ? data.heading : 0,
      updatedAt: Date.now()
    };
    players.set(socket.id, player);
    socket.broadcast.emit("player:joined", player);
    socket.emit("player:ready", { id: socket.id });
  });

  socket.on("player:update", (data = {}) => {
    const old = players.get(socket.id);
    if (!old) return;
    const next = {
      ...old,
      x: Number.isFinite(data.x) ? data.x : old.x,
      y: Number.isFinite(data.y) ? data.y : old.y,
      z: Number.isFinite(data.z) ? data.z : old.z,
      heading: Number.isFinite(data.heading) ? data.heading : old.heading,
      updatedAt: Date.now()
    };
    players.set(socket.id, next);
    socket.broadcast.emit("player:updated", next);
  });

  socket.on("chat:message", (data = {}) => {
    const player = players.get(socket.id);
    const message = String(data.message || "").trim().slice(0, 200);
    if (!message || !player) return;
    io.emit("chat:message", {
      id: socket.id,
      name: player.name,
      message,
      time: new Date().toISOString()
    });
  });

  socket.on("disconnect", () => {
    players.delete(socket.id);
    socket.broadcast.emit("player:left", { id: socket.id });
  });
});

// ===== START SERVER =====
server.listen(PORT, "0.0.0.0", () => {
  console.log(`VIBING RP KCM server listening on port ${PORT}`);
});