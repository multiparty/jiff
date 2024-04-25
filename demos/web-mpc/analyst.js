// Dependencies
var path = require('path');
var fs = require('fs');
var readline = require('readline');

var JIFFClient = require('../../lib/jiff-client.js');
var mpc = require('./mpc.js');

// Handle storing and loading keys
var KEYS_FILE = 'keys.json';
function save_keys() {
  var public_key = '['+jiffClient.public_key.toString()+']';
  var secret_key = '['+jiffClient.secret_key.toString()+']';
  var obj = '{ "public_key": ' + public_key + ', "secret_key": ' + secret_key + '}';
  fs.writeFileSync(path.join(__dirname, KEYS_FILE), obj);
}
function load_keys() {
  try {
    var obj = require('./' + KEYS_FILE);
    obj.secret_key = new Uint8Array(obj.secret_key);
    obj.public_key = new Uint8Array(obj.public_key);
    return obj;
  } catch (err) {
    // key file does not exist
    return { public_key: null, secret_key: null };
  }
}

// For reading actions from the command line
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Options for creating the jiff instance
var options = {
  crypto_provider: true, // do not bother with preprocessing for this demo
  party_id: 1, // we are the analyst => we want party_id = 1
  socketOptions: {
    reconnectionDelay: 3000,
    reconnectionDelayMax: 4000
  }
};

// Load the keys in case they were previously saved (otherwise we get back nulls)
var keys = load_keys();
options.public_key = keys.public_key;
options.secret_key = keys.secret_key;

// Create the instance
var jiffClient = new JIFFClient('http://localhost:8080', 'web-mpc', options);

// Wait for server to connect
jiffClient.wait_for(['s1'], function () {
  save_keys(); // save the keys in case we need them again in the future

  // Wait for user input
  console.log('Computation initialized!');
  console.log('Hit enter when you decide it is time to compute!');
  rl.on('line', function (_) {
    // Send begin signal
    jiffClient.emit('begin', [ 's1' ], '');

    // Receive number of parties from server
    jiffClient.listen('number', function (_, party_count) {
      // Computation starts
      party_count = parseInt(party_count);
      console.log('BEGIN: # of parties ' + party_count);

      mpc(jiffClient, party_count).then(function (sum) {
        console.log('SUM IS: ' + sum);
        jiffClient.disconnect(true, true);
        rl.close();
      });
    });
  });
});