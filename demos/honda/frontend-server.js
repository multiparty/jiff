function run(id) {
    var jiff_client = require('../../lib/jiff-client');
    return jiff_client.make_jiff("http://localhost:8080", '1', { party_id: id, onConnect: function(jiff_instance) { compute(jiff_instance) }});
}

function compute(jiff_instance) {
    console.log("FRONT-END START");
    // Share the array
    var senders = [ 1 ]; // Backend server is the only sender.
    var receivers = [ 2, 3, 4 ]; // Frontend servers are the receivers.

    // First share the size of the array: use threshold 1 so that it is public.
    var array_size = jiff_instance.share(0, 1, receivers, senders)[1]; // [1] message received from party 1 (backend server).
    
    // Execute this code when the array size is received.
    // Free open: threshold = 1 so no messages are sent.
    jiff_instance.open(array_size, [ jiff_instance.id ]).then(function(size) {
        var array = [];
        for(var i = 0; i < size; i++) // receive a share for every element of the array
            array[i] = jiff_instance.share(array[i], receivers.length, receivers, senders)[1]; // the only share received is from backend server.

        // Carry out some computation
        /* TODO */
        for(var i = 0; i < array.length; i++) 
            array[i] = array[i].cadd(2);
        
        // Open the array to the backend server.
        jiff_instance.open_all(array, senders);
    });
}


// Export API
module.exports = {
  run: run
};
