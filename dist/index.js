"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var debug_1 = __importDefault(require("debug"));
var express_1 = __importDefault(require("express"));
var http_1 = __importDefault(require("http"));
var socket_io_1 = __importDefault(require("socket.io"));
var serverDebug = debug_1.default("server");
var ioDebug = debug_1.default("io");
var socketDebug = debug_1.default("socket");
require("dotenv").config(process.env.NODE_ENV !== "development"
    ? { path: ".env.production" }
    : { path: ".env.development" });
var app = express_1.default();
var port = process.env.PORT || 80; // default port to listen
app.use(express_1.default.static("public"));
app.get("/", function (req, res) {
    res.send("Excalidraw collaboration server is up :)");
});
var server = http_1.default.createServer(app);
server.listen(port, function () {
    serverDebug("listening on port: " + port);
});
var io = socket_io_1.default(server, {
    handlePreflightRequest: function (req, res) {
        var headers = {
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Origin": (req.header && req.header.origin) || "https://excalidraw.com",
            "Access-Control-Allow-Credentials": true,
        };
        res.writeHead(200, headers);
        res.end();
    },
});
io.on("connection", function (socket) {
    ioDebug("connection established!");
    io.to("" + socket.id).emit("init-room");
    socket.on("join-room", function (roomID) {
        socketDebug(socket.id + " has joined " + roomID);
        socket.join(roomID);
        if (io.sockets.adapter.rooms[roomID].length <= 1) {
            io.to("" + socket.id).emit("first-in-room");
        }
        else {
            socket.broadcast.to(roomID).emit("new-user", socket.id);
        }
        io.in(roomID).emit("room-user-change", Object.keys(io.sockets.adapter.rooms[roomID].sockets));
    });
    socket.on("server-broadcast", function (roomID, encryptedData, iv) {
        socketDebug(socket.id + " sends update to " + roomID);
        socket.broadcast.to(roomID).emit("client-broadcast", encryptedData, iv);
    });
    socket.on("server-volatile-broadcast", function (roomID, encryptedData, iv) {
        socketDebug(socket.id + " sends volatile update to " + roomID);
        socket.volatile.broadcast
            .to(roomID)
            .emit("client-broadcast", encryptedData, iv);
    });
    socket.on("disconnecting", function () {
        var rooms = io.sockets.adapter.rooms;
        for (var roomID in socket.rooms) {
            var clients = Object.keys(rooms[roomID].sockets).filter(function (id) { return id !== socket.id; });
            if (clients.length > 0) {
                socket.broadcast.to(roomID).emit("room-user-change", clients);
            }
        }
    });
    socket.on("disconnect", function () {
        socket.removeAllListeners();
    });
});
