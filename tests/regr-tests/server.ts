function init_server(port: number, extensions: any[] = []) {
  const express = require('express');
  const app = express();
  const server = require('http').Server(app);

  app.use('../../dist', express.static('../../dist'));
  app.use('../../lib/ext', express.static('../../lib/ext'));
  app.use('/', express.static('../../lib/client'));

  server.listen(port, function () {
    console.log('Listening on ', port);
  });

  const JIFFServer = require('../../lib/jiff-server.js');
  const jiffServer = new JIFFServer(server, { logs: true });
  for (var ext of extensions) {
    jiffServer.apply_extension(ext);
  }

  console.log('server is running on port', port);
  return [jiffServer, server];
}

module.exports = init_server;
