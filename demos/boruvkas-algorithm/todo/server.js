const express = require('express');
const app = express();
const http = require('http').Server(app);
const jiff_instance = require('../../lib/jiff-server').make_jiff(http, {logs:true});


// Serve static files.
app.use("/demos", express.static("demos"));
app.use("/lib", express.static("lib"));
app.use("/lib/ext", express.static("lib/ext"));
http.listen(8000, function() {
    console.log("Direct your browser to *:8000/demos/boruvkas-algorithm/index.html");
});