var express = require('express');
var app = express();
var http = require('http').Server(app);

// Catch and log any uncaught exceptions
process.on('uncaughtException', function (err) {
  console.log('Uncaught Exception!');
  console.log(err);
  throw err;
});
process.on('unhandledRejection', function (reason) {
  console.log('Unhandled Rejection', reason);
});


//Serve static files
//Configure App
app.use('/', express.static('html/'));
app.use('/lib', express.static('../../lib'));
app.use('/lib/ext', express.static('../../lib/ext'));

var jiff = require('../../lib/jiff-server');
var jiff_instance = jiff.make_jiff(http, { logs: true });
jiff_instance.totalparty_map['secdev'] = 80; // max 80 parties

// Serve static files.
http.listen(80, function () {
  console.log('listening on *:80');
  console.log('routes: / /demo /output');
});

// Compute function
var computation_instance = jiff_instance.compute('secdev');

function compute(numberOfSubmitters) {
  if (numberOfSubmitters < 1) {
    console.log('Nobody submitted!');
    return;
  }

  var senders = [];
  for (var i = 2; i <= computation_instance.party_count; i++) {
    senders.push(i);
  }

  // get all shares (plus dummy shares from non-existing parties)
  var shares1 = computation_instance.share(null, 2, [1, 's1'], senders);
  var shares2 = computation_instance.share(null, 2, [1, 's1'], senders);

  // sum
  var option1 = shares1[2];
  var option2 = shares2[2];
  for (var p = 3; p < numberOfSubmitters + 2; p++) {
    option1 = option1.sadd(shares1[p]);
    option2 = option2.sadd(shares2[p]);
  }

  option1.refresh = function () { return option1; };
  option2.refresh = function () { return option2; };

  // reveal results
  computation_instance.open(option1, [1]);
  computation_instance.open(option2, [1]);
}

computation_instance.listen('compute', function (_, msg) {
  var numberOfSubmitters = jiff_instance.client_map['secdev'].length - 2; // 's1' and 1 are part of the map
  console.log(numberOfSubmitters, jiff_instance.client_map['secdev']);
  computation_instance.emit('compute', [1], numberOfSubmitters.toString(), false);
  compute(numberOfSubmitters);
});


