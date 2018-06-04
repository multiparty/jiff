/*
 * Backend server:
 * 1. Establishes a jiff computation/instance with the other frontend servers
 * 2. Runs a web-server that exposes an API for computing/recomputing all pairs shortest paths locally.
 * 3. Executes the pre-processing protocol with frontend servers (oblivious shuffle + collision free PRF) on the all pairs shortests paths every time they are computed.
 * 4. When a frontend server demands: executes retrival protocol (local access by index).
 */

// Jiff library
var jiff_client = require('../../lib/jiff-client');

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
var jiff_instance = jiff_client.make_jiff("http://localhost:3000", 'shortest-path-1', options);

function startServer() {
  var express = require('express');
  var app = express();

  // when http://localhost:8080/compute/<input> is called,
  // server recomputes shortest paths according to what is
  // defined in the file: ./<input>.json
  app.get('/recompute/:input', function(req, res) {
    console.log("Recomputation requested!");

    var shortest_path_table = require("./data/"+req.params.input+".json");
    mpc_preprocess(shortest_path_table);

    res.send("Recomputed! MPC Preprocessing now underway");
  });

  // Listen to queries from frontends
  jiff_instance.listen("start_query", mpc_query);

  // Start listening on port 9111
  app.listen(9111, function() {
    console.log('backend server up and listening on 9111');
  });
}

/* Preprocess the table in MPC, then start listening and handling secure requests */
function mpc_preprocess(table) {
  console.log("PREPROCESSING START");

  // Figure out the recomputation number
  var recompute_number = recompute_count++;

  // Announce to frontends the start of the preprocessing.
  jiff_instance.emit("preprocess", [ frontends[0] ], JSON.stringify( { "recompute_number": recompute_number, "table": table } ));

  jiff_instance.listen("preprocess", function(_, message) {
    var encrypted_result = JSON.parse(message).table;

    // Make the result a table (instead of array) for fast access
    var encrypted_table  = {};
    for(var i = 0; i < encrypted_result.length; i++) {
      var single_entry = encrypted_result[i];
      var source = single_entry[0];
      var destination = single_entry[1];
      var jump = single_entry.slice(2); // Should contain the encrypted jump and one element per frontend server.

      if(encrypted_table[source] == null) encrypted_table[source] = {};
      encrypted_table[source][destination] = jump;
    }
    
    // Store the encrypted table at the appropriate index
    encrypted_tables[recompute_number] = encrypted_table;
    
    // Tell frontends to use this table from now on.
    jiff_instance.emit('update', frontends, JSON.stringify( { "recompute_number": recompute_number } ));

    // Delete old tables
    if(recompute_number - 3 >= 0)
      encrypted_tables[recompute_number - 3] = null;
    
    console.log("PREPROCESSING FINISHED");
  });
}

/* Handles a query in MPC */
function mpc_query(_, query_info) {
  // Parse the query info
  query_info = JSON.parse(query_info);
  var recompute_number = query_info.recompute_number;
  var query_number = query_info.query_number;
  var garbled_source = query_info.source;
  var garbled_destination = query_info.destination;

  console.log("QUERY START: compute: " + recompute_number + ". #: " + query_number + ". FROM: " + garbled_source + " TO: " + garbled_destination);

  // Get the appropriate table
  var encrypted_table = encrypted_tables[recompute_number];
  if(encrypted_table == null) {
    console.log("QUERY ERROR 1: compute: " + recompute_number + ". #: " + query_number);
    jiff_instance.emit('finish_query', frontends, JSON.stringify( { "query_number": query_number, "error": "recompute number not available" }));
    return;
  }

  if(encrypted_table[garbled_source] == null || encrypted_table[garbled_source][garbled_destination] == null) {
    console.log("QUERY ERROR 2: compute: " + recompute_number + ". #: " + query_number);
    jiff_instance.emit('finish_query', frontends, JSON.stringify( { "query_number": query_number, "error": "invalid source or destination" }));
    return;
  }
  
  // All good
  var encrypted_jump = encrypted_table[garbled_source][garbled_destination];
  
  // Send encrypted jump with the ``salt'' correponding to each frontend
  for(var i = 0; i < frontends.length; i++) // Maybe multiply the salt by random c^2?
    jiff_instance.emit('finish_query', [frontends[i]], JSON.stringify( { "query_number": query_number, "jump": encrypted_jump[0], "salt": encrypted_jump[i+1] }));

  console.log("QUERY SUCCESS: compute: " + recompute_number + ". #: " + query_number );
}




