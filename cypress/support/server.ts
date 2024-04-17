let path = require('path');
let express = require('express');
let app = express();
let http = require('http').Server(app);
let JIFFServer = require('../../lib/jiff-server');
let jiff_instance = new JIFFServer(http, { logs: true });

// Serve static files.
app.use('/cypress', express.static(path.join(__dirname, '..', '..', 'cypress')));
app.use('/dist', express.static(path.join(__dirname, '..', '..', 'dist')));
app.use('/lib/ext', express.static(path.join(__dirname, '..', '..', 'lib', 'ext')));

let jiffWebsocketServer = require('../../lib/ext/jiff-server-websockets');
jiff_instance.apply_extension(jiffWebsocketServer);

http.listen(8080, function () {
  console.log('listening on *:8080');
});
