const WebSocket = require('ws');

const ws = new WebSocket('http://localhost:8080');

ws.on('open', function open() {
  console.log("Connected");
  let message = JSON.stringify({ socketProtocol: "initialization", data: { computation_id: 1, party_id: 1, party_count: 1, public_key: 234 } });
  ws.send(message);
});

ws.on('message', function incoming(data) {
  console.log(data);
});
