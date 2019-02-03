var express = require('express');
var app = express();
var http = require('http').Server(app);
require('../../lib/jiff-server').make_jiff(http, {logs:true});

// Serve static files.
app.use('/demos', express.static('demos'));
app.use('/lib', express.static('lib'));
app.use('/lib/ext', express.static('lib/ext'));
http.listen(8080, function () {
  console.log('listening on *:8080');
});

console.log('Direct your browser to *:8080/demos/preference-comp-defaults/client.html.');
console.log('To run a server-based party: node demos/preference-comp-defaults/party <input>');
console.log();


/***** Set up local compute party *****/

var mpc = require('./mpc');
const fs = require('fs');

var Zp = 15485867;

var computation_id = 'undefined';  // Server
var party_count = 2;

var options = { party_count: party_count, Zp: Zp };
options.onError = function (error) {
    console.log(error);
};
options.onConnect = function () {
    beginMPC();
};

hostname = 'http://localhost:8080';
// eslint-disable-next-line no-undef
mpc.connect(hostname, computation_id, options);


/***** Submit default parameters for comparison *****/

// Load default preferences
var prefs = [];
fs.readFile(__dirname + '/default_prefs.json', (err, data) => {
    if (err) throw err;
    prefs = JSON.parse(data);
});

// Begin MPC comparison
function beginMPC() {
    var prefCount = 10;//prefs.length;
    for (var i = 1; i <= prefCount; i++) {
     // eslint-disable-next-line no-undef
     var promise = mpc.compute(prefs[i]);
     promise.then(handleResult);
    }
}

var index = 1;
function handleResult(result) {
    var statement = result === 1 ? 'the same' : 'different';
    console.log('Preference #' + index + ' is ' + statement + '.');
    index++;
}
