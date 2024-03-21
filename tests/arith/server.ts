const express = require("express")
const app = express()
const server = require("http").Server(app)
const port = 8080

var JIFFServer = require("../../lib/jiff-server.js");
var jiff_bignumber = require("../../lib/ext/jiff-server-bignumber.js")

app.use("../../dist", express.static("../../dist"));
app.use("../../lib/ext", express.static("../../lib/ext"));
app.use("/", express.static("/client"));


server.listen(port, function () {
    console.log("listening on: ", port);
});


const jiffServer = new JIFFServer(server, { logs: true });
jiffServer.apply_extension(jiff_bignumber);
