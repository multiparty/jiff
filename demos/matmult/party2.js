var jiff_instance;

var options = {party_count: 2};

options.onConnect = function() {
	console.log("in onconnect");
	try {
		var share = jiff_instance.receive_open([2]);
	}
	catch (err){
		console.log(err);
	}
  

  //share.open(function(r) { console.log(r); } );
}

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



options.onConnect = function() {
	count = 90;
	var test_arr = [];

	for (var i = 0; i < 45; i++){
		var test = [count, count + 1];
		test_arr.push(test)
		count = count + 2;
	}

	console.log(test_arr);

	var other_array_row_count = 2;

	product_matrix = [];
	for(var i = 0; i < test_arr[0].length; i++){
		for (var j = 0; j < other_array_row_count; j++){
			console.log(i, getColumn(test_arr, j));
			var shares_2d = jiff_instance.share_vec(getColumn(test_arr, j));

			var results = [shares_2d[0][1].smult(shares_2d[0][2]).open().then(success, failure)];

			for(var k = 1; k < shares_2d.length; k++) {
				console.log(k);
          		var shares = shares_2d[k];
          		var product = shares[1].smult(shares[2]);
          		results.push(product.open().then(success, failure));

        	}
        	product_matrix.push(new Promise(function(resolve, reject) {
			  Promise.all(results).then(function(success_result){
					resolve(success_result.reduce(getSum));
				}, function(failure){
					reject(failure)
				});
        	}));
		}
	}
	Promise.all(product_matrix).then(function(results){
		console.log(results)
	}, failure);
}

jiff_instance = require('../../lib/jiff-client').make_jiff("http://localhost:8080", 'matmult', options);
//jiff_instance = require('../../lib/ext/jiff-client-bignumber.js').make_jiff(jiff_instance, options)

