// Read command line arguments
var input = parseInt(process.argv[2], 10);

var JIFFClient = require('../../lib/jiff-client.js');
var jiffClient = new JIFFClient('http://localhost:8080', 'web-mpc');

// Wait for server to connect
jiffClient.wait_for([1, 's1'], function () {
  console.log('Connected! ID: ' + jiffClient.id);
  jiffClient.share(input, 2, [1, 's1'], [ jiffClient.id ]);
  console.log('Shared input!');
  jiffClient.disconnect(true, true);
  console.log('Disconnected!');
});

