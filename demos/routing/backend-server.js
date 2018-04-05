/*
 * Backend server:
 * 1. Establishes a jiff computation/instance with the other frontend servers
 * 2. Runs a web-server that exposes an API for computing/recomputing all pairs shortest paths locally.
 * 3. Executes the pre-processing protocol with frontend servers (oblivious shuffle + collision free PRF) on the all pairs shortests paths every time they are computed.
 * 4. When a frontend server demands: executes retrival protocol (local access by index).
 */


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

var jiff_client = require('../../lib/jiff-client');

var options = {
  party_id: 1,
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

    var shortest_path_table = compute_shortest_path(req.params.input);
    mpc_preprocess(shortest_path_table);

    res.send("Recomputed! MPC Preprocessing now underway");
  });

  // Listen to queries from frontends
  jiff_instance.listen("query", mpc_query);

  // Start listening on port 9111
  app.listen(9111, function() {
    console.log('backend server up and listening on 9111');
  });
}

/* Compute shortest path according to ./<input_file>.json */
function compute_shortest_path(input_file) {
  var shortest_path_table = require("./"+input_file+".json");
  return shortest_path_table;
}

/* Preprocess the table in MPC, then start listening and handling secure requests */
function mpc_preprocess(table) {
    console.log("PREPROCESSING START");

    // Read configurations
    var config = require('./config.json');
    var backends = [ 1 ]; // Backend server is the only sender and always has ID 1.
    var frontends = config.frontends; // Frontend servers are the receivers.
    var recompute_number = recompute_count++;

    // Announce to frontends the start of the preprocessing.
    jiff_instance.emit("preprocess", frontends, JSON.stringify( { "recompute_number": recompute_number } ));

    // First share the length of the table (i.e. number of rows), each row has 3 cols
    // use threshold 1 so that the sharing is public.
    jiff_instance.share(table.length, 1, frontends, backends);

     // Now share every element of the table
    for(var i = 0; i < table.length; i++)
      for(var j = 0; j < 3; j++)
        jiff_instance.share(table[i][j], frontends.length, frontends, backends);

    // Front end servers will now do some computation, then send the result here.
    var promises = [];
    var shares = [];
    for(var i = 0; i < table.length; i++) {
      // Receive the ith row indices from frontends and open them.
      // These indices are shuffled and hidden (by utilizing a PRF).
      var share1 = jiff_instance.share(null, 1, backends, [frontends[0]], null, "src"+i)[frontends[0]];
      shares.push(share1);
      promises.push(share1.promise);
      
      var share2 = jiff_instance.share(null, 1, backends, [frontends[0]], null, "dist"+i)[frontends[0]];
      shares.push(share2);
      promises.push(share2.promise);
      
      // Receive each share of the ith table value from the frontends parties, but do not open them.
      // These shares will be encrypted and stored as is.
      var encrypted_shares = jiff_instance.share(null, 1, backends, frontends, null, "enc"+i);
      for(var j = 0; j < frontends.length; j++) {
        shares.push(encrypted_shares[frontends[j]]);
        promises.push(encrypted_shares[frontends[j]].promise);
      }
    }
    
    // Expand results into a table for fast access.
    Promise.all(promises).then(function(results) {
      var offset = 2 + frontends.length;

      // encrypted_table will have the form:
      // encrypted_table[prf(source)][prf(destination)] = [encrypted_share_of_value1, encrypted_share_of_value2, ..]
      var encrypted_table = {};
      for(var i = 0; i < table.length; i++)
        encrypted_table[results[i*offset]] = {};

      for(var i = 0; i < table.length; i++) {
        var encrypted_shares_of_value = [];
        for(var j = 0; j < frontends.length; j++)
          encrypted_shares_of_value.push(shares[i*offset + 2 + j].value);

        encrypted_table[results[i*offset]][results[i*offset + 1]] = encrypted_shares_of_value;
      }

      // Store the encrypted table at the appropriate index
      encrypted_tables[recompute_number] = encrypted_table;

      // Delete old tables
      if(recompute_number - 3 >= 0)
        encrypted_tables[recompute_number - 3] = null;

      console.log(encrypted_table);
      console.log("PREPROCESSING FINISHED");

      // Tell frontends to use this table from now on.
      jiff_instance.emit('update', frontends, JSON.stringify( { "recompute_number": recompute_number } ));
    });
}

/* Handles a query in MPC */
function mpc_query(_, query_info) {
  // Parse the query info
  query_info = JSON.parse(query_info);
  var recompute_number = query_info.recompute_number;
  var query_number = query_info.query_number;

  console.log("QUERY START: compute: " + recompute_number + ". #: " + query_number );

  // Read configurations
  var config = require('./config.json');
  var backends = [ 1 ]; // Backend server is the only sender and always has ID 1.
  var frontends = config.frontends; // Frontend servers are the receivers.

  // Get the appropriate table
  var encrypted_table = encrypted_tables[recompute_number];
  if(encrypted_table == null) {
    console.log("QUERY ERROR 1: compute: " + recompute_number + ". #: " + query_number );
    jiff_instance.emit('query', frontends, JSON.stringify( { "query_number": query_number, "error": "recompute number not available"  }));
    return;
  }

  // All is good, can begin computation
  // Receive and open the source and destination (hidden by applying the PRF).
  var source = jiff_instance.share(null, 1, backends, [ frontends[0] ], null, "source:"+query_number)[frontends[0]];
  var destination = jiff_instance.share(null, 1, backends, [ frontends[0] ], null, "destination:"+query_number)[frontends[0]];

  // Get the corresponding value
  Promise.all([ source.promise, destination.promise ]).then(function() {
    if(encrypted_table[source.value] == null || encrypted_table[source.value][destination.value] == null) {
      console.log("QUERY ERROR 2: compute: " + recompute_number + ". #: " + query_number );
      jiff_instance.emit('query', frontends, JSON.stringify( { "query_number": query_number, "error": "invalid source or destination"  }));
      return;
    }
    
    // All good
    var encrypted_shares_of_value = encrypted_table[source.value][destination.value];

    // Send each encrypted share to its origin
    for(var i = 0; i < frontends.length; i++)
      jiff_instance.emit('query', [frontends[i]], JSON.stringify( { "query_number": query_number, "result": encrypted_shares_of_value[i] }));

    console.log("QUERY SUCCESS: compute: " + recompute_number + ". #: " + query_number );
  });
}




