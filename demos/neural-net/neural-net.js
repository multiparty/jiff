var jiff_instance;
var fs = require('fs');
var math = require('mathjs');
var BigNumber = require('bignumber.js');

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

            for(index in data_0){
                data_0[index] = data_0[index].toFixed(4)
            }

            final_1_test = []
            for (i = 0; i < 256; i++){
                final_1_test.push(0.0);
            }
            for (j = 0; j < 330; j++){
                for (i = 0; i < 256; i++){
                    final_1_test[i] += (data_0[j] * weights_layer_1[j][i])
                }
            }
            for (i = 0; i < 256; i++){
                final_1_test[i] += biases_layer_1[i]
            }

            // console.log(final_1_test)
            // console.log(final_1_test.length)
            
           
            // intermediate_1 = math.multiply(data_0, weights_layer_1)
            // final_1 = math.add(intermediate_1, biases_layer_1)

            console.log("all loaded")

        });
    }); 
});




function success(result) { 
    console.log("success, result = " + result);
    return result;
  }

  function test_result(result) { 
    console.log(result);
  }

  function failure(error){
    console.error("failure, error = " + error);
  }


var options = {party_count: 2, Zp: new BigNumber(32416190071), offset: 100, bits: 8, digits: 5 };
options.onConnect = function() {
    console.log("in onConnect");
    var results = [];
    var shares_2d = jiff_instance.share_vec(data_0);

    for(var i = 0; i < shares_2d.length; i++) {
      var shares = shares_2d[i];

      var sum = shares[1];

      for(var j = 2; j <= 2; j++) {
        sum = sum.sadd(shares[j]);
      }
      //console.log(sum.open());
      results.push(sum.open().then(success, failure));
    }



    Promise.all(results).then(test_result, failure); 
    
   

    // var results = [];
    // var shares = jiff_instance.receive_open([1]).then(
    //     function(result) { 
    //         console.log("result: " + result); 
    //     });
    // console.log(shared_2d);
    // var shares_2d = jiff_instance.share_vec(data);
    // console.log("shared")

    // for(var i = 0; i < shares_2d.length; i++) {
    //   var shares = shares_2d[i];

    //   var sum = shares[1];

    //   for(var j = 2; j <= party_count; j++) {
    //     sum = sum.sadd(shares[j]);
    //   }
    //   //console.log(sum.open());
    //   results.push(sum.open().then(success, failure));
    // }



    // Promise.all(results).then(test_result, failure); 

}

var base_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", 'test-neural-net', options);
var bignum_instance = require('../../lib/ext/jiff-client-bignumber').make_jiff(base_instance, options)
jiff_instance = require('../../lib/ext/jiff-client-negativenumber').make_jiff(base_instance, options); // Max bits allowed after decimal.
