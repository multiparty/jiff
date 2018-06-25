var jiff_instance;
var jiff = require('../../lib/jiff-client');
let config = require('./config.json');

var options = {party_count: config.lower + config.upper, autoConnect: false, Zp: "2425967623052370772757633156976982469681"};
options.onConnect = function() {

  // Generate a random value between 0 and 19 inclusive.
  var value = Math.floor(Math.random() * 20);
  console.log("Value is: " + value);

  // The upper and lower party ids.
  var uppers = Array.from({length: config.upper}, (x,i) => i + config.lower + 1);
  var lowers = Array.from({length: config.lower}, (x,i) => i + 1);

  // Share lower party inputs with upper parties.
  // Value: random.
  // Threshold for reconstruction: # of upper parties.
  // Receivers: upper parties.
  // Senders: lower parties.
  jiff_instance.share(value, config.upper, uppers, lowers);

  // Disconnect the party.
  Promise.all([]).then(jiff_instance.disconnect);
}

jiff_instance = jiff.make_jiff("http://localhost:8080", 'test-threshold', options);
jiff_instance = require('../../lib/ext/jiff-client-bignumber').make_jiff(jiff_instance, options)
jiff_instance.connect();
