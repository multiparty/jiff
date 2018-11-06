/*
 * Frontend server:
 * 1. Waits for Backend to signal a preprocessing.
 * 2. Receives table from Backend, preprocess it (by shuffling and applying a PRF), Also hide values in tables by applying local symmetric encryption.
 * 3. Keeps track of the most up to date version as posted by Backend.
 * 4. When a query arrives, apply the PRF to it and send it to the Backend, then serve result to client.
 */

// Jiff library
var jiff_client = require('../../../lib/jiff-client');

var _sodium = require('libsodium-wrappers-sumo');
var _oprf = require('oprf');
var BN = require('bn.js');

// eslint-disable-next-line no-global-assign
$ = require('jquery-deferred');

var prime = new BN(2).pow(new BN(252)).add(new BN('27742317777372353535851937790883648493'));

var oprf;

var SRC = 0;
var DEST = 1;
var NEXT_HOP = 2;

/*
 * Global variables and counter,
 * in reality, should be stored in a database.
 */
// Keeps track of the most up to date version to query the backend with.
var current_recomputation_count = -1;

// Maps index i to an array of PRF Keys used by recomputation number i.
var prf_keys_map = [];
// Maps query number to the corresponding http response object.
var response_map = {};
// Maps query numbers to recomputation numbers
var query_to_recomputation_numbers = {};

// Read configurations
var config = require('./config.json');
var backends = [ 1 ]; // Backend server is the only sender and always has ID 1.
var frontends = config.frontends; // Frontend servers are the receivers.

// Connect JIFF
var options = {
  party_id: parseInt(process.argv[2], 10),
  party_count: frontends.length + backends.length,
  onConnect: startServer
};
var jiff_instance = jiff_client.make_jiff('http://localhost:3000', 'shortest-path-1', options);

function startServer() {
  // Listen to responses to queries from backend
  jiff_instance.listen('preprocess', handle_preprocess);

  // Listen to responses to queries from backend
  jiff_instance.listen('update', function (_, message) {
    current_recomputation_count = JSON.parse(message).recompute_number;
    if (current_recomputation_count - 3 >= 0) {
      prf_keys_map[current_recomputation_count - 3] = null;
    }
  });

  // Setup express server to handle client queries
  var express = require('express');
  var app = express();

  app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Depth, User-Agent, X-File-Size, X-Requested-With, If-Modified-Since, X-File-Name, Cache-Control');
    next();
  });

  app.get('/query/:number/:source/:destination', handle_query);

  // Listen to responses to queries from backend
  jiff_instance.listen('finish_query', finalize_query);

  // Start listening on port 9111
  app.listen(9110 + options.party_id, function () {
    console.log('frontend server up and listening on '+(9110 + options.party_id));
  });

  oprf = new _oprf.OPRF(_sodium);

}

// performs the OPRF with a table lookup for speed up
var saltDict = {};
function saltPoint(point, scalarKey) {
  var index = JSON.stringify(point);
  var scalarString = scalarKey.toString();
  if (saltDict[scalarString][index] == null) {
    saltDict[scalarString][index] = oprf.scalarMult(point, scalarString);
  }

  return saltDict[scalarString][index];
}

// Performs the Preprocessing on the given table
function handle_preprocess(_, message) {
  message = JSON.parse(message);
  console.log('BEGIN PREPROCESSING');

  var recompute_number = message.recompute_number;
  var table = message.table;

  // Generate keys (in batches)
  var scalarKey = new BN(oprf.generateRandomScalar());
  prf_keys_map[recompute_number] = scalarKey;
  saltDict[scalarKey.toString()] = {};

  // in place very fast shuffle
  (function (a,b,c,d,r) { // https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
    r=Math.random;c=a.length;while (c) {
      b=r*(--c+1)|0,d=a[c],a[c]=a[b],a[b]=d
    }
  })(table);

  for (var i = 0; i < table.length; i++) {
    var entry = table[i];
    entry[SRC] = saltPoint(entry[SRC], scalarKey);
    entry[DEST] = saltPoint(entry[DEST], scalarKey);
    entry[NEXT_HOP] = saltPoint(entry[NEXT_HOP], scalarKey);
  }

  // Forward table to next party
  var index = frontends.indexOf(jiff_instance.id);
  var next_party = (index + 1 < frontends.length) ? [ frontends[index + 1] ] : backends;
  jiff_instance.emit('preprocess', next_party, JSON.stringify(message), false);
}

// Handles user query
function handle_query(req, res) {
  // Parse Query
  var query_number = parseInt(req.params.number, 10);
  var sourceMask = new BN(req.params.source);
  var destinationMask = new BN(req.params.destination);

  var recompute_number = current_recomputation_count;
  if (recompute_number < 0) {
    res.send({ error: 'not ready yet!'});
    return;
  }

  // Store response to reply to client when ready
  response_map[query_number] = res;
  query_to_recomputation_numbers[query_number] = recompute_number;

  // multiply mask by scalar key
  var key = prf_keys_map[recompute_number];
  sourceMask = sourceMask.mul(key).mod(prime);
  destinationMask = destinationMask.mul(key).mod(prime);

  jiff_instance.emit('query', backends, JSON.stringify( { query_number: query_number, recompute_number: recompute_number, source: sourceMask.toString(), destination: destinationMask.toString() }), false);
}

// Receives the query result from the backend server, de-garble it, and send it back to client.
function finalize_query(_, message) {
  // Parse message
  message = JSON.parse(message);

  var query_number = message.query_number;
  var recompute_number = query_to_recomputation_numbers[query_number];
  var response = response_map[query_number];

  // clean up
  query_to_recomputation_numbers[query_number] = null;
  response_map[query_number] = null;

  // Errors
  if (message.error != null) {
    response.send(JSON.stringify( { error: message.error } ));
    return;
  }

  // All good! Decrypt the jump by applying the inverse of the key to the mask
  var jump = new BN(message.jump);
  var key = prf_keys_map[recompute_number];
  jump = jump.mul(key.invm(prime)).mod(prime);

  // Send result when ready to client
  response.send(JSON.stringify( { share: jump.toString() } ));
}

