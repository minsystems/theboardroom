let sslRedirect = require("heroku-ssl-redirect");
let twilio = require("twilio")("AC3966345b4262d57c925ff3df21b1e640", "d7fde3319cf34d5c840a82f1894a8bfc");
const passport = require('passport');
const flash = require('express-flash');
const session = require('express-session');
const methodOverride = require('method-override');

const bcrypt = require('bcrypt');
let express = require("express");
let app = express();
const http = require("http").createServer(app);
let io = require("socket.io")(http);
let path = require("path");
let public = path.join(__dirname, "public");
const url = require("url");
const { v4: uuidV4 } = require('uuid');
const { ExpressPeerServer } = require('peer');
const peerServer = ExpressPeerServer(http, {debug: true});

// Session handler creator
function sessionCreator(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++ ) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// enable ssl redirect
app.use(sslRedirect());
app.use('/peerjs', peerServer);

app.use(express.urlencoded({extended: false}));
app.use(flash());
app.use(session({
  secret: sessionCreator(10),
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));

// set view engine
app.set('view-engine', 'ejs');

// Remove trailing slashes in url
app.use(function (req, res, next) {
  if (req.path.substr(-1) === "/" && req.path.length > 1) {
    let query = req.url.slice(req.path.length);
    res.redirect(301, req.path.slice(0, -1) + query);
  } else {
    next();
  }
});


app.get("/", function (req, res) {
  res.render(path.join(public, "landing.ejs"));
});

app.get("/login", function (req, res) {
  res.render(path.join(public, "login.ejs"));
});

app.post("/login", passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}));

app.get("/register", function (req, res) {
  res.render(path.join(public, "register.ejs"));
});

app.post("/register", async function (req, res) {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    users.push({
      id: Date.now().toString(),
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
    });
    res.redirect('/login');
  } catch (e) {
    console.log(e);
    res.redirect('/register');
  }
});

app.delete("/logout", function (req, res) {
  req.logOut();
  res.redirect('/login')
});

app.get("/meetings", function (req, res) {
  res.render(path.join(public, 'meeting.ejs'));
});

app.get("/meetings/conference", function (req, res) {
  res.redirect(`/meetings/${uuidV4()}`)
});

app.get('/meetings/:room', (req, res) => {
  res.render(path.join(public, "meeting-room.ejs"), {roomId: req.params.room})
});

app.get("/newcall", function (req, res) {
  res.render(path.join(public, "newcall.ejs"));
});

app.get("/join/", function (req, res) {
  res.redirect("/");
});

app.get("/join/*", function (req, res) {
  if (Object.keys(req.query).length > 0) {
    logIt("redirect:" + req.url + " to " + url.parse(req.url).pathname);
    res.redirect(url.parse(req.url).pathname);
  } else {
    res.render(path.join(public, "chat.ejs"));
  }
});

app.get("/notsupported", function (req, res) {
  res.render(path.join(public, "notsupported.ejs"));
});

app.get("/notsupportedios", function (req, res) {
  res.render(path.join(public, "notsupportedios.ejs"));
});

// Serve static files in the public directory
app.use(express.static("public"));

// Simple logging function to add room name
function logIt(msg, room) {
  if (room) {
    console.log(room + ": " + msg);
  } else {
    console.log(msg);
  }
}

// When a socket connects, set up the specific listeners we will use. change
io.on("connection", function (socket) {
  // When a client tries to join a room, only allow them if they are first or
  // second in the room. Otherwise it is full.

  socket.on("join", function (room) {
    logIt("A client joined the room", room);
    var clients = io.sockets.adapter.rooms[room];
    var numClients = typeof clients !== "undefined" ? clients.length : 0;
    if (numClients === 0) {
      socket.join(room);
    } else if (numClients === 1) {
      socket.join(room);
      // When the client is second to join the room, both clients are ready.
      logIt("Broadcasting ready message", room);
      // First to join call initiates call
      socket.broadcast.to(room).emit("willInitiateCall", room);
      socket.emit("ready", room).to(room);
      socket.broadcast.to(room).emit("ready", room);
    } else {
      logIt("room already full", room);
      socket.emit("full", room);
    }
  });

  // When someone tries to connect to our multi-conference room, trigger event listener
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).broadcast.emit('user-connected', userId);

    // messages
    socket.on('message', (message, userId) => {
      //send message to the same room
      io.to(roomId).emit('createMessage', message, userId)
    });

    socket.on('user-disconnected', () => {
      socket.to(roomId).broadcast.emit('user-disconnected', userId);
    });

    twilio.tokens.create(function (err, response) {
      if (err) {
        console.log(err, roomId);
      } else {
        console.log("Token generated. Returning it to the browser client: " + roomId);
        socket.emit("token-share", response).to(roomId);
      }
    }).then(r => console.log(r));

  });

  // When receiving the token message, use the Twilio REST API to request an
  // token to get ephemeral credentials to use the TURN server.
  socket.on("token", function (room) {
    logIt("Received token request", room);
    twilio.tokens.create(function (err, response) {
      if (err) {
        logIt(err, room);
      } else {
        logIt("Token generated. Returning it to the browser client", room);
        socket.emit("token", response).to(room);
      }
    });
  });

  // Relay candidate messages
  socket.on("candidate", function (candidate, room) {
    logIt("Received candidate. Broadcasting...", room);
    socket.broadcast.to(room).emit("candidate", candidate);
  });

  // Relay offers
  socket.on("offer", function (offer, room) {
    logIt("Received offer. Broadcasting...", room);
    socket.broadcast.to(room).emit("offer", offer);
  });

  // Relay answers
  socket.on("answer", function (answer, room) {
    logIt("Received answer. Broadcasting...", room);
    socket.broadcast.to(room).emit("answer", answer);
  });
});

// Listen for Heroku port, otherwise just use 3000
var port = process.env.PORT || 3000;
http.listen(port, function () {
  console.log("http://localhost:" + port);
});
