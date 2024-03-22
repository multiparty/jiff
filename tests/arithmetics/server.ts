const express = require("express");
const app = express();
const server = require("http").Server(app);

app.use("../../dist", express.static("../../dist"));
app.use("../../lib/ext", express.static("../../lib/ext"));
app.use("/", express.static("/client"));

var port = 8112;

server.listen(port, function () {
  console.log("Listening on ", port);
});

const JIFFServer = require("../../lib/jiff-server.js");
const jiffServer = new JIFFServer(server, { logs: true });

console.log("server is running on port", port);
