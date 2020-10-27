const WebSocket = require('isomorphic-ws')

const ws = new WebSocket.Server({ port: 8080 });

ws.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    console.log('received2: %s', message);
  });

  ws.send('You have connected!');
});


// ws.onopen = function open() {
//   console.log('connected');
//   ws.send('Connecting to you...');
// };

// ws.onclose = function close() {
//   console.log('disconnected');
// };

ws.onmessage = function incoming(message) {
  console.log(`Received2: ` + message.data);
};
