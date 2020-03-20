```neptune[language=javascript,inject=true]
(function () {
  var script = document.createElement('script');
  script.setAttribute('src', '/dist/jiff-client.js');
  document.head.appendChild(script);
}());
```

# Standard Deviation under MPC

This tutorial gives some intuition on how to select the best protocol for a given task. In particular, how to optimize
an MPC application by **doing less MPC**.

In this tutorial, we have several parties, each possessing a number. The parties want to compute the average and standard
deviation under MPC, without leaking anything else.

#### Tutorial content:
1. Handling negative numbers.
2. Computing the average under MPC.
3. Selecting the appropriate protocol for standard deviation.
4. Standard deviation under MPC

# Setup: negative numbers extension

By default, JIFF operates over numbers in the domain [0, prime). JIFF provides extensions for dealing
with negative numbers, fixedpoint numbers, and both.

We will setup our tutorial to use the negative number extension. This extension shifts the domain by floor(prime / 2),
such that the domain becomes [-floor(prime)/2, floor(prime/2)). It is important that we choose a prime that is large enough
to fit the desired output (and certain intermediate values). Otherwise, we will get a value that is equal to the desired output
mod prime, not in actual value.

Due to properties of finite field arithmetic mod prime, we do not have to worry about intermediate values getting too large, assuming
our operations consists of additions, subtractions, and multiplications. However, other JIFF operations are not so nice over fields.
All comparisons, bit operations, and integer division will give incorrect values if their intermediate inputs are too large.


```neptune[title=Server,frame=frame1,env=server]
var JIFFServer = require('../../../../../lib/jiff-server.js'); // replace this with your actual path to jiff-server.js
var jiff_instance = new JIFFServer(server, { logs:true });
Console.log('Server is running on port 9111');
```

```neptune[title=Party&nbsp;1,frame=frame1,scope=1]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 4, party_id: 1, crypto_provider: true, onConnect: onConnect, autoConnect: false };
var jiff_instance = new JIFFClient('http://localhost:9111', 'deviation-application', options);
jiff_instance.apply_extension(jiff_negativenumber, options);
jiff_instance.connect();
```

```neptune[title=Party&nbsp;2,frame=frame1,scope=2]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 4, party_id: 2, crypto_provider: true, onConnect: onConnect, autoConnect: false };
var jiff_instance = new JIFFClient('http://localhost:9111', 'deviation-application', options);
jiff_instance.apply_extension(jiff_negativenumber, options);
jiff_instance.connect();
```

```neptune[title=Party&nbsp;3,frame=frame1,scope=3]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 4, party_id: 3, crypto_provider: true, onConnect: onConnect, autoConnect: false };
var jiff_instance = new JIFFClient('http://localhost:9111', 'deviation-application', options);
jiff_instance.apply_extension(jiff_negativenumber, options);
jiff_instance.connect();
```

```neptune[title=Party&nbsp;4,frame=frame1,scope=4]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 4, party_id: 4, crypto_provider: true, onConnect: onConnect, autoConnect: false };
var jiff_instance = new JIFFClient('http://localhost:9111', 'deviation-application', options);
jiff_instance.apply_extension(jiff_negativenumber, options);
jiff_instance.connect();
```

# Computing the average

In our scenario, to compute the average, we must sum the values and then divide by the number of parties.

Note that the number of parties is public. Therefore, the division operation at the end is invertible. Any party can
take the average, multiply it by the party count, and learn the sum of the inputs.

This essentially means that the sum is leaked by the output itself, or put differently, leaking the sum **leaks no
more information** than the average.

This allows us to write our MPC program so that the sum is computed under MPC and revealed, while the division is carried
out in the clear outside of MPC. This saves us a great deal in performance, since summing can be done with no communication!

```neptune[title=Party&nbsp;1,frame=frame2,scope=1]
var input = -5;

function avg(input) {
  var shares = jiff_instance.share(input);

  var sum = shares[1];
  for (var i = 2; i <= jiff_instance.party_count; i++) {
    sum = sum.sadd(shares[i]);
  }

  return jiff_instance.open(sum).then(function (sum) {
    return sum / jiff_instance.party_count;
  });
}

avg(input).then(function (result) {
  Console.log('Average', result);
});
```
```neptune[title=Party&nbsp;2,frame=frame2,scope=2]
var input = -3;

function avg(input) {
  var shares = jiff_instance.share(input);

  var sum = shares[1];
  for (var i = 2; i <= jiff_instance.party_count; i++) {
    sum = sum.sadd(shares[i]);
  }

  return jiff_instance.open(sum).then(function (sum) {
    return sum / jiff_instance.party_count;
  });
}

avg(input).then(function (result) {
  Console.log('Average', result);
});
```
```neptune[title=Party&nbsp;3,frame=frame2,scope=3]
var input = 2;

function avg(input) {
  var shares = jiff_instance.share(input);

  var sum = shares[1];
  for (var i = 2; i <= jiff_instance.party_count; i++) {
    sum = sum.sadd(shares[i]);
  }

  return jiff_instance.open(sum).then(function (sum) {
    return sum / jiff_instance.party_count;
  });
}

avg(input).then(function (result) {
  Console.log('Average', result);
});
```
```neptune[title=Party&nbsp;4,frame=frame2,scope=4]
var input = 10;

function avg(input) {
  var shares = jiff_instance.share(input);

  var sum = shares[1];
  for (var i = 2; i <= jiff_instance.party_count; i++) {
    sum = sum.sadd(shares[i]);
  }

  return jiff_instance.open(sum).then(function (sum) {
    return sum / jiff_instance.party_count;
  });
}

avg(input).then(function (result) {
  Console.log('Average', result);
});
```

# Choosing the standard deviation protocol

Standard deviation of a given dataset can be computed in several ways. Below are two equivalent formulations:

```neptune[inject=true,language=html]
<h2 style="text-align: center;">
s = &radic; (&Sigma; (x<sub>i</sub> - E[x])<sup>2</sup> / (N - 1)) <br>
s = &radic; (E[x<sup>2</sup>] - E[x]<sup>2</sup>)
</h2>
```

First, note that the square root function is reversible, and therefore, can be computed outside of MPC. This leaves us with
the task of computing the variance under MPC.

At first glance, the two formulations seem comparable. In the first operation, the division by a public constant is reversible,
and thus can be executed outside of MPC after the sum is evaluated. However, we have as many multiplications (squares) as parties.

On the other hand, the second formulation seems similar, since it requires computing the average of the squares of the inputs, which
gives the same number of multiplications as the first formulation.

However, carefuly examination of the second formulation concludes that it is indeed efficient. E\[x]<sup>2</sup> can be
computed outside of MPC, since the average is revealed by our computation. While E\[x<sup>2</sup>] can be computed efficiently 
by having all the parties share the square of their input in addition to their input, and then reusing
our average protocol above.

This is an example of when a portion of our desired function is only dependent on inputs from a single party, and therefore, that party
can perform that portion locally before entering MPC.

In complex protocols, it is likely that optimizations can be made by triming out portions of the computation before or after the MPC
part, as well as intermediate computations.

# Standard deviation under MPC

Using the observations made above, we provide this implementation of standard deviation.

```neptune[title=Party&nbsp;1,frame=frame3,scope=1]
var input = -10;

function stdDev(input) {
  var promise1 = avg(input); // average
  var promise2 = avg(input * input); // average of the squares

  Promise.all([promise1, promise2]).then(function (results) {
    var squaredAvg = results[0] * results[0]; // square of the average
    var avgOfSquares = results[1];
    Console.log(results[0], Math.sqrt(avgOfSquares - squaredAvg));
  });
}

stdDev(input);
```
```neptune[title=Party&nbsp;2,frame=frame3,scope=2]
var input = -5;

function stdDev(input) {
  var promise1 = avg(input); // average
  var promise2 = avg(input * input); // average of the squares

  Promise.all([promise1, promise2]).then(function (results) {
    var squaredAvg = results[0] * results[0]; // square of the average
    var avgOfSquares = results[1];
    Console.log(results[0], Math.sqrt(avgOfSquares - squaredAvg));
  });
}

stdDev(input);
```
```neptune[title=Party&nbsp;3,frame=frame3,scope=3]
var input = 5;

function stdDev(input) {
  var promise1 = avg(input); // average
  var promise2 = avg(input * input); // average of the squares

  Promise.all([promise1, promise2]).then(function (results) {
    var squaredAvg = results[0] * results[0]; // square of the average
    var avgOfSquares = results[1];
    Console.log(results[0], Math.sqrt(avgOfSquares - squaredAvg));
  });
}

stdDev(input);
```
```neptune[title=Party&nbsp;4,frame=frame3,scope=4]
var input = 10;

function stdDev(input) {
  var promise1 = avg(input); // average
  var promise2 = avg(input * input); // average of the squares

  Promise.all([promise1, promise2]).then(function (results) {
    var squaredAvg = results[0] * results[0]; // square of the average
    var avgOfSquares = results[1];
    Console.log(results[0], Math.sqrt(avgOfSquares - squaredAvg));
  });
}

stdDev(input);
```

The result can be verified with [Wolframalpha](https://www.wolframalpha.com/input/?i=population+standard+deviation+of+-10%2C-5%2C5%2C10) for inputs
-10, -5, 5, and 10.

# Complete Files

For complete files and running instructions, navigate to /demos/standard-deviation.

```neptune[inject=true,language=html]
<br><br><br><br><br><br><br><br><br><br><br>
```
