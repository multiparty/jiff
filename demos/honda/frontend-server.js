/*
 * Frontend server:
 * 1. Waits for Backend to signal a preprocessing.
 * 2. Receives table from Backend, preprocess it (by shuffling and applying a PRF), Also hide values in tables by applying local symmetric encryption.
 * 3. Keeps track of the most up to date version as posted by Backend.
 * 4. When a query arrives, apply the PRF to it and send it to the Backend, then serve result to client.
 */

/*
 * Global variables and counter,
 * in reality, should be stored in a database.
 */
// Keeps track of the most up to date version to query the backend with.
var current_recomputation_count = -1;
// Symmetric Encryption Key
var valueKey = genSYMKey();
// Maps index i to an array of PRF Keys used by recomputation number i.
var prf_keys_map = [];
// Maps query number to the corresponding http response object.
var response_map = {};
// Maps query numbers to recomputation numbers
var query_to_recomputation_numbers = {};
// How many keys in a batch
var KEY_BATCH_SIZE = 5;

var jiff_client = require('../../lib/jiff-client');

var options = {
  party_id: parseInt(process.argv[2], 10),
  onConnect: startServer
};
var jiff_instance = jiff_client.make_jiff("http://localhost:8080", 'shortest-path-1', options);

function startServer() {
  // Compute inverse of two mod Zp (will be used later in evaluatePRF)
  var inv2 = jiff_instance.helpers.extended_gcd(2, jiff_instance.Zp)[0];

  var express = require('express');
  var app = express();

  // when http://localhost:8080/compute/<input> is called,
  // server recomputes shortest paths according to what is
  // defined in the file: ./<input>.json
  app.get('/query/:number/:source/:destination', function(req, res) {
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
  });

  // Listen to responses to queries from backend
  jiff_instance.listen("update", function(_, message) {
    current_recomputation_count = JSON.parse(message).recompute_number;
    if(current_recomputation_count - 3 >= 0)
      prf_keys_map[current_recomputation_count - 3] = null;
  });

  // Listen to responses to queries from backend
  jiff_instance.listen("query", function(_, message) {
    message = JSON.parse(message);
    if(message.error != null) {
      response_map[message.query_number].send(JSON.stringify( { "error": message.error } ));
      return;
    }

    var compute_number = query_to_recomputation_numbers[message.query_number];
    response_map[message.query_number].send(JSON.stringify( { "id": jiff_instance.id, "result": decryptShare(message.result) } ));

    // clean up
    query_to_recomputation_numbers[message.query_number] = null;
    response_map[message.query_number] = null;
  });

  // Listen to responses to queries from backend
  jiff_instance.listen("preprocess", function(_, message) {
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
      table = shuffleMPC(table);
      
      // Evaluate PRF and Local Symmetric Encryption
      var promises = [];
      for(var i = 0; i < array_size; i++) {
        promises.push(applyPRF(jiff_instance, table[i][0], keys, inv2));
        promises.push(applyPRF(jiff_instance, table[i][1], keys, inv2));
        promises.push(table[i][2].promise);
      }
      
      Promise.all(promises).then(function(results) {
        console.log(results);
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
  });

  // Start listening on port 9111
  app.listen(9110 + options.party_id, function() {
    console.log('frontend server up and listening on '+(9110 + options.party_id));
  });
}

function shuffleMPC(table) {
  // Read configurations
  var config = require('./config.json');
  var backends = [ 1 ]; // Backend server is the only sender and always has ID 1.
  var frontends = config.frontends; // Frontend servers are the receivers.

  // Come up with a random ordering
  var random_sort = [];
  for(var i = 0; i < table.length; i++)
    random_sort.push(jiff_instance.server_generate_and_share( { max: table.length }, frontends));

  // silly bubble sort
  for(var i = 0; i < table.length; i++) {
    for(var j = 0; j < table.length - i - 1; j++) {
      var swap = random_sort[j].sgteq(random_sort[j+1]);
      var noswap = swap.not();

      var tmp1 = random_sort[j].smult(noswap).sadd(random_sort[j+1].smult(swap));
      var tmp2 = random_sort[j].smult(swap).sadd(random_sort[j+1].smult(noswap));
      
      random_sort[j] = tmp1;
      random_sort[j+1] = tmp2;
      
      for(var k = 0; k < 3; k++) {
        var t1 = table[j][k].mult(noswap).sadd(table[j+1][k].mult(swap));
        var t2 = table[j][k].mult(swap).sadd(table[j+1][k].mult(noswap));
        
        table[j][k] = t1;
        table[j+1][k] = t2;
      }
    }
  }

  return table;
}


// Makes a batch of keys of the given size
function genPRFKeysBatch(jiff_instance, batchSize, compute_number) {
  // Read configurations
  var config = require('./config.json');
  var backends = [ 1 ]; // Backend server is the only sender and always has ID 1.
  var frontends = config.frontends; // Frontend servers are the receivers.

  // Store Batch
  var batch = [];
  for(var i = 0; i < batchSize; i++) {
    var key = jiff_instance.generate_and_share_random(frontends.length, frontends, frontends);
    batch.push(key);
  }
  
  return batch;
}

// Evaluate the PRF
function applyPRF(jiff_instance, share, keys, inv2) {
  // Read configurations
  var config = require('./config.json');
  var backends = [ 1 ]; // Backend server is the only sender and always has ID 1.
  var frontends = config.frontends; // Frontend servers are the receivers.

  // Carry out some computation
  var all_promises = [];
  for(var i = 0; i < keys.length; i++) {
    // Come up with a random nonzero square
    var c = jiff_instance.server_generate_and_share({ "nonzero": true }, frontends);
    c = c.smult(c);

    // By mutliplicity of our PRF, we have PRF(c^2 * (a+k)) = PRF(a+k)
    var intermediate = c.smult(share.sadd(keys[i].cmult(2)));

    // open c^2 * (a+k), this does not reveal information (c is unknown and random)
    all_promises.push(jiff_instance.open(intermediate, [ frontends[0] ]));
  }

  if(jiff_instance.id != frontends[0]) return null;

  // When all are open, evaluate and return the PRF in the open.
  return Promise.all(all_promises).then(function(results) {
    var p = jiff_instance.Zp;
    var power = (p-1)/2;

    // Evaluate PRF
    var result = 0; // final result
    for(var i = 0; i < results.length; i++) {
      results[i] = jiff_instance.helpers.pow_mod(results[i], power, p); // Evaluate 1-bit PRF
      results[i] = jiff_instance.helpers.mod((results[i] + 1) * inv2, p); // Normalize
      result += jiff_instance.helpers.mod(Math.pow(2, i) * results[i], p); // Sum up every result
    }

    return result;
  });
}

function encryptShare(share) {
  return share;
}

function decryptShare(share) {
  return share;
}

function genSYMKey() {
  return 0;
}
