var jiff_instance;
var jiff = require('../../lib/jiff-client');
let config = require('./config.json');

var options = {party_count: config.lower + config.upper, autoConnect: false};
options.onConnect = function() {

  // Benchmark id.
  var id = Math.floor(Math.random() * 100000);

  // The upper and lower party ids.
  var uppers = Array.from({length: config.upper}, (x,i) => i + config.lower + 1);
  var lowers = Array.from({length: config.lower}, (x,i) => i + 1);

  // Receive the lower party shares.
  var shares = jiff_instance.share(null, config.upper, uppers, lowers);
//  console.time("computation time " + id);

  // Operate on received shares.
  var result = shares[1].cgteq(config.threshold);
  if (config.aggregate) {
    // Compute the total number of lower parties satisfying the threshold.
    for (var i = 2; i <= config.lower; i++) {
      result = result.sadd(shares[i].cgteq(config.threshold));
    }
  } else {
    // Compute if all of lower parties satisfy the threshold.
    for (var i = 2; i <= config.lower; i++) {
      result = result.smult(shares[i].cgteq(config.threshold));
    }
  }

  // Open the result.
  p1 = result.open(function(result) { console.log(result.toString()); });

  // Disconnect the party.
  Promise.all([p1]).then(function(x) {
  //  console.timeEnd("computation time " + id);
//    return jiff_instance.disconnect();
  });
}

jiff_instance = jiff.make_jiff("http://localhost:8080", 'test-threshold', options);
jiff_instance = require('../../lib/ext/jiff-client-bignumber').make_jiff(jiff_instance, options)
jiff_instance.connect();
