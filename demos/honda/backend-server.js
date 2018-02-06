/*
 * Backend server:
 * 1. Establishes a jiff computation/instance with the other frontend servers
 * 2. Runs a web-server that exposes an API for computing/recomputing all pairs shortest paths locally.
 * 3. Executes the pre-processing protocol with frontend servers (oblivious shuffle + collision free PRF) on the all pairs shortests paths every time they are computed.
 * 4. When a frontend server demands: executes retrival protocol (local access by index).
 */
var jiff_client = require('../../lib/jiff-client');

var options = {
  party_id: 1,
  onConnect: startServer
};
var jiff_instance = jiff_client.make_jiff("http://localhost:3000", 'shortest-path-1', options);

function startServer(jiff) {
  var express = require('express');
  var app = express();

  // when http://localhost:8080/compute/<input> is called,
  // server recomputes shortest paths according to what is
  // defined in the file: ./<input>.json
  app.get('/recompute/:input', function(req, res)) {
    console.log("Recomputation requested!");

    var shortest_path_table = compute_shortest_path(req.params.id);
    mpc_preprocess_table(shortest_path_table);

    res.send("Recomputed! MPC Preprocessing now underway");
  }

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
function mpc_preprocess_table(table) {
    console.log("PREPROCESSING START");

    // Read configurations
    var config = require('./config.json');
    
    // Share the table
    var backends = [ 1 ]; // Backend server is the only sender and always has ID 1.
    var frontends = config.frontends; // Frontend servers are the receivers.

    // First share the length of the table (i.e. number of rows), each row has 3 cols
    // use threshold 1 so that the sharing is public.
    jiff_instance.share(table.length, 1, frontends, backends);

     // Now share every element of the table
    for(var i = 0; i < table.length; i++)
      for(var j = 0; j < 3; j++)
        jiff_instance.share(table[i][j], frontends.length, frontends, backends);

    // Front end servers will now do some computation, then send the result here.
    var promises = [];
    for(var i = 0; i < table.length; i++) {
      encryptedTable[i] = [];

      // Receive the ith row indices from frontends and open them.
      // These indices are shuffled and hidden (by utilizing a PRF).
      promises.push(jiff_instance.receive_open(frontends));
      promises.push(jiff_instance.receive_open(frontends));

      // Receive each share of the ith table value from the frontends parties, but do not open them.
      // These shares will be encrypted and stored as is.
      var encrypted_shares = jiff_instance.share(null, 1, backends, frontends);
      for(var j = 0; j < table.length; j++)
        promises.push(encrypted_shares[frontends[j]]);
    }
    
    // Expand results into a table for fast access.
    Promise.all(promises).then(results) {
      // encrypted_table will have the form:
      // encrypted_table[prf(source)][prf(destination)] = [encrypted_share_of_value1, encrypted_share_of_value2, ..]
      var encrypted_table = {};
      for(var i = 0; i < table.length; i++)
        encrypted_table[results[i*3]] = {};

      for(var i = 0; i < table.length; i++) {
        var encrypted_shares_of_value = [];
        for(var j = 0; j < frontends.length; j++)
          encrypted_shares_of_value.push(results[i*3 + 2 + j]);

        encrypted_table[results[i*3]][results[i*3 + 1]] = encrypted_shares_of_value;
      }


      
    }

    // When all the results are received, disconnect.
    jiff_instance.open_all(array, backends).then(function(results) {
        jiff_instance.disconnect();
        console.log(results);
        callback(true);
    });
}

