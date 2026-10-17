const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;
const players = new Map();

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, game: "VIBING RP KCM", players: players.size }));

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
    const message = String(data.message || "").trim().slice(0, 300);
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`VIBING RP KCM server listening on port ${PORT}`);
});
