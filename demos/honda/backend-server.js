function run(callback, size) {
    var jiff_client = require('../../lib/jiff-client');
    var jiff_instance = jiff_client.make_jiff("http://localhost:8080", '1', { party_id: 1, onConnect: function() { compute(jiff_instance, callback, size) }});
}

function compute(jiff_instance, callback, array_size) {
    console.log("BACK-END START");
    // Come up with an array of numbers
    var array = [];
    for(var i = 1; i <= array_size; i++) array.push(i);

    // Share the array
    var senders = [ 1 ]; // Backend server is the only sender.
    var receivers = [ 2, 3, 4 ]; // Frontend servers are the receivers.

    // First share the size of the array: use threshold 1 so that it is public.
    jiff_instance.share(array.length, 1, receivers, senders);

    for(var i = 0; i < array.length; i++) // Now share every element of the array
    jiff_instance.share(array[i], receivers.length, receivers, senders);

    // Front end servers will now do some computation, then send the result here.
    var promise_array = []; // Store promises corresponding to the results.
    for(var i = 0; i < array.length; i++) // Set up to receive the results
        promise_array[i] = jiff_instance.receive_open(receivers, receivers.length);

    // When all the results are received, disconnect.
    Promise.all(promise_array).then(function(results) {
        jiff_instance.disconnect();
        callback(results[0] == array[0] + 2);
    });
}

// Export API
module.exports = {
  run: run
};
