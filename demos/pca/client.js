function connect() {
  $('#connectButton').prop('disabled', true);
  var computation_id = $('#computation_id').val();
  var party_count = parseInt($('#count').val());

  if(isNaN(party_count)) {
    $("#output").append("<p class='error'>Party count must be a valid number!</p>");
    $('#connectButton').prop('disabled', false);
  } else {
    var options = {
      party_count: party_count,
      Zp: new BigNumber(32416190071),
      offset: 100000,
      bits: 8,
      digits: 2
    };
    options.onError = function(error) { $("#output").append("<p class='error'>"+error+"</p>"); };
    options.onConnect = function() { $("#button").attr("disabled", false); $("#output").append("<p>All parties Connected!</p>"); };
    
    var hostname = window.location.hostname.trim();
    var port = window.location.port;
    if(port == null || port == '') 
      port = "80";
    if(!(hostname.startsWith("http://") || hostname.startsWith("https://")))
      hostname = "http://" + hostname;
    if(hostname.endsWith("/"))
      hostname = hostname.substring(0, hostname.length-1);
    if(hostname.indexOf(":") > -1 && hostname.lastIndexOf(":") > hostname.indexOf(":"))
      hostname = hostname.substring(0, hostname.lastIndexOf(":"));

    hostname = hostname + ":" + port;
    mpc.connect(hostname, computation_id, options);
  }
}

function handleResult(result) {
  $("#output").append("<p>Result is: " + result + "</p>");
  $("#button").attr("disabled", false);
}

function pca() {

    var in1 = parseInt($("#number1").val());
    var in2 = parseInt($("#number2").val());
    var in3 = parseInt($("#number3").val());

    var input = [in1, in2, in3];

    if(isNaN(in1))
        $("#output").append("<p class='error'>Input a valid number!</p>");
    else if(100 < input || input < 0 || input != Math.floor(input))
        $("#output").append("<p class='error'>Input a WHOLE number between 0 and 100!</p>");
    else if(jiff_instance == null || !jiff_instance.ready)
        alert("Please wait!");
    else
        MPC(input);
}

// pca_sum = []

/**
 *
 * @param items An array of items.
 * @param fn A function that accepts an item from the array and returns a promise.
 * @returns {Promise}
 */
function forEachPromise(items, fn) {
    return items.reduce(function (promise, item) {
        return promise.then(function () {
            return fn(item);
        });
    }, Promise.resolve());
}

function logItem(item) {
    return new Promise(function(resolve, reject) {
        process.nextTick(function(item) {
            console.log(item);
            resolve();
        })
    });
}

//var arr_sum = [];
//var arr = [Math.floor(Math.random() * 10),Math.floor(Math.random() * 10),Math.floor(Math.random() * 10)];

function subtractArrays(arr1, arr2){
    result = [];
    for (var i = 0; i < arr1.length; i++){
        result.push(arr1[i] - arr2[i]);
    }
    return result;
}

function print2DArray(arr){
    result = "";
    arr.map(function(row){
        // result += `[${row}] <br>`;
        result += row;
    });
    return result;
}

function MPC(arr) {
    var arr_sum = [];

    $("#PCAButton").attr("disabled", true);
    $("#output").append("<p>Starting...</p>");
    // $("#arr").html("Random array is: " + arr);

    arr.map(function(item){
        var shares = jiff_instance.share(item);
        var sum = shares[1];
        for(var i = 2; i <= jiff_instance.party_count; i++){
            sum = sum.add(shares[i]);
        }
        arr_sum.push(sum.open_to_promise().then(success, failure));
    });

    Promise.all(arr_sum).then(function(results){
        var mean = results.map(function(item){
            return item/jiff_instance.party_count;
        });

        //arr = math.matrix(arr);
        //mean = math.matrix(mean);
        console.log("local arr = " + arr);
        diff = [subtractArrays(arr, mean)];


        diff_T = numeric.transpose(diff);
        console.log("arr = " + arr);
        console.log("mean = " + mean);
        console.log(diff);
        console.log(diff_T);

        $("#output").append("<p>Calculated the mean as" + mean + "</p>");
        $("#output").append("<p>Calculated the difference between this party's array and the mean as" + diff + "</p>");


        var scatter = numeric.dot(diff_T, diff);

        console.log("local scatter:");
        console.log(scatter);
        // $("#output").append("<p>Calculated the local scatter as</p> <div>${print2DArray(scatter)}</div>");
        $("#output").append("<p>Calculated the local scatter as" + print2DArray(scatter) + "</p>");
        // console.log("go element by element");
        // for(var row of scatter){
        //   for(var value of row){
        //     console.log(value);
        //   }
        // }

        $("#output").append("<p>Now calculate the global scatter (sum of locals)</p>");
        console.log("begin calculating scatter sum")
        scatter_sum = [];
        scatter.map(function(row){

            scatter_sum.push(new Promise(function(resolve, reject) {
                console.log("sharing row = " + row);
                row_sum = [];
                row.map(function(item){
                    console.log("sharing item = " + item)
                    var shares = jiff_instance.share(item);
                    var sum = shares[1];
                    for(var i = 2; i <= jiff_instance.party_count; i++){
                        sum = sum.add(shares[i]);
                    }
                    row_sum.push(sum.open_to_promise().then(success, failure));
                });

                Promise.all(row_sum).then(function(results){
                    console.log("this row is done = " + results);
                    resolve(results);
                });



            }).then(success, failure));

            results.open(handleResult); // Added by Rachel to output result 6/6



        });

        Promise.all(scatter_sum).then(function(results){
            console.log("scatter_sum computed = ");
            console.log(results);

            console.log("scatter_sum eig = ");
            var eig = numeric.eig(results);
            var eig_copy = Object.assign({}, eig);
            console.log(eig);
            console.log("find the two largest eigenvalues");
            var sorted_eigen_values = eig_copy.lambda.x.sort().reverse().slice(0,2);
            console.log("two largest eigen values = " + sorted_eigen_values);
            var corresponding_largest_eigenvectors = []
            sorted_eigen_values.map(function(item){
                corresponding_largest_eigenvectors.push(eig.E.x[eig.lambda.x.indexOf(item)])
            });
            corresponding_largest_eigenvectors = numeric.transpose(corresponding_largest_eigenvectors);
            console.log("corresponding eigenvectors:");
            console.log(corresponding_largest_eigenvectors);

            var result = numeric.dot(numeric.transpose(corresponding_largest_eigenvectors), arr);
            console.log("the result is:");
            console.log(result);

            //$("#output").append(`<p>Calculated the global scatter as</p> <div>${print2DArray(results)}</div>`);

            //$("#output").append(`<p>Eigenvalues = ${eig.lambda.x}</p>`);
            //$("#output").append(`<p>Eigenvectors = ${print2DArray(eig.E.x)}</p>`);

            //$("#output").append(`<p>2 largest eigenvalues = ${sorted_eigen_values}</p>`);

            //$("#output").append(`<p>Eigenvectors corresponding to 2 largest eigenvalues = ${print2DArray(corresponding_largest_eigenvectors)}</p>`);
            //$("#output").append(`<p>Result = ${result}</p>`);

            $("#output").append("<p>Calculated the global scatter as" + print2DArray(results) + "</p>");

            $("#output").append("<p>Eigenvalues = " +  eig.lambda.x + "</p>");
            $("#output").append("<p>Eigenvectors = " + print2DArray(eig.E.x) + "</p>");

            $("#output").append("<p>2 largest eigenvalues = " + sorted_eigen_values + "</p>");

            $("#output").append("<p>Eigenvectors corresponding to 2 largest eigenvalues = " + print2DArray(corresponding_largest_eigenvectors) + "</p>");
            $("#output").append("<p>Result = " + result + "</p>");

        });
        //console.log(scatter.array());
        //console.log(numeric.eig(scatter));
    });
}

function success(result) {
    console.log("success, result = " + result);
    return result;
}

function failure(error){
    console.error("failure, error = " + error);
}


