```neptune[language=javascript,inject=true]
(function () {
  var script = document.createElement('script');
  script.setAttribute('src', '/dist/jiff-client.js');
  document.head.appendChild(script);
}());
```

# Inner Product and fixedpoint numbers

In this tutorial, we will look at an example implementation of inner product that supports fixed-point numbers.
We optimize the implementation by lazyily reducing the precision only at the end. This tutorial implements
the 2-party version for simplicity, but the techniques exend to aribtrary many parties.

#### Tutorial content:
1. Setting up the fixedpoint numbers extension.
2. Basic inner product implementation.
3. How the fixedpoint numbers extension work.
4. Efficient inner product implementation.

# Setup: fixedpoint numbers extension

Fixedpoint numbers are effectively transformed into integers in the desired field automatically by JIFF, by scaling them up
by the magnitude. These means that even small fixedpoint numbers can turn into large integers in the actual implementation.

Unfortunetly, Javascript is not very good with large numbers. The largest safe integer javascript can represent accurately is 53 bits long.
This means that operating (specifically multiplying) on numbers that are 27 bits or more can result in unsafe (intermediate) results.

```neptune[title=Max&nbsp;Safe&nbsp;Number,scope=None,frame=frame1]
var safe = Number.MAX_SAFE_INTEGER;
Console.log(safe, safe.toString(2).length);
var sqrt = Math.floor(Math.sqrt(safe));
Console.log(sqrt, sqrt.toString(2).length);
Console.log('Choosing a prime larger than the above safe number requires use of bignumber extensions');
```

JIFF supports handling infinite precision number based on the **bignumber.js** library. The fixedpoint extension requires that this
bignumber extension is applied first. The bignumber extension should be applied at the server as well as clients.

When using the fixedpoint numbers extension, one can specify how many digits after and before the decimal point to support.
Note that these digits must fit within the given prime, otherwise JIFF will throw an error.
If multiplication (or other primitives using it) should be supported, then there should at least as many free digits in the field
as decimal digits. So that intermediate multiplication results fit in the field.

```neptune[title=Server,frame=frame2,env=server]
var JIFFServer = require('../../../../../lib/jiff-server.js');
var jiff_bignumber = require('../../../../../lib/ext/jiff-server-bignumber.js');

var jiff_instance = new JIFFServer(server, { logs:true });
jiff_instance.apply_extension(jiff_bignumber);

Console.log('Server is running on port 9111');
```

```neptune[title=Party&nbsp;1,frame=frame2,scope=1]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 2, party_id: 1, crypto_provider: true, onConnect: onConnect, autoConnect: false, integer_digits: 3, decimal_digits: 2 };
var jiff_instance = new JIFFClient('http://localhost:9111', 'product-application', options);
jiff_instance.apply_extension(jiff_bignumber, options);
jiff_instance.apply_extension(jiff_fixedpoint, options);
jiff_instance.connect();
```
```neptune[title=Party&nbsp;2,frame=frame2,scope=2]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 2, party_id: 2, crypto_provider: true, onConnect: onConnect, autoConnect: false, integer_digits: 3, decimal_digits: 2 };
var jiff_instance = new JIFFClient('http://localhost:9111', 'product-application', options);
jiff_instance.apply_extension(jiff_bignumber, options);
jiff_instance.apply_extension(jiff_fixedpoint, options);
jiff_instance.connect();
```
```neptune[title=Party&nbsp;1&nbsp;Incorrect,frame=frame2,scope=None]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 2, party_id: 1, crypto_provider: true, onConnect: onConnect, autoConnect: false, integer_digits: 5, decimal_digits: 5 };
var jiff_instance = new JIFFClient('http://localhost:9111', 'product-application', options);
jiff_instance.apply_extension(jiff_bignumber, options);
jiff_instance.apply_extension(jiff_fixedpoint, options);
jiff_instance.connect();
```


## Basic inner product
Once the setup details are taken care of, we can define the interesting part of the computation.

```neptune[title=Party&nbsp;1,frame=frame3,scope=1]
var input = [ 1.32, 10.22, 5.67]

function innerprod(input) {
  var promise = jiff_instance.share_array(input);
  return promise.then(function (arrays) {
    var array1 = arrays[1];
    var array2 = arrays[2];

    var result = array1[0].smult(array2[0]);
    for (var i = 1; i < array1.length; i++) {
      result = result.sadd(array1[i].smult(array2[i]));
    }

    return jiff_instance.open(result);
  });
}

innerprod(input).then(function (result) {
  Console.log('Inner product', result);
  Console.log('Verify', 1.32*5.91 + 10.22*3.73 + 5.67*50.03);
});
```
```neptune[title=Party&nbsp;2,frame=frame3,scope=2]
var input = [ 5.91, 3.73, 50.03]

function innerprod(input) {
  var promise = jiff_instance.share_array(input);
  return promise.then(function (arrays) {
    var array1 = arrays[1];
    var array2 = arrays[2];

    var result = array1[0].smult(array2[0]);
    for (var i = 1; i < array1.length; i++) {
      result = result.sadd(array1[i].smult(array2[i]));
    }

    return jiff_instance.open(result);
  });
}

innerprod(input).then(function (result) {
  Console.log('Inner product', result);
});
```

# Internals of fixedpoint numbers extension

The inner product above is very easy to implement, but it does take a long amount of time for how little it seems to be doing. Let us look at the implementation of fixedpoint extenion smult.

```neptune[title=Fixedpoint&nbsp;Numbers&nbsp;Extenion,frame=frame4,scope=1]
var dummy = new jiff_instance.SecretShare(10, [1], 1, jiff_instance.Zp); // creating a dummy share for debugging
var code = dummy.smult.toString().split('\n');
var relavent = [code[0]].concat(code.slice(10, 15)).concat(code.slice(35)).join('\n');
Console.log(relavent);
```

The variable magnitude represents the magnitude of the decimal precision, since our example supports two decimal digits, magnitude is 100.

The reason for the slowdown is the final call to cdiv inside smult. While JIFF has a pretty efficient (original) cdiv protocol, it still is a lot more expensive than a plain multiplication.
This last call to cdiv is important in general, since the result of the multiplication may be used arbitrarily by user code, including using it for other multiplications. It is important
that all intermediate shares exposed to the user have consistent decimal point position, so that operations on these shares produce correct results. Hence, smult moves the decimal point
back to its original place after multiplication.

Note that cdiv is integer division by a public constant, so it is equivalent to dropping the least significant precision-many bits from the value.

# Efficient inner product

Looking at our code carefully, we realize that our program has a nice property. The result of multiplication is never used in another multiplication.
Addition operations are only performed on results of multiplications.

This means that we can make do without having to shift the decimal point after every multiplication. Instead, we can delay the shift until all multiplications
are computed and then summed. We can acheive this by setting the *div* parameter to false.

Further examination of the code will show that such a shift (i.e. division by a public constant) is reversible, since we are revealing
its output, and it can be performed outside of MPC all together. This is true only because our final output is the inner product. In cases
where the inner product is a secret intermediate value needed for computing the actual output, we must perform the division under MPC.

```neptune[title=Party&nbsp;1,frame=frame5,scope=1]
var input = [ 1.32, 10.22, 5.67]

function innerprod(input) {
  var promise = jiff_instance.share_array(input);
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

innerprod(input).then(function (result) {
  Console.log('Inner product', result.div(100)); // shift decimal point outside of MPC
  Console.log('Verify', 1.32*5.91 + 10.22*3.73 + 5.67*50.03);
});
```
```neptune[title=Party&nbsp;2,frame=frame5,scope=2]
var input = [ 5.91, 3.73, 50.03]

function innerprod(input) {
  var promise = jiff_instance.share_array(input);
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

innerprod(input).then(function (result) {
  Console.log('Inner product', result.div(100)); // shift decimal point outside of MPC
});
```

