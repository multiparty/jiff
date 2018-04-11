/*
 * Frontend server:
 * 1. Waits for Backend to signal a preprocessing.
 * 2. Receives table from Backend, preprocess it (by shuffling and applying a PRF), Also hide values in tables by applying local symmetric encryption.
 * 3. Keeps track of the most up to date version as posted by Backend.
 * 4. When a query arrives, apply the PRF to it and send it to the Backend, then serve result to client.
 */

// Jiff library
var jiff_client = require('../../lib/jiff-client');

// How many keys in a batch
var KEY_BATCH_SIZE = 15;

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
// Inverse of 2 according to the used Zp
var inv2;

// Read configurations
var config = require('./config.json');
var backends = [ 1 ]; // Backend server is the only sender and always has ID 1.
var frontends = config.frontends; // Frontend servers are the receivers.


// Connect JIFF
var options = {
  party_id: parseInt(process.argv[2], 10),
  onConnect: startServer
};
var jiff_instance = jiff_client.make_jiff("http://localhost:3000", 'shortest-path-1', options);

function startServer() {
  // Compute inverse of two mod Zp (will be used later in evaluatePRF)
  inv2 = jiff_instance.helpers.extended_gcd(2, jiff_instance.Zp)[0];

  // Listen to responses to queries from backend
  jiff_instance.listen("preprocess", handle_preprocess);

  // Listen to responses to queries from backend
  jiff_instance.listen("update", function(_, message) {
    current_recomputation_count = JSON.parse(message).recompute_number;
    if(current_recomputation_count - 3 >= 0)
      prf_keys_map[current_recomputation_count - 3] = null;
  });
  
  // Setup express server to handle client queries
  var express = require('express');
  var app = express();
  
  app.get('/query/:number/:source/:destination', handle_query);
  
  // Listen to responses to queries from backend
  jiff_instance.listen("query", finalize_query);

  // Start listening on port 9111
  app.listen(9110 + options.party_id, function() {
    console.log('frontend server up and listening on '+(9110 + options.party_id));
  });
}

// Performs the Preprocessing on the given table
function handle_preprocess(_, message) {
  var compute_number = JSON.parse(message).recompute_number;

  // Read configurations
  var config = require('./config.json');
  var backends = [ 1 ]; // Backend server is the only sender and always has ID 1.
  var frontends = config.frontends; // Frontend servers are the receivers.

  // Generate keys (in batches)
  var keys = genPRFKeysBatch(jiff_instance, KEY_BATCH_SIZE, compute_number);
  prf_keys_map[compute_number] = keys;

  // First share the size of the array: use threshold 1 so that it is public.
  var array_size = jiff_instance.share(null, 1, frontends, backends)[1]; // [1] message received from party 1 (backend server).   

  // Execute this code when the array size is received.
  // Free open: threshold = 1 so no messages are sent.
  jiff_instance.open(array_size, frontends).then(function(array_size) {
    // Receive table from backend
    var table = [];
    for(var i = 0; i < array_size; i++) { // receive a share for every element of the array
      table[i] = [];
      for(var j = 0; j < 3; j++)
        table[i][j] = jiff_instance.share(null, frontends.length, frontends, backends)[1]; // the only share received is from backend server.
    }

    // Shuffle table
    // table = shuffleMPC(table);
    
    // Evaluate PRF and Local Symmetric Encryption
    var promises = [];
    for(var i = 0; i < array_size; i++) {
      promises.push(applyPRF(jiff_instance, table[i][0], keys, inv2));
      promises.push(applyPRF(jiff_instance, table[i][1], keys, inv2));
      promises.push(table[i][2].promise);
    }
    
    Promise.all(promises).then(function(results) {
      for(var i = 0; i < array_size; i++) {
        // party 2 sends the result of prfs
        if(jiff_instance.id == frontends[0]) {
          jiff_instance.share(results[i*3], 1, backends, [ frontends[0] ], null, "src"+i);
          jiff_instance.share(results[i*3+1], 1, backends, [ frontends[0] ], null, "dist"+i);
        }
        // Everybody sends their local share encrypted.
        jiff_instance.share(table[i][2].value, 1, backends, frontends, null, "enc"+i);
      }
    });
  });
}

// Handles user query
function handle_query(req, res) {
  // Parse Query
  var query_number = parseInt(req.params.number, 10);
  var source = parseInt(req.params.source, 10);
  var destination = parseInt(req.params.destination, 10);
  console.log("New Query: " + query_number + " : " + source + " -> " + destination);

  var compute_number = current_recomputation_count;
  if(compute_number < 0) {
    res.send({ "error": "not ready yet!"});
    return;
  }

  // Store response to reply to client when ready
  response_map[query_number] = res;
  query_to_recomputation_numbers[query_number] = compute_number;

  // Read configurations
  var config = require('./config.json');
  var backends = [ 1 ]; // Backend server is the only sender and always has ID 1.
  var frontends = config.frontends; // Frontend servers are the receivers.

  if(jiff_instance.id == frontends[0])
    jiff_instance.emit('query', backends, JSON.stringify( { "recompute_number": compute_number, "query_number": query_number } ));

  // Turn input into shares and apply PRF
  source = jiff_instance.coerce_to_share(source, frontends, null, "source:"+query_number);
  destination = jiff_instance.coerce_to_share(destination, frontends, null, "destination:"+query_number);
  source.threshold = frontends.length;
  destination.threshold = frontends.length;
  
  var keys = prf_keys_map[compute_number];
  source = applyPRF(jiff_instance, source, keys, inv2);
  destination = applyPRF(jiff_instance, destination, keys, inv2);
  
  if(jiff_instance.id == frontends[0])
    Promise.all([source, destination]).then(function(results) {
      jiff_instance.share(results[0], 1, backends, [ frontends[0] ], null, "source:"+query_number);
      jiff_instance.share(results[1], 1, backends, [ frontends[0] ], null, "destination:"+query_number);
    });
}

// Receives the query result from the backend server, de-garble it, and send it back to client.
function finalize_query(_, message) {
  // Parse message
  message = JSON.parse(message);
  var query_number = message.query_number;
  var compute_number = query_to_recomputation_numbers[query_number];
  
  // Errors
  if(message.error != null) {
    response_map[message.query_number].send(JSON.stringify( { "error": message.error } ));
    return;
  }

  // All good! Decrypt the jump
  var jump = message.jump;
  var salt = message.salt;
  
  salt = applyPRF(prf_keys_map[compute_number], salt);
  var shares = jiff_instance.share(salt, frontends.length, frontends, frontends, jiff_instance.Zp, "decrypt:"+compute_number+":"+query_number);
  
  var result = shares[frontends[0]];
  for(var i = 1; i < frontends.length; i++)
    result = result.sadd(shares[frontends[i]]);

  result = results.csub(-1 * jump); // result = jump - sum(salts) mod Zp
  
  // Send result when ready to client
  var response = response_map[query_number];
  if(result.ready) response.send(JSON.stringify( { "id": jiff_instance.id, "result": decryptShare(result.value) } ));
  else result.promise.then(function() { response.send(JSON.stringify( { "id": jiff_instance.id, "result": decryptShare(result.value) } )); });

  // clean up
  query_to_recomputation_numbers[query_number] = null;
  response_map[query_number] = null;
}

// Makes a batch of keys of the given size
function genPRFKeysBatch(jiff_instance, batchSize, compute_number) {
  // Store Batch
  var batch = [];
  for(var i = 0; i < batchSize; i++)
    batch[i] = Math.random() * (jiff_instance.Zp - 1) + 1; // key in [1, Zp)
  
  return batch;
}

// Evaluate the PRF
function applyPRF(keys, value) {
  var mod = jiff_instance.helpers.mod;
  var Zp = jiff_instance.Zp;
  var power = (Zp - 1) / 2; /* Must be an integer since Zp is an odd prime */

  var result = 0; // Each Key gives us a bit of the result
  for(var i = 0; i < keys.length; i++) {
    var single_value = value + keys[i];
    single_value = jiff_instance.helpers.pow_mod(single_value, power, Zp); // Fast Exponentiation modulo prime
    single_value = mod((single_value + 1) * inv2, Zp); // Normalize
    single_value = mod(Math.pow(2, i) * results[i], Zp); // Expand

    result = mod(results + single_value, Zp); // Aggregate
  }
  
  return result;
}
