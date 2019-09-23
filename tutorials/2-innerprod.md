In this tutorial, we'll look at an example implementation of the inner product. We'll start with a basic version, then extend it to support fixed-point numbers, optimize it under the constraints of MPC, and prepare to scale better. This tutorial implements the 2-party version for simplicity, but the techniques exend to aribtrary parties.

# Setting up a server
We're going to stick with our simple server-as-message-router model from before. The server.js file will look the same as in the [intro tutorial](/tutorials/1-intro.md).

# Implementing client code
In this setting, we want to compute an inner product. Each party has an input vector, and will receive an integer as output. As before, the client program has two jobs: they connect to the server, and they work together to compute the inner product under MPC.

## Connecting to the server
In the file `client.js`, we start by connecting to the server. First, we define the `hostname` that the server above is running on. Second, since this is a multi-party computation, we need to tell the server how many parties there are (`party_count`), and the name of our computation(`computation_id`).

The `make_jiff` function uses this information to set up a new JIFF object.
We save the fully configured `jiff_instance` in a global variable, so we can use it when we compute our function.

```javascript
var jiff_instance;

function connect() {

  var hostname = "http://localhost:8080";

  var computation_id = 'inner_product';
  var options = {party_count: 2};

  // TODO: is this necessary if we're using npm?
  if (node) {
    jiff = require('../../lib/jiff-client');
    $ = require('jquery-deferred');
  }

  jiff_instance = jiff.make_jiff(hostname, computation_id, options);
}
```

## Computing an inner product
Once those details are taken care of, we can define the interesting part of the computation. The function outline shares our (hard-coded) input values, executes some computation, and logs the result when it is ready. Again, in `client.js`:

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

The first step is to share our input with the rest of the parties. We use our saved and configured `jiff_instance` to do so. This operation is asynchronous—it requires communicating with every party to secret share the data—so it returns a promise.

We pass our input array and the length. In this case, all party inputs have the same, public length, and they're all providing the same type of input. These items are customizable; we'll look at an example later. TODO: link tutorial with different inputs or something

```javascript
  var array_promise = jiff_instance.share_array(input, input.length);
```

Once everyone's input is shared, we'll compute the inner product. The promise returns an object containing the shares from every party in an object. It has the form
```
{1 : [<party 1's array>], 2 : [<party 2's array>] }
```

The inner product takes the sum of the pairwise product of array elements.
```javascript
array_promise.then( function (shares) {

  // pairwise product
  var products = shares[1];
  for (var i = 0; i < products.length; i++) {
    products[i] = products[i].smult(shares[2][i]);
  }

  // sum
  var sum = products[0];
  for (var i = 1; i < products.length; i++) {
    sum = sum.sadd(products[i]);
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
      products[i] = products[i].smult(shares[2][i]);
    }

    var sum = products[0];
    for (var i = 1; i < products.length; i++) {
      sum = sum.sadd(products[i]);
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

# Using the fixed point extension
Our inner product code works fine with integers. However, many interesting applications in statistics, machine learning, and other domains require operations on real numbers.
The JIFF framework includes extensions which provide additional functionality. We'll use the `fixedpoint` extension (which extends the client behavior), and which depends on `bignumber`s (which extend both client and server behavior).

We need to tell both the server and the client where to find the extension code. On the `server.js` side, we'll save our JIFF `base_instance`, then apply the `bignumber` extension. We'll also tell the server where to find the correct JIFF files. We update `server.js`:

```javascript
var base_instance = require('../../lib/jiff-server').make_jiff(http, { logs:true });

var jiffBigNumberServer = require('../../lib/ext/jiff-server-bignumber');
base_instance.apply_extension(jiffBigNumberServer);

app.use('/bignumber.js', express.static('node_modules/bignumber.js'));
```

On the client side, we need to include and apply both `fixedpoint` and `bignumber`. In `client.js`:

```javascript
exports.connect = function () {
  // set up hostname, computation id, options
  ...
  // find and apply extensions
  if (node) {
    jiff = require('../../lib/jiff-client');
    jiff_bignumber = require('../../lib/ext/jiff-client-bignumber');
    jiff_fixedpoint = require('../../lib/ext/jiff-client-fixedpoint');
  }

  opt.autoConnect = false;
  jiff_instance = jiff.make_jiff(hostname, computation_id, opt);
  jiff_instance.apply_extension(jiff_bignumber, opt);
  jiff_instance.apply_extension(jiff_fixedpoint, opt);
  jiff_instance.connect();

  return jiff_instance;
};
```

Happily, the fixed point extension reimplements the existing `sadd` and `smult` functions, so the client `compute` function doesn't change at all.
TODO is this correct?

Now we can run the inner product with fixed point (or a mix of fixed point and integer) inputs!

## Under the hood: optimizing for MPC
Our computation works great with fixed point data, but maybe it's running a litle slower than we'd like. By optimizing the MPC operations, we can reduce the total amount of work being performed.

For example, the inner product requires many multiplications of fixed point numbers. In JIFF, to multiply two fixed point numbers `a` and `b`, we multiply them normally, then divide by the total magnitude `m`.

1. `result` = `a` * `b`
2. `result` = `result` / `m`

Since `m` is a constant, we need to use the constant division `cdiv` function. This is relatively expensive: it takes `2*(bits+3) + 5` rounds of communication and 3 elements of preprocessing data. (Compare this in the [cost of operations](https://github.com/multiparty/jiff#costs-of-operations) table).
TODO update this to new table location

The inner product is the sum of a large number of pairwise fixed-point multiplications. We can use the associative property to "pull out" the division step. Let `m` be the magnitude and `[a1,...an]`, `[b1,...,bn]` be our two parties' input values.
```
(a1 * b1) / m + (a2 * b2) / m + ... + (an * bn) / m = (a1 * b1 + a2 * b2 + ... + an * bn) / m
```

Let's look at the current version of the inner product:
```javascript
var products = shares[1];
for (var i = 0; i < products.length; i++) {
  products[i] = products[i].smult(shares[2][i]);
}

var sum = products[0];
for (var i = 1; i < products.length; i++) {
  sum = sum.sadd(products[i]);
}
```

The `smult` operation has an optional second parameter. If we set it to false, it will skip the division step.

```javascript
var products = shares[1];
for (var i = 0; i < products.length; i++) {
  products[i] = products[i].smult(shares[2][i], false);
}
```

Then we can compute the magnitude and divide after the addition. We use the legacy `cdiv` function, since we're using it to manually move the location of the decimal point—we don't want to use the special fixed-point version of `cdiv`, which will move the decimal for us.
```javascript
var sum = products[0];
for (var i = 1; i < products.length; i++) {
  sum = sum.sadd(products[i]);
}

var magnitude = sum.jiff.helpers.magnitude(sum.jiff.decimal_digits);
sum = sum.legacy.cdiv(magnitude);
```

This reduces the number of `cdiv` operations by an order of magnitude!

TODO: I haven't been able to test this becasue every line with an `smult(..., false)` throws a million errors with mocha.

## Scaling up: controlling memory usage
TODO: Not sure what kinan wants here

# Next steps
There are a few messy things here. Client-specific variables, like our private input values, are hardcoded in, so each party will have to manually change the code. In the XXX tutorial, we'll show how to connect the client to a webpage, which makes it much easier for clients to change these data.



