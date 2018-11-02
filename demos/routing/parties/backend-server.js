/*
 * Backend server:
 * 1. Establishes a jiff computation/instance with the other frontend servers
 * 2. Runs a web-server that exposes an API for computing/recomputing all pairs shortest paths locally.
 * 3. Executes the pre-processing protocol with frontend servers (oblivious shuffle + collision free PRF) on the all pairs shortests paths every time they are computed.
 * 4. When a frontend server demands: executes retrival protocol (local access by index).
 */

// Jiff library
var jiff_client = require('../../../lib/jiff-client');
var _sodium = require('libsodium-wrappers-sumo');
var _oprf = require('oprf');
var BN = require('bn.js');

var prime = new BN(2).pow(new BN(252)).add(new BN('27742317777372353535851937790883648493'));

var SRC = 0;
var DEST = 1;
var NEXT_HOP = 2;

var oprf;

/*
 * Global variables and counter,
 * in reality, should be stored in a database.
 */
// Keeps track of how many times we recomputed.
var recompute_count = 0;
// Maps index i to the resulting encrypted table of the ith preprocessing/recomputation.
// Old tables must be stored for a while, since we may need to service old queries during
// or just after preprocessing/recomputation.
var encrypted_tables = [];
// Read configurations
var config = require('./config.json');
var backends = [ 1 ]; // Backend server is the only sender and always has ID 1.
var frontends = config.frontends; // Frontend servers are the receivers.

// Connect JIFF
var options = {
  party_id: 1,
  party_count: frontends.length + backends.length,
  onConnect: startServer
};
var jiff_instance = jiff_client.make_jiff('http://localhost:3000', 'shortest-path-1', options);

function startServer() {
  var express = require('express');
  var app = express();

  // when http://localhost:8080/compute/<input> is called,
  // server recomputes shortest paths according to what is
  // defined in the file: ./<input>.json
  app.get('/recompute/:input', function (req, res) {
    console.log('Recomputation requested!');

    var shortest_path_table = require('../data/'+req.params.input+'.json');
    mpc_preprocess(shortest_path_table);

    res.send('Recomputed! MPC Preprocessing now underway');
  });

  // Listen to queries from frontends
  jiff_instance.listen('query', frontend_query);

  // Cross Origin Requests Allowed
  app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Depth, User-Agent, X-File-Size, X-Requested-With, If-Modified-Since, X-File-Name, Cache-Control');
    next();
  });

  // Listen to queries from user
  app.get('/query/:number/:source/:destination', user_query);

  // Start listening on port 9111
  app.listen(9111, function () {
    console.log('backend server up and listening on 9111');
  });

  oprf = new _oprf.OPRF(_sodium);
}

/* Preprocess the table in MPC, then start listening and handling secure requests */
function mpc_preprocess(table) {
  // Figure out the recomputation number
  var recompute_number = recompute_count++;

  // Announce to frontends the start of the preprocessing.
  jiff_instance.emit('preprocess', [ frontends[0] ], JSON.stringify( { recompute_number: recompute_number, table: table } ), false);

  jiff_instance.listen('preprocess', function (_, message) {
    var encrypted_result = JSON.parse(message).table;

    // Make the result a table (instead of array) for fast access
    var encrypted_table  = {};
    for (var i = 0; i < encrypted_result.length; i++) {
      var single_entry = encrypted_result[i];
      var source = JSON.stringify(single_entry[SRC]);
      var destination = JSON.stringify(single_entry[DEST]);
      var jump = JSON.stringify(single_entry[NEXT_HOP]); // Should contain the encrypted jump and one element per frontend server.

      if (encrypted_table[source] == null) {
        encrypted_table[source] = {};
      }
      encrypted_table[source][destination] = jump;
    }

    // Store the encrypted table at the appropriate index
    encrypted_tables[recompute_number] = encrypted_table;

    // Tell frontends to use this table from now on.
    jiff_instance.emit('update', frontends, JSON.stringify( { recompute_number: recompute_number } ), false);

    // Delete old tables
    if (recompute_number - 3 >= 0) {
      encrypted_tables[recompute_number - 3] = null;
    }

    console.log('PREPROCESSING COMPLETE');
  });
}

var queryMap = {};
function user_query(req, res) {
  console.log('user query');
  // Parse Query
  var query_number = parseInt(req.params.number, 10);
  var sourcePoint = JSON.parse(req.params.source); // EC point
  var destinationPoint = JSON.parse(req.params.destination); // EC point

  var query = queryMap[query_number];
  if (query == null) {
    query = [];
    queryMap[query_number] = query;
  }

  query.unshift( { source: sourcePoint, dest: destinationPoint, response: res })
  if (query.length === frontends.length + backends.length) {
    finish_query(query_number);
  }
}

/* Handles a query in MPC */
function frontend_query(_, query_info) {
  console.log('frontend query', _);
  // Parse the query info
  query_info = JSON.parse(query_info);
  var recompute_number = query_info.recompute_number;
  var query_number = query_info.query_number;
  var sourceMask = new BN(query_info.source);
  var destMask = new BN(query_info.destination);

  var query = queryMap[query_number];
  if (query == null) {
    query = [];
    queryMap[query_number] = query;
  }

  query.push( { source: sourceMask, dest: destMask, recompute_number: recompute_number });
  if (query.length === frontends.length + backends.length) {
    finish_query(query_number);
  }
}

function finish_query(query_number) {
  var query = queryMap[query_number];
  var recompute_number = query[query.length-1].recompute_number;
  var encrypted_table = encrypted_tables[recompute_number];

  // Clean up
  queryMap[query_number] = null;

  // Logs
  console.log('QUERY START: compute: ' + recompute_number + '. #: ' + query_number);

  // Error: no table matching set of keys
  if (encrypted_table == null) {
    console.log('QUERY ERROR 1: compute: ' + recompute_number + '. #: ' + query_number);
    jiff_instance.emit('finish_query', frontends, JSON.stringify( { query_number: query_number, error: 'recompute number not available' }), false);
    return;
  }

  // Reconstruct the garbled source and destination
  var sourceShares = [];
  var destShares = [];
  for (var i = 0; i < query.length; i++) {
    sourceShares.push(query[i].source);
    destShares.push(query[i].dest);
  }

  var source = multiplicative_reconstruct(sourceShares);
  var dest = multiplicative_reconstruct(destShares);

  // Error: garbled source and destination do not exist in table!
  if (encrypted_table[source] == null || encrypted_table[source][dest] == null) {
    console.log('QUERY ERROR 2: compute: ' + recompute_number + '. #: ' + query_number);

    jiff_instance.emit('finish_query', frontends, JSON.stringify( { query_number: query_number, error: 'invalid source or destination' }), false);
    query[0].response.send(JSON.stringify( { error: 'invalid source or destination' } ));
    return;
  }

  // Found garbled jump
  var jump = JSON.parse(encrypted_table[source][dest]);

  // Share jump and send shares to user and frontends
  jump = multiplicative_share(jump);
  for (var k = 0; k < frontends.length; k++) {
    jiff_instance.emit('finish_query', [frontends[k]], JSON.stringify( { query_number: query_number, jump: jump[k+1] }), false);
  }

  query[0].response.send(JSON.stringify( { point: jump[0] } ));

  console.log('QUERY SUCCESS: compute: ' + recompute_number + '. #: ' + query_number );
}

function multiplicative_share(point) {
  var shares = [];
  var total_mask = new BN(1);
  for (var i = 0; i < frontends.length; i++) {
    var r = oprf.generateRandomScalar();
    total_mask = total_mask.mul(r).mod(prime);
    shares[i+1] = r.toString();
  }

  shares[0] = oprf.scalarMult(point, total_mask.invm(prime).toString());
  return shares;
}

// first share is a point, then a bunch of scalar multiplicative shares of an inverse
function multiplicative_reconstruct(shares) {
  var total_mask = new BN(1);
  for (var i = 1; i < shares.length; i++) {
    total_mask = total_mask.mul(new BN(shares[i]));
  }

  return JSON.stringify(oprf.scalarMult(shares[0], total_mask));
}




