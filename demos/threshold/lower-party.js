var jiff_instance;
var jiff = require('../../lib/jiff-client');
var bignum = require('../../lib/ext/jiff-client-bignumber');
let config = require('./config.json');

var options = {
  party_count: config.lower + config.upper,
  Zp: "1208925819614629174706111",
  autoConnect: false
};
options.onConnect = function() {

  // Generate a random value between 0 and 19 inclusive. This is the input on the command line.
  var value = Math.floor(Math.random() * 20);
  console.log("Value is: " + value);

  // The upper and lower party ids. This will be fixed when the user enters the party id on the command line!
  var uppers = Array.from({length: config.upper}, (x,i) => i + config.lower + 1);
  var lowers = Array.from({length: config.lower}, (x,i) => i + 1);

  // Share lower party inputs with upper parties.
  // Value: random.
  // Threshold for reconstruction: # of upper parties.
  // Receivers: upper parties.
  // Senders: lower parties.
  // This is what I need to figure out how to incorporate into the template!!
  jiff_instance.share(value, config.upper, uppers, lowers);

  // Disconnect the party.
  Promise.all([]).then(jiff_instance.disconnect);
}

base_instance = jiff.make_jiff("http://localhost:8080", 'test-threshold', options);
jiff_instance = bignum.make_jiff(base_instance, options);
jiff_instance.connect();
