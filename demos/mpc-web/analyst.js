var jiff = require('../../lib/jiff-client');
var fs = require('fs');
var readline = require('readline');
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

var options = { party_id: 1, party_count: 100000 };
var keys = load_keys();
options.public_key = keys.public_key;
options.secret_key = keys.secret_key;
var jiff_instance = jiff.make_jiff('http://localhost:8080', '1', options);

// Wait for server to connect
jiff_instance.wait_for(['s1'], function () {
  save_keys();
  console.log('When enough parties submit enter a line');
  // begin computation on line enter
  rl.on('line', function (_) {
    // send begin signal
    jiff_instance.emit('begin', [ 's1' ], '');

    // receive number of parties from server
    jiff_instance.listen('number', function (_, party_count) {
      console.log('BEGIN: # of parties ' + party_count);

      // Computation starts
      var shares = {};
      for (var i = 2; i <= party_count; i++) {
        shares[i] = jiff_instance.share(null, 2, [1, 's1'], [ i ])[i];
      }

      var sum = shares[2];
      for (var p = 3; p <= party_count; p++) {
        sum = sum.sadd(shares[p]);
      }

      jiff_instance.open(sum, [1]).then(function (sum) {
        console.log('SUM IS: ' + sum);
      });
    });
  });
});

/* Handle storing and loading keys */
var KEYS_FILE = './keys.json';
function save_keys() {
  var public_key = '['+jiff_instance.public_key.toString()+']';
  var secret_key = '['+jiff_instance.secret_key.toString()+']';
  var obj = '{ "public_key": '+public_key+', "secret_key": '+secret_key+'}';
  fs.writeFile(KEYS_FILE, obj, function (err) {
    if (err) {
      console.log(err);
    }
  });
}

function load_keys() {
  try {
    var obj = require(KEYS_FILE);
    obj.secret_key = new Uint8Array(obj.secret_key);
    obj.public_key = new Uint8Array(obj.public_key);
    return obj;
  } catch (err) {
    //key file does not exist
    return { public_key: null, secret_key: null };
  }
}



