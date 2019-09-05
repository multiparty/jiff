# Standard Deviation under MPC
Say you and your friends have just gotten back a brutal exam. Everyone says they did terribly on it, and you want to
commiserate together. But some of your friends are huge over-achievers, and probably would say that they did poorly if
they got an A-. You got a failing grade, and don't want to tell anyone else unless their grades were sufficiently close
to yours. So, everyone decides to compute the standard deviations of your grades under MPC. Then, based on that
standard deviation, you can decide whether or not you want to share your grades with each other.

In this tutorial, we'll look at an efficient implementation of the standard deviation for floating-point numbers. We will focus on the client-side code. For details on the server side, check out the complete files in the /demos/standard-deviation directory.

# Implementing client code
In this setting, we want to compute a standard deviation, assume each individual has a single input value. Each party's
input, which in the trivial implementation will be an integer. As before, the client program has two jobs: they connect
to the server, and they work together to compute the standard deviation under MPC. In the initial implementation, which
only supports integer operations, there will be some accuracy loss due to rounding to integers throughout the
computation. These accuracy losses will be minimized with the extension to floating point arithmetic.o


## Connecting to the server
In the file `client.js`, we start by connecting to the server. First, we define the `hostname` that the server above is
running on. Second, since this is a multi-party computation, we need to tell the server how many parties there are
(`party_count`), and the name of our computation(`computation_id`).

The `make_jiff` function uses this information to set up a new JIFF object.
We save the fully configured `jiff_instance` in a global variable, so we can use it when we compute our function.

```javascript
var jiff_instance;

function connect() {

  var hostname = "http://localhost:8080";

  var computation_id = 'stand_dev';
  var options = {party_count: 3};

  // TODO: is this necessary if we're using npm?
  if (node) {
    jiff = require('../../lib/jiff-client');
    $ = require('jquery-deferred');
  }

  jiff_instance = jiff.make_jiff(hostname, computation_id, options);
}
```

## Computing the standard deviation

Say there are *n* parties in your computation, each with input *x_i*. Let *m* be the mean of the inputs *x_i*. Recall
that the (population) variance of a series of values is defined to be the sum between *i=1* and *n* of
*(1/n)(x_i - m)^2*. The standard deviation is then the square root of the variance.

We could choose to compute this expression directly under MPC by secret-sharing the *x_i* values, subtracting the mean
from them, and squaring this and then summing, normalizing by *n*, and taking the square root, all under MPC. However,
this will be both messy to write and inefficient: any multiplication done under MPC is time-intensive, and here there
are many.

There are a few things we can do to cut down on the computational overhead. First, note that the variance is really what
needs to be computed under MPC: the value of *n* is public so we can derive the standard deviation from the variance
publicly without incurring any additional privacy loss.

Secondly, one can recall that there is an alternate formulation of the variance, which is

*E[X]^2 - E[X^2],*

where *E* denotes the expected value, i.e. variance is equal to the difference between the square of the
mean of the input values and the mean of the input values squared.

We can make this slightly faster by moving some of the normalization to post-processing, i.e. writing variance as

*(1/n)[(sum over X)^2/n - (sum over X^2)].*

Thus, variance can be calculated by each user
locally computing the square of their value, then secret sharing both their value and their value squared to compute the
means of both. Since *n* is a constant, the multiplication by *1/n* to compute the means is computationally inexpensive,
there is only one single secure multiplication that must take place, when *E[X]* is squared.

In code, here is an outline of what we will do given each party's arbitrary input value *x_i* and number of parties *n*.

```javascript
function compute() {
  var x_i; //input: will be passed into computation in final version
  var n;   //number of parties: will be passed into computation in final version

  // calculate x_i^2
  ...
  // share x_i and x_i^2
  ...
  // secretly compute sum of x_i's
  ...
  // secretly compute sum of x_i^2's
  ...
  // square the sum of x^i's
  ...
  // normalize the square of the sum of x_i's
  ...
  // subtract the sum of x_i^2's from this
  ...
  // open the results
  ...
  // normalize the result
  ...
  // Take the square root of this
  ...
  // print this final result
  ...
}
```

The first step is to share our input and our input squared with the rest of the parties. We use our saved and configured
 `jiff_instance` to do so. This operation is asynchronous: it requires communicating with every party to secret share
 the data. It returns a promise.

The sharing function is passed the input. In this case, all party inputs are length one, and they're all providing the
same type of input. These items are customizable, but in this case the basic implementation is sufficient.

```javascript
 var shares = jiff_instance.share(input);
 var in_squared = jiff_instance.share(input**2);
```

However, since the input squared might have more decimal points than the original input and we are restricted to some
fixed number of decimal points depending on our settings, the `in_squared` variable first needs to have input**2
truncated to that number of decimal points. Say we want to truncate to 2 decimal points. Then,

```javascript
var in_squared_fixed = Number.parseFloat((Math.pow(input, 2)).toFixed(2)); //convert input^2 to fixed point number
var in_squared = jiff_instance.share(in_squared_fixed);
```

Once everyone's input is shared, we'll compute their sums. The promises that `shares` and `in_squared` return are
objects containing the shares from every party in an object. They have the form
```
{1 : [<party 1's array>], 2 : [<party 2's array>], n: [<party n's array>]}
```

To sum the secret-shares, we use the secret addition function, `sadd`
```javascript
var in_sum = shares[1];
var in_squared_sum = in_squared[1];

for (var i = 2; i <= jiff_instance.party_count; i++) {    // sum all inputs and sum all inputs squared
      in_sum = in_sum.sadd(shares[i]);
      in_squared_sum = in_squared_sum.sadd(in_squared[i]);
    }
```
Next, we need to normalize the sum of the inputs. Since *1/n* may as a floating point number have more values after the
decimal than our settings can handle, we first truncate this to a fixed amount and then do a secret multiplication by this.

```javascript
 var one_over_n = Number.parseFloat((1/jiff_instance.party_count).toFixed(2)); // convert 1/n to fixed point number
 var in_sum_squared = in_sum.smult(in_sum);
 var intermediary = in_sum_squared.cmult(one_over_n);
```

We can then compute the difference between this and the sum of inputs squared.

```javascript
var out = in_squared_sum.ssub(intermediary);
```

Finally, we need to reveal the results to each party. We use a promise to resolve the results
from all parties, then do the final post-processing on this reveal.

```javascript
//Create a promise of output
var promise = jiff_instance.open(out);

var promise2 = promise.then(function (v) {
  var variance = v/(jiff_instance.party_count - 1);
  return Math.sqrt(variance);       // Return standard deviation.
});
```

The `compute` function looks like this:

```javascript
function compute() {
    var shares = jiff_instance.share(input);
    var in_sum = shares[1];
    var in_squared_fixed = Number.parseFloat((Math.pow(input, 2)).toFixed(2)); //convert input^2 to fixed point number
    var in_squared = jiff_instance.share(in_squared_fixed);
    var in_squared_sum = in_squared[1];

    for (var i = 2; i <= jiff_instance.party_count; i++) {    // sum all inputs and sum all inputs squared
      in_sum = in_sum.sadd(shares[i]);
      in_squared_sum = in_squared_sum.sadd(in_squared[i]);
    }

    var one_over_n = Number.parseFloat((1/jiff_instance.party_count).toFixed(2)); // convert 1/n to fixed point number
    var in_sum_squared = in_sum.smult(in_sum);
    var intermediary = in_sum_squared.cmult(one_over_n);
    var out = in_squared_sum.ssub(intermediary);


    //Create a promise of output
    var promise = jiff_instance.open(out);

    var promise2 = promise.then(function (v) {
      var variance = v/(jiff_instance.party_count - 1);
      return Math.sqrt(variance);       // Return standard deviation.
    });

    return promise2;

}
```


# Complete Files

For complete files and running instructions, navigate to /demos/standard-deviation.
