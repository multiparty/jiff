var jiff_instance;
var fs = require('fs');

var weights_layer_1;
var biases_layer_1;
var data_0;


fs.readFile('/users/mikegajda/Documents/keystone_bu_2017_2018/mgajda-khc-keystone/nn_python/weights_layer_1.json', 'utf8', function (err, data) {
    if (err) throw err; // we'll not consider error handling for now
    weights_layer_1 = JSON.parse(data);

    fs.readFile('/users/mikegajda/Documents/keystone_bu_2017_2018/mgajda-khc-keystone/nn_python/biases_layer_1.json', 'utf8', function (err, data) {
        if (err) throw err; // we'll not consider error handling for now
        biases_layer_1 = JSON.parse(data);

        fs.readFile('/users/mikegajda/Documents/keystone_bu_2017_2018/mgajda-khc-keystone/nn_python/data_0.json', 'utf8', function (err, data) {
            if (err) throw err; // we'll not consider error handling for now
            data_0 = JSON.parse(data);

            console.log(weights_layer_1.length);
            console.log(biases_layer_1.length);
            console.log(data_0.length);
        });
    }); 
});







var options = {party_count: 2};
options.onConnect = function() {
    console.log("in onConnect")



    var shares = jiff_instance.share(3);
    var sum = shares[1];
    for(var i = 2; i <= jiff_instance.party_count; i++)
        sum = sum.sadd(shares[i]);
    sum.open(function(v) { console.log(v); jiff_instance.disconnect(); });
}

jiff_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", 'test-neural-net', options);
