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
    for(var i = 0; i < array.length; i++)
      array[i] = jiff_instance.share(0, 1, senders, [ receivers[0] ])[receivers[0]];

    // When all the results are received, disconnect.
    jiff_instance.open_all(array, senders).then(function(results) {
        jiff_instance.disconnect();
        console.log(results);
        callback(true);
    });
}

// Export API
module.exports = {
  run: run
};
