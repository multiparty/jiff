/*
 * Frontend server:
 * 1. Waits for Backend to signal a preprocessing.
 * 2. Receives table from Backend, preprocess it (by shuffling and applying a PRF), Also hide values in tables by applying local symmetric encryption.
 * 3. Keeps track of the most up to date version as posted by Backend.
 * 4. When a query arrives, apply the PRF to it and send it to the Backend, then serve result to client.
 */

// Jiff library
var jiff_client = require('../../../lib/jiff-client');
$ = require('jquery-deferred');

// How many keys in a batch
var KEY_BATCH_SIZE = 25;

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
// handles the case where queries arrive later than communication between servers
var deferreds = {};
var promises = {};
// Inverse of 2 according to the used Zp
var inv2;

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

  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
    res.header("Access-Control-Allow-Headers", "Content-Type, Depth, User-Agent, X-File-Size, X-Requested-With, If-Modified-Since, X-File-Name, Cache-Control");
    next();
  });

  app.get('/query/:number/:source/:destination', handle_query);
  
  // Listen to forwarded queries from other frontends
  jiff_instance.listen("start_query", function(_, message) {
    message = JSON.parse(message);
    chain_query(message.recompute_number, message.query_number, message.source, message.destination);
  });
  
  // Listen to responses to queries from backend
  jiff_instance.listen("finish_query", finalize_query);

  // Start listening on port 9111
  app.listen(9110 + options.party_id, function() {
    console.log('frontend server up and listening on '+(9110 + options.party_id));
  });
}

// Performs the Preprocessing on the given table
function handle_preprocess(_, message) {
  var message = JSON.parse(message);
  console.log("BEGIN PREPROCESSING");

  var recompute_number = message.recompute_number;
  var table = message.table;
  
  // Generate keys (in batches)
  var keys = genPRFKeysBatch();
  prf_keys_map[recompute_number] = keys;

  // in place very fast shuffle
  (function(a,b,c,d,r) { // https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
    r=Math.random;c=a.length;while(c)b=r*(--c+1)|0,d=a[c],a[c]=a[b],a[b]=d
  })(table);

  var random = Math.random;
  var Zp = jiff_instance.Zp;
  var mod = jiff_instance.helpers.mod;
  for(var i = 0; i < table.length; i++) {
    var entry = table[i];
    entry[0] = applyPRF(keys, entry[0]);
    entry[1] = applyPRF(keys, entry[1]);
    
    var salt = (random() * Zp)|0;
    entry[2] = mod(entry[2] + applyPRF(keys, salt), Zp);
    for(var j = 3; j < entry.length; j++) {
      var r = (random() * Zp)|0;
      entry[j] = entry[j];
    }
    entry[entry.length] = salt;
  }

  // Forward table to next party
  var index = frontends.indexOf(jiff_instance.id);
  var next_party = (index + 1 < frontends.length) ? [ frontends[index + 1] ] : backends;
  jiff_instance.emit("preprocess", next_party, JSON.stringify(message));
}

// Handles user query
function handle_query(req, res) {
  // Parse Query
  var query_number = parseInt(req.params.number, 10);
  var source = parseInt(req.params.source, 10);
  var destination = parseInt(req.params.destination, 10);

  var recompute_number = current_recomputation_count;
  if(recompute_number < 0) {
    res.send({ "error": "not ready yet!"});
    return;
  }

  // Store response to reply to client when ready
  response_map[query_number] = res;
  query_to_recomputation_numbers[query_number] = recompute_number;
  
  
  // Signal that you have received the client request
  if(promises[query_number] == null) {
    deferreds[query_number] = $.Deferred();
    promises[query_number] = deferreds[query_number].promise();
  }
  deferreds[query_number].resolve();

  // First Frontend begin handling request and forwards it to other parties.
  if(jiff_instance.id == frontends[0]) chain_query(recompute_number, query_number, source, destination);
}

function chain_query(recompute_number, query_number, source, destination) {
  console.log("New Query: " + query_number + " : " + source + " -> " + destination);
  
  // Apply PRF to query
  var keys = prf_keys_map[recompute_number];
  source = applyPRF(keys, source);
  destination = applyPRF(keys, destination);

  // Forward query to next party
  var index = frontends.indexOf(jiff_instance.id);
  var next_party = (index + 1 < frontends.length) ? [ frontends[index + 1] ] : backends;
  jiff_instance.emit("start_query", next_party, JSON.stringify( { "query_number": query_number, "recompute_number": recompute_number, "source": source, "destination": destination }));
}

// Receives the query result from the backend server, de-garble it, and send it back to client.
function finalize_query(_, message) {
  // Parse message
  message = JSON.parse(message);
  var query_number = message.query_number;
  
  if(promises[query_number] == null) {
    deferreds[query_number] = $.Deferred();
    promises[query_number] = deferreds[query_number].promise();
  }
  
  // Just in case this came back quicker than client query/request.
  promises[query_number].then(function() {
    var recompute_number = query_to_recomputation_numbers[query_number];
    
    // Errors
    if(message.error != null) {
      response_map[message.query_number].send(JSON.stringify( { "error": message.error } ));
      return;
    }

    // All good! Decrypt the jump
    var jump = message.jump;
    var salt = message.salt;
    
    salt = applyPRF(prf_keys_map[recompute_number], salt);
    var shares = jiff_instance.share(salt, frontends.length, frontends, frontends, jiff_instance.Zp, "decrypt:"+recompute_number+":"+query_number);
    
    var result = shares[frontends[0]];
    for(var i = 1; i < frontends.length; i++)
      result = result.sadd(shares[frontends[i]]);

    result = result.cmult(-1).cadd(jump); // result = jump - sum(salts) mod Zp
    
    // Send result when ready to client
    var response = response_map[query_number];
    if(result.ready) response.send(JSON.stringify( { "id": jiff_instance.id, "result": result.value} ));
    else result.promise.then(function() { response.send(JSON.stringify( { "id": jiff_instance.id, "result": result.value } )); });

    // clean up
    query_to_recomputation_numbers[query_number] = null;
    response_map[query_number] = null;
    promises[query_number] = null;
    deferreds[query_number] = null;
  });
}

// Makes a batch of keys of the given size
function genPRFKeysBatch() {
  // Store Batch
  var batch = [];
  for(var i = 0; i < KEY_BATCH_SIZE; i++)
    batch[i] = (Math.random() * (jiff_instance.Zp - 1) + 1)|0; // key in [1, Zp)
  
  console.log(batch);
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
    single_value = mod(Math.pow(2, i) * single_value, Zp); // Expand

    result = mod(result + single_value, Zp); // Aggregate
  }
  
  return result;
}
