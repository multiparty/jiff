function run(id) {
    var jiff_client = require('../../lib/jiff-client');
    return jiff_client.make_jiff("http://localhost:8080", '1', { party_id: id, onConnect: function(jiff_instance) { compute(jiff_instance) }});
}

function compute(jiff_instance) {
    console.log("FRONT-END START");
    // Share the array
    var senders = [ 1 ]; // Backend server is the only sender.
    var receivers = [ 2, 3, 4 ]; // Frontend servers are the receivers.
    
    // Generate keys (in batches)
    var keys = genKeysBatch(jiff_instance, 10);

    // First share the size of the array: use threshold 1 so that it is public.
    var array_size = jiff_instance.share(0, 1, receivers, senders)[1]; // [1] message received from party 1 (backend server).
    
    // Compute inverse of two mod Zp (will be used later in evaluatePRF)
    var inv2 = jiff_instance.helpers.extended_gcd(2, jiff_instance.Zp)[0];
    
    // Execute this code when the array size is received.
    // Free open: threshold = 1 so no messages are sent.
    jiff_instance.open(array_size, receivers).then(function(size) {
        var array = [];
        for(var i = 0; i < size; i++) // receive a share for every element of the array
            array[i] = jiff_instance.share(array[i], receivers.length, receivers, senders)[1]; // the only share received is from backend server.

        // Carry out some computation
        var all_promises = [];
        for(var i = 0; i < array.length; i++) {
          // Come up with a random nonzero square
          var c = jiff_instance.server_generate_and_share({"nonzero": true}, receivers);
          c = c.smult(c);

          // open c^2 * a, this doesnot reveal information (c is unknown and random)
          // By mutliplicity of our PRF, we have PRF(c^2 * (a+k)) = PRF(a+k)
          var keys_promises = [];
          for(var ki = 0; ki < keys.length; ki++)
            keys_promises.push(jiff_instance.open(c.smult(array[i].sadd(keys[ki])), [ receivers[0] ]));

          if(jiff_instance.id == receivers[0]) // equivalently, keys_promises should not be null
            // promises are in the same indices as corresponding elements in original array
            all_promises.push(Promise.all(keys_promises).then(function(open_c) { return evaluatePRF(jiff_instance, open_c, inv2); }));
        }

        // Open the array to the backend server.
        Promise.all(all_promises).then(function(results) {
          // results is an array with values corresponding to promises with matching indices.
          if(jiff_instance.id == receivers[0])
            for(var i = 0; i < results.length; i++) // send results to server
              jiff_instance.share(results[i], 1, senders, [ receivers[0] ]);
        });
    });
}

// Makes a batch of keys of the given size
function genKeysBatch(jiff_instance, batchSize) {
  var batch = [];

  var frontends = [ 2, 3, 4 ]; // Frontend servers are the receivers.
  for(var i = 0; i < batchSize; i++) {
    var key = jiff_instance.generate_and_share_random(frontends.length, frontends, frontends);
    batch.push(key);
  }
  
  return batch;
}

// Evaluate the PRF in the open
// results is an array where every index i is the result of c^2 * (a + keyi)
function evaluatePRF(jiff_instance, results, inv2) {
  var p = jiff_instance.Zp;
  var power = (p-1)/2;

  // Evaluate PRF
  var result = 0; // final result
  for(var i = 0; i < results.length; i++) {
    results[i] = jiff_instance.helpers.pow_mod(results[i], power, p); // Evaluate PRF
    results[i] = jiff_instance.helpers.mod((results[i] + 1) * inv2, p); // Normalize
    result = Math.pow(2, i) * results[i]; // Sum up every result
  }

  return result;
}

// Export API
module.exports = {
  run: run
};
