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
const users = new Map();

// ===== MIDDLEWARE =====
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(__dirname));

// ===== LOGIN SYSTEM =====
app.post('/signup', (req,res)=>{
  const {username,password}=req.body;
  if(!username||!password) return res.json({error:'need username password'});
  if(users.has(username)) return res.json({error:'user already exists'});
  users.set(username,{username,password});
  console.log('SIGNUP:',username);
  return res.json({success:true,message:'account created! now login'});
});

app.post('/login', (req,res)=>{
  const {username,password}=req.body;
  const u=users.get(username);
  if(!u||u.password!==password) return res.json({error:'wrong username or password'});
  console.log('LOGIN:',username);
  return res.json({success:true,message:'welcome '+username});
});

app.get('/users', (req,res)=>{
  res.json([...users.keys()]);
});

// ===== SOCKET IO =====
io.on("connection", (socket) => {
  console.log("player connected:", socket.id);

  socket.on("player:joined", (data = {}) => {
    const player = {
      id: socket.id,
      name: String(data.name || "Player").slice(0,20),
      x: Number(data.x) || 0,
      y: Number(data.y) || 0,
      z: Number(data.z) || 0,
      heading: 0,
      updatedAt: Date.now()
    };
    players.set(socket.id, player);
    socket.emit("players:list", [...players.values()]);
    socket.broadcast.emit("player:joined", player);
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
    const message = String(data.message || "").slice(0,200);
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
    console.log("player left:", socket.id);
  });
});

// ===== START SERVER =====
server.listen(PORT, "0.0.0.0", () => {
  console.log('VIBING RP KCM server listening on '+PORT);
});
