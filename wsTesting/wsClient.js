const WebSocket = require('ws');

const ws = new WebSocket('http://localhost:8080');

ws.on('open', function open() {
  ws.send('You\'ve been connected to');
});

ws.on('message', function incoming(data) {
  console.log(data);
});
