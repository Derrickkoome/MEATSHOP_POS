// server.js
const express = require("express");
const path = require("path");
const jsonServer = require("json-server");

const app = express();
const PORT = process.env.PORT || 3000;

// Setup json-server router and middleware
const router = jsonServer.router(path.join(__dirname, "db.json"));
const middlewares = jsonServer.defaults({
  // serve json-server logger, static, cors, etc.
  logger: true,
});

app.use("/api", middlewares, jsonServer.bodyParser, router);

// Serve static frontend files (index.html, style.css, script.js, images/)
app.use(express.static(path.join(__dirname, "/")));

// For SPA - any non-API route serves index.html
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).send("API route");
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
