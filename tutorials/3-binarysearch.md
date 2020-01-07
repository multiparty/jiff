```neptune[language=javascript,inject=true]
(function () {
  var script = document.createElement('script');
  script.setAttribute('src', '/dist/jiff-client.js');
  document.head.appendChild(script);
}());
```

# Binary Search under MPC

The tutorial demonstrates how certain MPC tradeoffs can influence the algorithmic choices made when designing a protocol.

The running example in this tutorial is binary search. We have two parties, the first has an array of n numbers, while the
second has a single number. The parties are interested in using MPC to determine if the number is in the array or not efficiently,
without revealing any other information.

#### Tutorial content:
1. Linear search under MPC.
2. Why we cannot use binary search directly under MPC: branches and access patterns.
3. MPC-friendly binary search.

# Setup

Our setup is very similar to the previous tutorials, except we only have two parties.

```neptune[title=Server,frame=frame1,env=server]
var JIFFServer = require('../../../../../lib/jiff-server.js'); // replace this with your actual path to jiff-server.js
var jiff_instance = new JIFFServer(server, { logs:true });
Console.log('Server is running on port 9111');
```

```neptune[title=Party&nbsp;1,frame=frame1,scope=1]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 2, party_id: 1, crypto_provider: true, onConnect: onConnect, Zp: 31 };
var jiff_instance = new JIFFClient('http://localhost:9111', 'search-application', options);
```

```neptune[title=Party&nbsp;2,frame=frame1,scope=2]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 2, party_id: 2, crypto_provider: true, onConnect: onConnect, Zp: 31 };
var jiff_instance = new JIFFClient('http://localhost:9111', 'search-application', options);
```

# Linear search

JIFF allows us to implement linear search directly, by translating its operations into their JIFF counterparts.

```neptune[title=Party&nbsp;1,frame=frame2,scope=1]
var input = [1, 8, 10, 12, 16, 17, 23, 29];

function linear_search(array, element) {
  var occurrences = array[0].seq(element); // check equality
  for (var i = 1; i < array.length; i++) {
    occurrences = occurrences.sadd(array[i].seq(element));
  }

  return jiff_instance.open(occurrences.cgteq(1)); // check number of occurrences >= 1
}

var needle = jiff_instance.share(null, 2, [1, 2], [2]); // only party 2 shares needle
var haystackPromise = jiff_instance.share_array(input); // party 1 provides array
haystackPromise.then(function (haystack) {
  var promise = linear_search(haystack[1], needle[2]);
  promise.then(Console.log);
});
```

```neptune[title=Party&nbsp;2,frame=frame2,scope=2]
var input = 4;

function linear_search(array, element) {
  var occurrences = array[0].seq(element); // check equality
  for (var i = 1; i < array.length; i++) {
    occurrences = occurrences.sadd(array[i].seq(element));
  }

  return jiff_instance.open(occurrences.cgteq(1)); // check number of occurrences >= 1
}

var needle = jiff_instance.share(input, 2, [1, 2], [2]); // only party 2 shares needle
var haystackPromise = jiff_instance.share_array([]); // party 1 provides array
haystackPromise.then(function (haystack) {
  var promise = linear_search(haystack[1], needle[2]);
  promise.then(Console.log);
});
```

# Binary Search under MPC: failures

Binary search relies heavily on branching. The crucial step being determining whether to look at the left or right
half of the array. By observing which array elements are being accessed, parties can learn a lot of information about
the inputs.

Consider the following transcript of binary search. By only observing the access patterns, the array holders
can learn good bounds on the value of the input.

```neptune[inject=true,language=html]
<img src="/static/images/binary1.png" alt="Binary search - step 1" style="width: 70%; max-width: 800px; margin-left: auto; margin-right: auto; display: block;"></img>
<img src="/static/images/binary2.png" alt="Binary search - step 2" style="width: 70%; max-width: 800px; margin-left: auto; margin-right: auto; display: block;"></img>
<img src="/static/images/binary3.png" alt="Binary search - step 3" style="width: 70%; max-width: 800px; margin-left: auto; margin-right: auto; display: block;"></img>
<img src="/static/images/binary4.png" alt="Binary search - step 4" style="width: 40%; max-width: 400px; margin-left: auto; margin-right: auto; display: block;"></img>
```

The two most obvious ways of hiding these access patterns have a large performance penalty:
1. Replacing all branching statements with JIFF's if\_else function boils down to linear search (plus additional overhead of selection). Remember that
MPC branching statements effectively evaluate both branches then select the appropriate one. Evaluating both branches of every iteration of binary search
ends up covering the entire array.

2. Replacing direct array access that use a public index with an oblivious access that uses a secret share index. This seems like a good approach at first glance.
Since it makes indices secret and allows us to manipulate them using JIFF's primitive. However, any such oblivious access mechanism must be linear, since it must
touch every element in the array, otherwise, elements that were not touched can be directly excluded from the possible outcomes, which leaks some information. This added
overhead will cause the overall performance to become O(n*log(n)).

# Binary Search under MPC: hope

We relax our performance expectations, by requiring that our implementation include O(log(n)) inequality tests, but up to O(n) multiplications.
This is radically different than regular binary search. However, due to the tradeoffs in performance costs of MPC primitives, this is much
more efficient than linear search.

A hybrid approach that combines the previous two ideas realizes this new performance expectation. At every iteration, we perform a single comparison against
the mid point of the array. We then perform a choice operation based on JIFF's if\_else to select the appropriate half of the array, one element at a time.
This costs us n/2 if\_else calls, each containing a single multiplication, we then recurse on that selected half. By solving the resulting recurrence relation,
we find the number of multiplication to be exactly n.

```neptune[title=Party&nbsp;1,frame=frame3,scope=1]
function binary_search(array, element) {
  if (array.length === 1) {
    // base case, array of size 1
    return array[0].seq(element);
  }

  // comparison against mid element
  var mid = Math.floor(array.length/2);
  var cmp = element.slt(array[mid]);

  // Slice array in half, choose slice depending on cmp
  var nArray = [];
  for (var i = 0; i < mid; i++) {
    var c1 = array[i];
    var c2 = array[mid+i];
    nArray[i] = cmp.if_else(c1, c2);
  }

  // watch out for off by 1 errors if length is odd.
  if (2*mid < array.length) {
    nArray[mid] = array[2*mid];
  }

  return binary_search(nArray, element);
}
```
```neptune[title=Party&nbsp;2,frame=frame3,scope=2]
function binary_search(array, element) {
  if (array.length === 1) {
    // base case, array of size 1
    return array[0].seq(element);
  }

  // comparison against mid element
  var mid = Math.floor(array.length/2);
  var cmp = element.slt(array[mid]);

  // Slice array in half, choose slice depending on cmp
  var nArray = [];
  for (var i = 0; i < mid; i++) {
    var c1 = array[i];
    var c2 = array[mid+i];
    nArray[i] = cmp.if_else(c1, c2);
  }

  // watch out for off by 1 errors if length is odd.
  if (2*mid < array.length) {
    nArray[mid] = array[2*mid];
  }

  return binary_search(nArray, element);
}
```

Now that we defined our MPC binary search function, we can try to run it on some actual inputs.

```neptune[title=Party&nbsp;1,frame=frame4,scope=1]
var input = [1, 8, 10, 12, 16, 17, 23, 29];

var needle = jiff_instance.share(null, 2, [1, 2], [2]);
var haystackPromise = jiff_instance.share_array(input);
haystackPromise.then(function (haystack) {
  var promise = jiff_instance.open(binary_search(haystack[1], needle[2]));
  promise.then(Console.log);
});
```

```neptune[title=Party&nbsp;2,frame=frame4,scope=2]
var input = 4;

var needle = jiff_instance.share(input, 2, [1, 2], [2]);
var haystackPromise = jiff_instance.share_array([]);
haystackPromise.then(function (haystack) {
  var promise = jiff_instance.open(binary_search(haystack[1], needle[2]));
  promise.then(Console.log);
});
```

# Next steps

The tutorials so far have focused on understanding MPC and its guarantees, the basic JIFF API, and the algorithmic differences between MPC and non-MPC programs.

The following tutorials will delve into more advanced features of JIFF, such as extensions and preprocessing, as well as other approaches to writing more
efficient MPC programs, such as lazy execution and extracting more computation to outside of MPC.


