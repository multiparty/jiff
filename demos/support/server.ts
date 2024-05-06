const path = require('path');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const JIFFServer = require('../../lib/jiff-server');
const jiff_instance = new JIFFServer(http, { logs: true });

// Serve static files.
app.use('/demos', express.static(path.join(__dirname, '..', '..', 'demos')));
app.use('/dist', express.static(path.join(__dirname, '..', '..', 'dist')));
app.use('/lib/ext', express.static(path.join(__dirname, '..', '..', 'lib', 'ext')));

const jiffWebsocketServer = require('../../lib/ext/jiff-server-websockets');
jiff_instance.apply_extension(jiffWebsocketServer);

http.listen(8080, function () {
  console.log('listening on *:8080');
});
