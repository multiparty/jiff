# What is Preprocessing?
In general, MPC is much slower than standard computation - mostly due to communication costs between parties. While some operations are free (meaning they only rely on local computation), such as secure addition, other operations (e.g. secure multiplication) incur high communication costs. Specifically for multiplication, the protocol used in JIFF relies on helper values of a certain form, called beaver triples (a,b,c such that a\*b=c). In JIFF, preprocessing of beaver triples is accomplished via multiplication with the BGW protocol.

While preprocessing still incurs communication costs, it can ideally be executed before data is ready to be shared or before all parties online, which leads to a faster online phase.

#### Tutorial content:
1. Basic pre-processing workflow
2. Pre-processing for an inner product (based on the previous tutorial)
4. Delegating preprocessing to a subset of parties
5. Consequences of not preprocessing
6. List of JIFF primitives that require pre-processing

# How to Use Preprocessing in JIFF
The `jiff.preprocessing()` exists to preprocess any values needed for later computation. All preprocessing needs to know is which operations will be performed and how many times, so the programmer does not need to know what other protocols or values those depend on.

The basic preprocessing workflow looks like this
```javascript
jiff.preprocessing(<operation>, <number of calls>, <optional params>);

// this takes a callback to the main phase of computation
jiff.onFinishPreprocessing(start_compute);

var start_compute = function() {
/*
 * Main phase of computation...
 */
};
```
Now let's look at a concrete example:

# Setup

Most our preprocessing protocols assume an honest majority (i.e. based on BGW). Therefore, we cannot provide meaningful security
for two parties, and we must have three or more parties. In the case where we have only two parties, the use of the server as a crypto\_provider
is equivalent to having an honest majority computation between three parties, one of which is the server.

Our setup is similar to previous tutorials.

```neptune[title=Server,frame=frame1,env=server]
var jiff = require('../../../../../lib/jiff-server.js');
var jiff_bignumber = require('../../../../../lib/ext/jiff-server-bignumber.js');

var jiff_instance = jiff.make_jiff(server, { logs:true });
jiff_instance.apply_extension(jiff_bignumber);

Console.log('Server is running on port 9111');
```

```neptune[title=Party&nbsp;1,frame=frame1,scope=1]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 3, party_id: 1, onConnect: onConnect, Zp: 15485867, autoConnect: false, integer_digits: 3, decimal_digits: 2 };
var jiff_instance = jiff.make_jiff('http://localhost:9111', 'preprocessing-application', options);
jiff_instance.apply_extension(jiff_bignumber, options);
jiff_instance.apply_extension(jiff_fixedpoint, options);
jiff_instance.connect();
```

```neptune[title=Party&nbsp;2,frame=frame1,scope=2]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 3, party_id: 2, onConnect: onConnect, Zp: 15485867, autoConnect: false, integer_digits: 3, decimal_digits: 2 };
var jiff_instance = jiff.make_jiff('http://localhost:9111', 'preprocessing-application', options);
jiff_instance.apply_extension(jiff_bignumber, options);
jiff_instance.apply_extension(jiff_fixedpoint, options);
jiff_instance.connect();
```

```neptune[title=Party&nbsp;3,frame=frame1,scope=3]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 3, party_id: 3, onConnect: onConnect, Zp: 15485867, autoConnect: false, integer_digits: 3, decimal_digits: 2 };
var jiff_instance = jiff.make_jiff('http://localhost:9111', 'preprocessing-application', options);
jiff_instance.apply_extension(jiff_bignumber, options);
jiff_instance.apply_extension(jiff_fixedpoint, options);
jiff_instance.connect();
```

# Preprocessing for inner product
Remember our efficient inner product protcol from the previous tutorial.

```neptune[title=Party&nbsp;1,scope=1,frame=frame2]
function innerprod(input) {
  var promise = jiff_instance.share_array(input, null, 3, [1, 2, 3], [1, 2]);
  return promise.then(function (arrays) {
    var array1 = arrays[1];
    var array2 = arrays[2];

    var result = array1[0].smult(array2[0], null, false);
    for (var i = 1; i < array1.length; i++) {
      result = result.sadd(array1[i].smult(array2[i], null, false));
    }

    return jiff_instance.open(result);
  });
}
```

```neptune[title=Party&nbsp;2,scope=2,frame=frame2]
function innerprod(input) {
  var promise = jiff_instance.share_array(input, null, 3, [1, 2, 3], [1, 2]);
  return promise.then(function (arrays) {
    var array1 = arrays[1];
    var array2 = arrays[2];

    var result = array1[0].smult(array2[0], null, false);
    for (var i = 1; i < array1.length; i++) {
      result = result.sadd(array1[i].smult(array2[i], null, false));
    }

    return jiff_instance.open(result);
  });
}
```

```neptune[title=Party&nbsp;3,scope=3,frame=frame2]
function innerprod(input) {
  var promise = jiff_instance.share_array(input, null, 3, [1, 2, 3], [1, 2]);
  return promise.then(function (arrays) {
    var array1 = arrays[1];
    var array2 = arrays[2];

    var result = array1[0].smult(array2[0], null, false);
    for (var i = 1; i < array1.length; i++) {
      result = result.sadd(array1[i].smult(array2[i], null, false));
    }

    return jiff_instance.open(result);
  });
}
```

Note that we have n multiplications and additions under MPC, as well as a single open at the end. Additions do not require preprocessing as they do not need communication. But
the other primitives do too.

Additionally, if we use the default parameters, JIFF will assume that the multiplications we are attempting to preprocess for include a constant division at the end, since that
is the default behavior. However, we can customize that using the extra optional parameters.

```neptune[title=Party&nbsp;1,frame=frame3,scope=1]
var input = [1.32, 10.22, 5.67];

// preprocessing happens first
jiff_instance.preprocessing('smult', input.length, null, null, null, null, null, null, null, {div: false});
jiff_instance.preprocessing('open', 1);

// call main phase of computation
jiff_instance.onFinishPreprocessing(function () {
  innerprod(input).then(function (result) {
    Console.log('Inner product', result.div(100)); // shift decimal point outside of MPC
    Console.log('Verify', 1.32*5.91 + 10.22*3.73 + 5.67*50.03);
  });
});

```

```neptune[title=Party&nbsp;2,frame=frame3,scope=2]
var input = [5.91, 3.73, 50.03];

// preprocessing happens first
jiff_instance.preprocessing('smult', input.length, null, null, null, null, null, null, null, {div: false});
jiff_instance.preprocessing('open', 1);

// call main phase of computation
jiff_instance.onFinishPreprocessing(function () {
  innerprod(input).then(function (result) {
    Console.log('Inner product', result.div(100)); // shift decimal point outside of MPC
    Console.log('Verify', 1.32*5.91 + 10.22*3.73 + 5.67*50.03);
  });
});

```

```neptune[title=Party&nbsp;3,frame=frame3,scope=3]
var input = [null, null, null]; // 3rd party has no input

// preprocessing happens first
jiff_instance.preprocessing('smult', input.length, null, null, null, null, null, null, null, {div: false});
jiff_instance.preprocessing('open', 1);

// call main phase of computation
jiff_instance.onFinishPreprocessing(function () {
  innerprod(input).then(function (result) {
    Console.log('Inner product', result.div(100)); // shift decimal point outside of MPC
    Console.log('Verify', 1.32*5.91 + 10.22*3.73 + 5.67*50.03);
  });
});

```

# Asymmetric preprocessing

In the example above, all parties are involved in preprocessing as well as main computation, this is not always going to be the case.

Some of the machines may always be online, but others may come online just before a computation starts. In this case we can have the group of servers that is always online perform all the necessary pre-processing before the other servers come online and then share the values as soon as they connect.

```neptune[title=Asymmetry,frame=frame5,env=None]
// define what operations we need to preprocess for, and how many of each
var operations = {'smult': 100, 'slt': 100};

// define a receviers list, which parties will receive the preprocessed values (all for now)
var receivers = [];
for (var p = 1; p <= jiff_instance.party_count; p++) {
  receivers.push(p);
}

// define the compute list, which parties will participate in the preprocessing
// we'll say parties 1, 2, and 3 are always online
var compute_parties = ['1', '2', '3']

for (var op in operations) {
  // we'll leave the 'batch', 'protocols', and 'threshold' parameters null for now
  // and let JIFF use the defaults
  jiff_instance.preprocessing(op, operations[op], null, null, null, receivers, compute_parties)
}
jiff_instance.onFinishPreprocessing(start_compute);
```

This way, all of the values that multiplications and comparisons rely on will be created and distributed before the start of any computation.

By specifying the receivers as all parties, we tell JIFF to reshare all the helper values at the end with everyone, not just the three servers that helped generate the values.

While we can definitely handle preprocessing for 100 multiplications and 100 comparisons, if we are doing thousands of each we may run out of memory from passing and
storing so many messages and promises. Depending on the memory constraints of the systems we are using - we can configure JIFF preprocessing to batch the preprocessing
computation to avoid any memory issues. This is what the `batch` parameter is for, we specify the number of operations to preprocess for concurrently before stopping and
cleaning up the promises and messages to save memory.

Generally memory and performance constraints are much tighter when running in a browser, if all parties are running JIFF in node.js you are less likely to run out of memory.

Let's say we are preparing for 5000 multiplications, we may want to perform this in batches of 100:

```neptune[title=Batching,frame=frame6,env=NONE]
jiff_instance.preprocessing('smult', 5000, 100, null, null, receivers, compute_parties)
```

# What If We Don't Preprocess anything?

In the case that JIFF tries to perform an operation which needs preprocessing, but none has been performed - the default behavior is to fail:

```sh
 UnhandledPromiseRejectionWarning: Error: No preprocessed value(s)
that correspond to the op_id "smult:1,2:0:triplet"
```

The other option is to have the server (which may also be a part of the computation) provide values to all parties for the operations, which happens at the time of computation.
This can be configured when creating a jiff instance by setting the `crypto_provider` option to true:
```neptune[title=Crypto&nbsp;Provider,frame=frame7,env=server]
var jiff_instance = jiff.make_jiff(server_address, 'comp_id', {'crypto_provider': true} );
```

If no operations preprocessed for, the server will be queried for anything that requires it. If some operations were specified for preprocessing,
but later more operations were added and there are not enough preprocessed values, the server will be queried for any operations that happen after
the parties have run out of preprocessed values.

While this allows you to get values such as beaver triples just-in-time, it also requires that you trust the coordinating server to generate
these values fairly and honestly, which may or may not be part of your logistical assumptions. It is recommended that you pre-process for
all operations that you anticipate performing.


# Which Operations Require Preprocessing

As mentioned earlier, not all operations on secret shares require pre-processing. For example, secure addition and secure subtraction require
only local computation and don't need any helper values. Below is a table of all JIFF secret-share protocols that require preprocessing:

*smult*,
*sdiv*,
*sxor_bit*,
*slt*,
*cgt*,
*clt*,
*clt_bits*,
*cdiv*,
*smod*,
*if_else*,
*sor_bit*,
*slteq*,
*sgteq*,
*sgt*,
*clteq*,
*cgteq*,
*seq*,
*sneq*,
*ceq*,
*cneq*,
*open*,
*if_else*

