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




fs.readFile('/users/mikegajda/Documents/keystone_bu_2017_2018/mgajda-khc-keystone/nn_python/weights_layer_1.json', 'utf8', function (err, data) {
    if (err) throw err; // we'll not consider error handling for now
    weights_layer_1 = JSON.parse(data);

    fs.readFile('/users/mikegajda/Documents/keystone_bu_2017_2018/mgajda-khc-keystone/nn_python/biases_layer_1.json', 'utf8', function (err, data) {
        if (err) throw err; // we'll not consider error handling for now
        biases_layer_1 = JSON.parse(data);

        fs.readFile('/users/mikegajda/Documents/keystone_bu_2017_2018/mgajda-khc-keystone/nn_python/test_img_1.json', 'utf8', function (err, data) {
            if (err) throw err; // we'll not consider error handling for now
            test_img_1 = JSON.parse(data);
            console.log("test_img_1")
            //console.log(test_img_1)


            fs.readFile('/users/mikegajda/Documents/keystone_bu_2017_2018/mgajda-khc-keystone/nn_python/matrix_w.json', 'utf8', function (err, data) {
                if (err) throw err; // we'll not consider error handling for now
                matrix_w = JSON.parse(data);

                //console.log(matrix_w[0]);
                //console.log(test_img_1);
                console.log(matrix_w.length, matrix_w[0].length)

                test = numeric.transpose(numeric.dot(numeric.transpose(matrix_w), numeric.transpose([test_img_1])));
                //console.log(test)
                console.log(test[0].length)








                // for(index in data_0){
                //     data_0[index] = data_0[index].toFixed(4)
                // }

                // final_1_test = []
                // for (i = 0; i < 256; i++){
                //     final_1_test.push(0.0);
                // }
                // for (j = 0; j < 330; j++){
                //     for (i = 0; i < 256; i++){
                //         final_1_test[i] += (data_0[j] * weights_layer_1[j][i])
                //     }
                // }
                // for (i = 0; i < 256; i++){
                //     final_1_test[i] += biases_layer_1[i]
                // }

                //console.log(final_1_test)
                // console.log(final_1_test.length)
                
               
                // intermediate_1 = math.multiply(data_0, weights_layer_1)
                // final_1 = math.add(intermediate_1, biases_layer_1)

                // console.log(final_1)

                console.log("all loaded")
            });
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


var options = {party_count: 2, Zp: new BigNumber(10003121), offset: 10000, bits: 8, digits: 5 };
options.onConnect = function() {
    console.log("in onConnect");
   

    var m = 256;
    var n = 330;

    oneD_matrix = [];
    for (i = 0; i < n; i++){
        oneD_matrix.push(jiff_instance.share(0.0));
    }
    // console.log(oneD_matrix);

    for (i = 0; i < n; i++){
        var sum = oneD_matrix[i][1];
        sum = sum.sadd(oneD_matrix[i][2]);
        oneD_matrix[i] = sum.open().then(success, failure);
        console.log(i);
    }

    Promise.all(oneD_matrix).then(function (results){
        console.log("i'm here")
        console.log(results);
        // for (var i = 0; i < n; i++){
        //     results[i] = results[i].toNumber();
        //     console.log(results[i]);
        // }
        // console.log(results);

        // test = numeric.transpose(numeric.dot(numeric.transpose(matrix_w), numeric.transpose([results])));
        // console.log(test)
        // console.log(test[0].length)
    }, function(err){
        console.log(err)
    })

    // for (i = 0; i < n; i++){
    //     var sum = oneD_matrix[i][1];
    //     sum = sum.sadd(oneD_matrix[i][2]);
    //     sum = sum.cadd(3.0);
    //     oneD_matrix[i] = sum.open().then(success, failure);
    // }
    // console.log(oneD_matrix[1])

    // Promise.all(oneD_matrix).then(function (results){
    //     console.log("i'm here")
    //     console.log(results);
    // }, function(err){
    //     console.log(err)
    // })

    // var twoD_matrix = [];
    // for (i = 0; i < m; i++){
    //     oneD_matrix = [];
    //     for (j = 0; j < n; j++){
    //         oneD_matrix.push(1.0);
    //     }
    //     twoD_matrix.push(oneD_matrix);
        
    // }

    // for (i = 0; i < m; i++){
    //     for (j = 0; j < n; j++){
    //         twoD_matrix[i][j] = jiff_instance.share(twoD_matrix[i][j]);
    //     }
    // }

    // for (i = 0; i < m; i++){
    //     for (j = 0; j < n; j++){
    //         var sum = twoD_matrix[i][j][1];
    //         sum = sum.sadd(twoD_matrix[i][j][2]);
    //         twoD_matrix[i][j] = sum.open().then(success, failure);
    //     }
    // }

    // for (i = 0; i < m; i++){
    //     Promise.all(twoD_matrix[i]).then(function(results){
    //         console.log(results);
    //     })
    // }

    console.log("done");

}


var base_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", 'test-neural-net', options);
var bignum_instance = require('../../lib/ext/jiff-client-bignumber').make_jiff(base_instance, options)
jiff_instance = require('../../lib/ext/jiff-client-negativenumber').make_jiff(bignum_instance, options); // Max bits allowed after decimal.
