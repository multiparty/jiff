```neptune[language=javascript,inject=true]
(function () {
  var script = document.createElement('script');
  script.setAttribute('src', '/dist/jiff-client.js');
  document.head.appendChild(script);
}());
```

# Intermediate Programming with JIFF

In the last tutorial, we saw how we can write a simple MPC voting application in JIFF. However, we left a few issues unresolved:

1. Inputs are not sanitized.
2. Output may be very leaky.

#### Tutorial content:
1. Comparison primitives in JIFF: encoding input sanitization under MPC.
2. Control flow and branching under MPC: making the output reveal less.

# Setup

Our setup is similar to the one from the previous tutorial.

```neptune[title=Server,frame=frame1,env=server]
var JIFFServer = require('../../../../../lib/jiff-server.js'); // replace this with your actual path to jiff-server.js
var jiff_instance = new JIFFServer(server, { logs:true });
Console.log('Server is running on port 9111');
```

```neptune[title=Party&nbsp;1,frame=frame1,scope=1]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 3, crypto_provider: true, onConnect: onConnect, Zp: 11 };
var jiff_instance = new JIFFClient('http://localhost:9111', 'voting-application', options);
```

```neptune[title=Party&nbsp;2,frame=frame1,scope=2]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 3, crypto_provider: true, onConnect: onConnect, Zp: 11 };
var jiff_instance = new JIFFClient('http://localhost:9111', 'voting-application', options);
```

```neptune[title=Party&nbsp;3,frame=frame1,scope=3]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 3, crypto_provider: true, onConnect: onConnect, Zp: 11 };
var jiff_instance = new JIFFClient('http://localhost:9111', 'voting-application', options);
```

# Input sanitization

Note that a valid input to our voting application satisifies these two constraints:

1. Single option voting: all values are zero except exactly one.
2. Single vote: the non-zero value has to be exactly one.

Our input sanitization function must therefore check that these two conditions are true.

```neptune[title=Party&nbsp;1,frame=frame2,scope=1]
// shares is an array representing a single party's input shares
function sanityCheck(shares) {
  // first check
  var sum = shares[0];
  for (var i = 1; i < shares.length; i++) {
    sum = sum.sadd(shares[i]);
  }
  var check1 = sum.ceq(1);

  // second check
  var check2 = shares[0].clteq(1);
  for (var j = 1; j < shares.length; j++) {
    check2 = check2.smult(shares[j].clteq(1));
  }

  // logical and is a multiplication
  return jiff_instance.open(check1.smult(check2));
}
```
```neptune[title=Party&nbsp;2,frame=frame2,scope=2]
// shares is an array representing a single party's input shares
function sanityCheck(shares) {
  // first check
  var sum = shares[0];
  for (var i = 1; i < shares.length; i++) {
    sum = sum.sadd(shares[i]);
  }
  var check1 = sum.ceq(1);

  // second check
  var check2 = shares[0].clteq(1);
  for (var j = 1; j < shares.length; j++) {
    check2 = check2.smult(shares[j].clteq(1));
  }

  // logical and is a multiplication
  return jiff_instance.open(check1.smult(check2));
}
```
```neptune[title=Party&nbsp;3,frame=frame2,scope=3]
// shares is an array representing a single party's input shares
function sanityCheck(shares) {
  // first check
  var sum = shares[0];
  for (var i = 1; i < shares.length; i++) {
    sum = sum.sadd(shares[i]);
  }
  var check1 = sum.ceq(1);

  // second check
  var check2 = shares[0].clteq(1);
  for (var j = 1; j < shares.length; j++) {
    check2 = check2.smult(shares[j].clteq(1));
  }

  // logical and is a multiplication
  return jiff_instance.open(check1.smult(check2));
}
```

Note that our implementation of check 1 by itself is not really sufficient to perform the single option voting correctly.
For example, if the inputs were **[10, Prime-9, 0, 0]**, their sum would be **Prime + 1 = 1 (mod Prime)**.

However, since the second check ensures that such invalid inputs are detected. We do not have an issue with negative votes,
since JIFF works in domain [0, prime) by default. To support negative numbers, the client code must use the negative numbers
extension explicitly.

Now we can use the sanityCheck function to determine if inputs are OK!

```neptune[title=Party&nbsp;1,frame=frame3,scope=1]
var options = ['IPA', 'Lager', 'Stout', 'Pilsner'];
var input = [1,0,0,0] // this is ok

function sanitize(input, callback) {
  var promise = jiff_instance.share_array(input); // helper for sharing arrays
  promise.then(function (arrays) {
    var sanity1 = sanityCheck(arrays[1]); // check first party's input and open result
    var sanity2 = sanityCheck(arrays[2]);
    var sanity3 = sanityCheck(arrays[3]);
    Promise.all([sanity1, sanity2, sanity3]).then(function (results) {
      Console.log(results);
      callback((results[0] + results[1] + results[2]) === 3, arrays);
    });
  });
}
sanitize(input, function () {});
```
```neptune[title=Party&nbsp;2,frame=frame3,scope=2]
var options = ['IPA', 'Lager', 'Stout', 'Pilsner'];
var input = [1,0,1,0] // this is not ok

function sanitize(input, callback) {
  var promise = jiff_instance.share_array(input); // helper for sharing arrays
  promise.then(function (arrays) {
    var sanity1 = sanityCheck(arrays[1]); // check first party's input and open result
    var sanity2 = sanityCheck(arrays[2]);
    var sanity3 = sanityCheck(arrays[3]);
    Promise.all([sanity1, sanity2, sanity3]).then(function (results) {
      Console.log(results);
      callback((results[0] + results[1] + results[2]) === 3, arrays);
    });
  });
}
sanitize(input, function () {});
```
```neptune[title=Party&nbsp;3,frame=frame3,scope=3]
var options = ['IPA', 'Lager', 'Stout', 'Pilsner'];
var input = [10,0,0,0] // this is not ok

function sanitize(input, callback) {
  var promise = jiff_instance.share_array(input); // helper for sharing arrays
  promise.then(function (arrays) {
    var sanity1 = sanityCheck(arrays[1]); // check first party's input and open result
    var sanity2 = sanityCheck(arrays[2]);
    var sanity3 = sanityCheck(arrays[3]);
    Promise.all([sanity1, sanity2, sanity3]).then(function (results) {
      Console.log(results);
      callback((results[0] + results[1] + results[2]) === 3, arrays);
    });
  });
}
sanitize(input, function () {});
```

The _share\_array_ function is a JIFF helper that allows sharing of arrays easily. The lengths of the arrays
are communicated implicitly first, and then each element in each array is shared according to JIFF's share function.

In the actual application, instead of outputing the result of the sanity, the code should check if all inputs are sane,
then proceed to execute the actual protocol.

Finally, JIFF is secure only against semi-honest parties. A cheating party that is incentivized to act maliciously can still
cheat by deviating from the protocol (i.e. running a different piece of code, denial of service).

# Control Flow and Branching

The output of the vote remains too granular. Therefore, it has a risk of leaking too much about the inputs. However,
in this scenario, all what we are really interested about is learning the winner, but not the entire vote tally.

We can re-configure the MPC code to compute the tally, then check for which option is the winner, and output only that.
```neptune[title=Party&nbsp;1,frame=frame4,scope=1]
var options = ['IPA', 'Lager', 'Stout', 'Pilsner'];
var input = [1,0,0,0] // this is ok

function findWinner(valid, arrays) {
  if (!valid) {
    Console.log('invalid inputs');
    return;
  }

  var tally = arrays[1];
  for (var party = 2; party <= jiff_instance.party_count; party++) {
    for (var option = 0; option < options.length; option++) {
      tally[option] = tally[option].sadd(arrays[party][option]);
    }
  }

  var winner = 0; // find winner by finding the max tally
  var max = tally[0];
  for (var i = 1; i < tally.length; i++) {
    var iIsMax = tally[i].sgt(max);
    max = iIsMax.if_else(tally[i], max);
    winner = iIsMax.if_else(i, winner);
  }

  jiff_instance.open(winner).then(function (winner) {
    Console.log(options[winner]);
  });
}

sanitize(input, findWinner);
```
```neptune[title=Party&nbsp;2,frame=frame4,scope=2]
var options = ['IPA', 'Lager', 'Stout', 'Pilsner'];
var input = [0,1,0,0] // this is ok

function findWinner(valid, arrays) {
  if (!valid) {
    Console.log('invalid inputs');
    return;
  }

  var tally = arrays[1];
  for (var party = 2; party <= jiff_instance.party_count; party++) {
    for (var option = 0; option < options.length; option++) {
      tally[option] = tally[option].sadd(arrays[party][option]);
    }
  }

  var winner = 0; // find winner by finding the max tally
  var max = tally[0];
  for (var i = 1; i < tally.length; i++) {
    var iIsMax = tally[i].sgt(max);
    max = iIsMax.if_else(tally[i], max);
    winner = iIsMax.if_else(i, winner);
  }

  jiff_instance.open(winner).then(function (winner) {
    Console.log(options[winner]);
  });
}

sanitize(input, findWinner);
```
```neptune[title=Party&nbsp;3,frame=frame4,scope=3]
var options = ['IPA', 'Lager', 'Stout', 'Pilsner'];
var input = [0,0,1,0] // this is ok

function findWinner(valid, arrays) {
  if (!valid) {
    Console.log('invalid inputs');
    return;
  }

  var tally = arrays[1];
  for (var party = 2; party <= jiff_instance.party_count; party++) {
    for (var option = 0; option < options.length; option++) {
      tally[option] = tally[option].sadd(arrays[party][option]);
    }
  }

  var winner = 0; // find winner by finding the max tally
  var max = tally[0];
  for (var i = 1; i < tally.length; i++) {
    var copy = max; // just for logging

    var iIsMax = tally[i].sgt(max);
    max = iIsMax.if_else(tally[i], max);
    winner = iIsMax.if_else(i, winner);

    // logging
    Console.log('iteration', i, winner.toString());
    max.wThen(function (i, copy, max) {
      Console.log('iteration', i, 'new max', max.value, 'new option', tally[i].value, 'old max', copy.value);
    }.bind(null, i, copy, max));
  }

  jiff_instance.open(winner).then(function (winner) {
    Console.log(options[winner]);
  });
}

sanitize(input, findWinner);
```

Branching statements and conditional are problematic under MPC. A traditional if-else statement inherently leaks
the result of condition, since that can be learned by observing which instructions / branch is executed.

MPC implementations of such statements operate differently. All possible branches are executed concurrently, and
the condition is used to select which of the branches to keep, and which to throw away. This choice must be done
obliviously. Chosen values must be re-randomized so that syntactic comparisons cannot detect which values were chosen.

JIFF's _if\_else_ function implements such an oblivious choice. Given two parameters, if the condition is equal to 1,
the first parameter is returned, otherwise the second parameter is returned. Looking at the third party's output,
the log statements demonstrate that JIFF re-randomizes the secret shares returned by the if_else statement. This is a side
effect of how if\_else is internally implemented.

Finally, _if\_else_ can operate on SecretShare as well as public constant parameters for ease of use.

The internal implementation of if\_else relies on the following mathematical expression.

```neptune[title=If&nbsp;Else,frame=frame5,scope=NONE]
condition.if_else = function (opt1, opt2) {
  var not = condition.cmult(-1).cadd(1); // 1 - c = not c
  var v1 = condition.smult(opt1); // opt1 if condition = 1, 0 if condition = 0
  var v2 = not.smult(opt2); // opt 2 if condition = 0, 0 if condition = 1
  return v1.sadd(v2);
}

// optimized
condition.if_else = function (opt1, opt2) {
  // assume condition is false, if it is not, correct the result!
  // if condition = 1 => opt2 + 1 * (opt1 - opt2) = opt1
  // if condition = 0 => opt2 + 0 * (opt1 - opt2) = opt2
  return opt2.sadd(condition.smult(opt1.ssub(opt2)));
}
```

# Other Primitives

JIFF provides many primitives and protocols built-in. A list of all such primitives and their costs in terms of rounds of communication and
total bandwidth, is available in the JIFF jsdocs.

As a rule of thumb, version of operations that operate on public constant are always cheaper than their counterparts that operates on secret.

For example, _cmult_ which multiplies a SecretShare by a public constant requires no communication, while _smult_ which multiplies two SecretShares
requires one round of online communication and one round in preprocessing.

Comparison and inequality operations, as well as division and bit operations, require rounds of communcation proportional to the number of bits
in the prime (i.e. log of the size of the domain), the exact constants and relationship varies by operation. Other relevant parameters include
the number of parties, the precision (in case of fixedpoint numbers), error probability, and the size of inputs, etc..

These differences in MPC operations that are similar cost-wise without MPC leads to interesting tradeoffs and algorithmic choices.

