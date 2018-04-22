var jiff_instance;
var fs = require('fs');
var math = require('mathjs');
var numeric = require('numeric/numeric-1.2.6');
var BigNumber = require('bignumber.js');

var weights_layer_1;
var biases_layer_1;
var data_0;
var scatter_matrix;
var test_img_1;
var matrix_w;


function getColumn(twoD_arr, col_index){
    results = [];
    twoD_arr.forEach(function(oneD_arr){
        results.push(oneD_arr[col_index]);
    })
    return results;

}

function success(result) { 
    return result;
}

function failure(error){
    console.error("failure, error = " + error);
}

function getSum(total, num) {
    return total + num;
}



fs.readFile('/users/mikegajda/Documents/keystone_bu_2017_2018/mgajda-khc-keystone/nn_python/weights_layer_1.json', 'utf8', function (err, data) {
    if (err) throw err; // we'll not consider error handling for now
    console.log("weights_layer_1");
    weights_layer_1 = JSON.parse(data);
    console.log(weights_layer_1.length, weights_layer_1[0].length);

    fs.readFile('/users/mikegajda/Documents/keystone_bu_2017_2018/mgajda-khc-keystone/nn_python/weights_out.json', 'utf8', function (err, data) {
        if (err) throw err; // we'll not consider error handling for now
        console.log("weights_out");
        weights_out = JSON.parse(data);
        console.log(weights_out.length, weights_out[0].length);

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


var options = {party_count: 2, Zp: new BigNumber(32416190071), offset: 10000, bits: 6, digits: 4  };
//var options = {party_count: 2};
options.onConnect = function() {
    console.log("in onConnect");

    for (var i = 0; i < weights_layer_1.length; i++){
        for (var j = 0; j < weights_layer_1[0].length; j++){
            weights_layer_1[i][j] = weights_layer_1[i][j].toFixed(2);
            //test_arr[i][j] = 5;
        }
    }
    console.log(weights_layer_1.length, weights_layer_1[0].length)
   
    var other_array_row_count = 1;

    var vec_to_share = [];

    for(var i = 0; i < weights_layer_1[0].length; i++){
        for (var j = 0; j < other_array_row_count; j++){
            var column_values = getColumn(weights_layer_1, i);
            for (var x = 0; x < column_values.length; x++){
                vec_to_share.push(column_values[x]);
            }
        }
    }
    console.log(vec_to_share);

    var shares_2d = jiff_instance.share_vec(vec_to_share);

    var product_matrix = [];
    for (var i = 0; i < vec_to_share.length; i++){
        product_matrix.push(shares_2d[i][1].smult(shares_2d[i][2]).open().then(success, failure));
    }

    Promise.all(product_matrix).then(function(result){
        // made it through the first computation, now basically repeat with the output weights
        console.log("made it through one matrix multiplication")

        for (var i = 0; i < weights_out.length; i++){
            for (var j = 0; j < weights_out[0].length; j++){
                weights_out[i][j] = weights_out[i][j].toFixed(2);
                //test_arr[i][j] = 5;
            }
        }
        console.log(weights_out.length, weights_out[0].length)
       
        var other_array_row_count = 1;

        vec_to_share = [];

        for(var i = 0; i < weights_out[0].length; i++){
            for (var j = 0; j < other_array_row_count; j++){
                var column_values = getColumn(weights_out, i);
                for (var x = 0; x < column_values.length; x++){
                    vec_to_share.push(column_values[x]);
                }
            }
        }
        console.log(vec_to_share);

        shares_2d = jiff_instance.share_vec(vec_to_share);
        console.log("shared, length = ", shares_2d.length);

        var product_matrix_2 = [];
        for (var i = 0; i < vec_to_share.length; i++){
            product_matrix_2.push(shares_2d[i][1].smult(shares_2d[i][2]).open().then(success, failure));
        }
        
        Promise.all(product_matrix_2).then(function(result){
            console.log(result);
        }, function(failure){
            console.log("failure", failure);
        });

    });


    //     for (var i = 0; i < answer.length; i++){
    //         answer[i] = answer[i].toFixed(4);
    //     }
    //     console.log(answer);


    // }, function(failure){
    //     console.log("failed", failure);
    // });

            
    //         var shares_2d = jiff_instance.share_vec(getColumn(test_arr, j));

    //         //var results = [shares_2d[0][1].smult(shares_2d[0][2]).open().then(success, failure)];
    //         var results = [shares_2d[0][1].smult(shares_2d[0][2]).open().then(success, failure)];
    //         console.log("results")
    //         for(var k = 1; k < shares_2d.length; k++) {
    //             console.log("k = ", k);
    //             var shares = shares_2d[k];
    //             var product = shares[1].smult(shares[2]).open().then(success, failure);
    //             results.push(product);


    //         }

    //         product_matrix.push(new Promise(function(resolve, reject) {
    //           Promise.all(results).then(function(success_result){
    //             console.log("SUM BEFORE REDUCTIN = ", success_result);
    //                 resolve(1.0);
    //             }, function(failure){
    //                 reject(failure)
    //             });
    //         }));
    //     }
    // }
    // Promise.all(product_matrix).then(function(results){
    //     var test_arr = weights_out;

    //     for (var i = 0; i < test_arr.length; i++){
    //         for (var j = 0; j < test_arr[0].length; j++){
    //             test_arr[i][j] = test_arr[i][j].toFixed(4);
    //             //test_arr[i][j] = 5;
    //         }
    //     }
    //     console.log(test_arr.length, test_arr[0].length)
       
    //     var other_array_row_count = 1;

    //     product_matrix = [];
    //     for(var i = 0; i < test_arr[0].length; i++){
    //         for (var j = 0; j < other_array_row_count; j++){
    //             console.log(i, getColumn(test_arr, i));
    //             var shares_2d = jiff_instance.share_vec(getColumn(test_arr, j));

    //             //var results = [shares_2d[0][1].smult(shares_2d[0][2]).open().then(success, failure)];
    //             //var results = [shares_2d[0][1].smult(shares_2d[0][2]).open().then(success, failure)];
    //             var results = [shares_2d[0][1].smult(shares_2d[0][2]).open().then(success, failure)];
    //             console.log("results")
    //             for(var k = 1; k < shares_2d.length; k++) {
    //                 console.log("k = ", k);
    //                 var shares = shares_2d[k];
    //                 var product = shares[1].smult(shares[2]).open().then(success, failure);
    //                 results.push(product);


    //             }

    //             product_matrix.push(new Promise(function(resolve, reject) {
    //               Promise.all(results).then(function(success_result){
    //                     resolve(success_result.reduce(getSum));
    //                 }, function(failure){
    //                     reject(failure)
    //                 });
    //             }));
    //         }
    //     }
    //     Promise.all(product_matrix).then(function(results){
    //         console.log(results);

            
    //     }, failure);


    // }, failure);

    // console.log("done");

}


jiff_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", 'test-neural-net', options);
jiff_instance = require('../../lib/ext/jiff-client-bignumber').make_jiff(jiff_instance, options);
jiff_instance = require('../../lib/ext/jiff-client-negativenumber').make_jiff(jiff_instance, options); // Max bits allowed after decimal.
