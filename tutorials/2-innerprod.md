


# Install Docker


# Setting up a simple server
We're going to stick with our simple server-as-message-router model from before. The `express` package provides a web framework, which we configure as an `http` server running locally on port 8080.

```javascript
var express = require('express');
var app = express();
var http = require('http').Server(app);

http.listen(8080, function() {
  console.log('listening on localhost:8080');
});
```

# Implementing the client code
In this setting, we want to compute an inner product. Each party has an input vector, and will receive an integer as output. As before, the client program has two jobs: they connect to the server, and they work together to compute the inner product under MPC. 

## Connecting to the server 
In the file `client.js`, we start by connecting to the server. First, we define the `hostname` that the server above is running on. Second, since this is a multi-party computation, we need to tell the server how many parties there are (`party_count`), and which one we are (`computation_id`). 

The `make_jiff` function uses this information to set up a new JIFF object.
We save the fully configured `jiff_instance` in a global variable, so we can use it when we compute our function.

```javascript
var jiff_instance; 

function connect() {

  // TODO: is this the correct hostname?
  var hostname = "http://localhost:8080";

  var computation_id = 1; 
  var options = {party_count: 2}; 

  // TODO: does this need if we're using npm?
  if (node) {
    jiff = require('../../lib/jiff-client');
    $ = require('jquery-deferred');
  }

  jiff_instance = jiff.make_jiff(hostname, computation_id, options);
}
```

## Computing an inner product
Once those details are taken care of, we can define the interesting part of the computation. The function outline shares our (hard-coded) input values, executes some computation, and logs the result when it is ready.

```javascript
function compute() {
  var input = [1, 2, 3, 4, 5];

  // share inputs
  ...

  // compute inner product
  ...

  // print results
  ...
}
```

The first step is to share our input with the rest of the parties. We use our saved and configured `jiff_instance` to do so. This operation is asynchronous--it requires communicating with every party to secret share the data--so it returns a promise.

We pass our input array and the length. In this case, all party inputs have the same, public length, and they're all providing the same type of input. These items are customizable; we'll look at an example later. TODO: link tutorial with different inputs or something

```javascript
  var array_promise = jiff_instance.share_array(input, input.length);
```

Once everyone's input is shared, we'll compute the inner product. The promise returns the shares from every party in an object. It has the form
```
{1 : <party 1's array>, 2 : <party 2's array> }
```

The inner product takes the sum of the pairwise product of array elements.
```javascript
array_promise.then( function (shares) {

  // pairwise product
  var products = shares[1];
  for (var i = 0; i < products.length; i++) {
    products[i] = products[i].smult( shares[2][i] );
  }

  // sum
  var sum = products[0];
  for (var i = 1; i < products.length; i++) {
    sum = sum.sadd( products[i] );
  }

});
```

Finally, we need to reveal the results to each party. We use the JQuery deferred function to resolve the results from all parties and reveal them correctly. We set this up before our promise and return it afterward. Our complete `compute` function looks like this:

```javascript
function compute() {

  // share inputs
  var input = [1, 2, 3, 4, 5];
  var array_promise = jiff_instance.share_array(input, input.length);

  var deferred = $.Deferred();

  array_promise.then( function (shares) {

    // compute inner product
    var products = shares[1];
    for (var i = 0; i < products.length; i++) {
      products[i] = products[i].smult( shares[2][i] );
    }

    var sum = products[0];
    for (var i = 1; i < products.length; i++) {
      sum = sum.sadd( products[i] );
    }

    // open the array
    jiff_instance.open(sum).then(function (results) {
      deferred.resolve(results);
    });
  });

  // print results
  deferred.promise().then( function (result) {
    console.log("inner product: ", result);
  });
}
```

TODO Add something about running and testing?!

## Using the floating point extension

## Under the hood: optimizing for MPC

## Scaling up: controlling memory usage

# Next steps
There are a few messy things here. Client-specific variables, like our compuation ID and private input values, are hardcoded in, so each party will have to manually change the code. In the XXX tutorial, we'll show how to connect the client to a webpage, which makes it much easier for clients to change these data.



