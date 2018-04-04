var jiff_instance;
var BigNumber = require('bignumber.js');
var jiff_instance;

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
  function compute() {

    if(jiff_instance == null || !jiff_instance.isReady() || pca_result == null )
      alert("Please wait!");
    else
      MPC(pca_result);
  }

  function MPC(input) {
    $("#computeBtn").attr("disabled", true);
    $("#output").append("<p>Starting...</p>");
    var shares = []
    for (var i = 0; i < input.length; i++){
        shares.push(jiff_instance.share(input[i]))
    }        
  }
var options = {party_count: 2, Zp: new BigNumber(32416190071), offset: 10000, bits: 8, digits: 5 };
options.onConnect = function() {
    console.log("in onConnect");

    for(index in data_0){
        data_0[index] = data_0[index].toFixed(5)
    }

    console.log(data_0.length);

    var m = 256;
    var n = 330;

    oneD_matrix = [];
    for (i = 0; i < n; i++){
        oneD_matrix.push(jiff_instance.share(data_0[i]));
    }
    // console.log(oneD_matrix)

    for (i = 0; i < n; i++){
        var sum = oneD_matrix[i][1];
        sum = sum.sadd(oneD_matrix[i][2]);
        oneD_matrix[i] = sum.open().then(success, failure);
    }

    Promise.all(oneD_matrix).then(function (results){
        console.log("i'm here")
        console.log(results);
    }, function(err){
        console.log(err)
    })

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
    //         console.log("sharing", i, j, twoD_matrix[i][j])
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

jiff_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", 'test-neural-net', options);
jiff_instance = require('../../lib/ext/jiff-client-bignumber').make_jiff(jiff_instance);
jiff_instance = require('../../lib/ext/jiff-client-negativenumber').make_jiff(jiff_instance, options); // Max bits allowed after decimal.

