```neptune[language=javascript,inject=true]
(function () {
  var script = document.createElement('script');
  script.setAttribute('src', '/dist/jiff-client.js');
  document.head.appendChild(script);
}());
```

# Parallelizing MPC protocols

This tutorial demonstrates how MPC can be sped up via parallelization.

#### Tutorial content:
1. Abstract setup.
2. Design of parallel MPC protocols.
3. Example: linear search.

# Abstract setup

We want to create a setting where adding more machines to an MPC computation can speed it up. In MPC, machines have to belong to some party.
Since we cannot add parties arbitrarily to a computation. We will consider a setting where every party has access to a cluster of machines
(or a multi-core machine). The setting is shown in the following diagram.

```neptune[inject=true,language=html]
<img src="/static/images/parallel.png" alt="Parallel MPC Layout" style="width: 80%; max-width: 1000px; margin-left: auto; margin-right: auto; display: block;"></img>
```

# Design of parallel MPC protocols

The techniques used here are very similar to parallel programming (e.g. MPI). With a couple of caveats.

The first is related to the trust assumptions. MPC usually operates in a party = machine mentality. Therefore, adding
extra machines can be akin to adding extra parties, and may have security implications. For example, imagine if we attempt
to parallelize some computation by assigning 10 machines to every party. If secrets are shared with threshold 3, and every machine
gets a share of that secret, than a single party can pool its shares together and reconstruct the secret!

This issue can be resolved by careful design of the MPC protocol, such that no two machines from the same party receive shares of the same input.
Alternatively, if it is important to duplicate shares for reliability, either the same share value should be used throughout a party's machines, or
the protocol must perform independent sharing of the value for each machine.

The second caveat has to do with performance. In regular parallel programming, the input is split between machines based on some partitioning
function, which may depend on or be independent from the data. Additionally, for complex or iterative functions, partial results computed by
a single machine may need to be communicated or aggregated with partial results from other machines, which may feedback into another stage
of parallel computing.

When doing things under MPC, input partitioning and output aggregation, as well as any intermediate processing, must be performed under MPC.
Partial or intermediate outputs may leak a lot more information than the final output, and thus are unsafe to reveal to any party. This
may cause some interesting performance tradeoffs, where what is usually an optimal algorithm may become suboptimal under MPC, because
it requires a complex or very serial aggregation stage at the end.

Finally, it usually makes sense to ensure that all parties have the same number of machines. As having one machine be part of two cliques
will slow both cliques down, since MPC is in general highly synchronized. However, this is not always true, in cases where the MPC protocol
is highly asymmetric, or where the different parties has very unequal computational resources.

# Example: linear search

## Setup

For simplicity, we assume we have two parties, each possessing two machines.

```neptune[title=Server,frame=frame1,env=server]
var JIFFServer = require('../../../../../lib/jiff-server.js'); // replace this with your actual path to jiff-server.js
var jiff_instance = new JIFFServer(server, { logs:true });
Console.log('Server is running on port 9111');
```

```neptune[title=Party&nbsp;1-1,frame=frame1,scope=1]
function onConnect() {
  Console.log('All parties connected!');
}

// party count is really machine count here
// our code logically understands that party ids 1 and 2 belong to the same party, and the same for 3 and 4.
var options = { party_count: 4, party_id: 1, crypto_provider: true, onConnect: onConnect, Zp: 31 };
var jiff_instance = new JIFFClient('http://localhost:9111', 'parralel-mpc', options);
```

```neptune[title=Party&nbsp;1-2,frame=frame1,scope=2]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 4, party_id: 2, crypto_provider: true, onConnect: onConnect, Zp: 31 };
var jiff_instance = new JIFFClient('http://localhost:9111', 'parralel-mpc', options);
```

```neptune[title=Party&nbsp;2-1,frame=frame1,scope=3]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 4, party_id: 3, crypto_provider: true, onConnect: onConnect, Zp: 31 };
var jiff_instance = new JIFFClient('http://localhost:9111', 'parralel-mpc', options);
```

```neptune[title=Party&nbsp;2-2,frame=frame1,scope=4]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 4, party_id: 4, crypto_provider: true, onConnect: onConnect, Zp: 31 };
var jiff_instance = new JIFFClient('http://localhost:9111', 'parralel-mpc', options);
```

## Linear search

Consider the linear search MPC protocol from previous tutorials. Assume the underlying array is unsorted, and thus we ust use linear search.
We can gain some performance benefits by partioning the array into chunks, and assign each chunk to a unique non-overlapping clique of machines,
each beloning to a party.

```neptune[title=Party&nbsp;1-1,frame=frame2,scope=1]
function linear_search(array, element) {
  var occurrences = array[0].seq(element); // check equality
  for (var i = 1; i < array.length; i++) {
    occurrences = occurrences.sadd(array[i].seq(element));
  }

  return occurrences.cgteq(1);
}
```
```neptune[title=Party&nbsp;1-2,frame=frame2,scope=2]
function linear_search(array, element) {
  var occurrences = array[0].seq(element); // check equality
  for (var i = 1; i < array.length; i++) {
    occurrences = occurrences.sadd(array[i].seq(element));
  }

  return occurrences.cgteq(1);
}
```
```neptune[title=Party&nbsp;2-1,frame=frame2,scope=3]
function linear_search(array, element) {
  var occurrences = array[0].seq(element); // check equality
  for (var i = 1; i < array.length; i++) {
    occurrences = occurrences.sadd(array[i].seq(element));
  }

  return occurrences.cgteq(1);
}
```
```neptune[title=Party&nbsp;2-2,frame=frame2,scope=4]
function linear_search(array, element) {
  var occurrences = array[0].seq(element); // check equality
  for (var i = 1; i < array.length; i++) {
    occurrences = occurrences.sadd(array[i].seq(element));
  }

  return occurrences.cgteq(1);
}
```

In such a setting, each clique can perform linear search on a much smaller array, and compute a secret shared intermediate result indicating
whether an element is in that chunk of the array. This intermediate result should not be revealed, since it leaks more information
about the position (and thus the possible values) of the element, than what the function is set to do.

```neptune[title=Party&nbsp;1-1,frame=frame3,scope=1]
var input = [10, 2, 5, 1, 8, 3, 5, 12];
var aggregateOr;

function parallelSearch() {
  // get a share of the element
  var elementShare = jiff_instance.share(null, 2, [1, 3], [3]);

  // partition and share with clique
  var partition = input.slice(0,input.length/2);
  var promise = jiff_instance.share_array(partition, null, 2, [1, 3], [1]);
  promise.then(function (array) {
    var intermediate1 = linear_search(array[1], elementShare[3]);
    var intermediate2 = jiff_instance.reshare(null, 2, [1, 3], [2, 4]);
    aggregateOr([intermediate1, intermediate2]);
  });
}
```
```neptune[title=Party&nbsp;1-2,frame=frame3,scope=2]
var input = [10, 2, 5, 1, 8, 3, 5, 12];

function parallelSearch() {
  // get a share of the element
  var elementShare = jiff_instance.share(null, 2, [2, 4], [4]);

  // partition and share with clique
  var partition = input.slice(input.length/2);
  var promise = jiff_instance.share_array(partition, null, 2, [2, 4], [2]);
  promise.then(function (array) {
    var intermediate = linear_search(array[2], elementShare[4]);
    jiff_instance.reshare(intermediate, 2, [1, 3], [2, 4]);
  });
}
```
```neptune[title=Party&nbsp;2-1,frame=frame3,scope=3]
var input = 5;
var aggregateOr;

function parallelSearch() {
  // get a share of the element
  var elementShare = jiff_instance.share(input, 2, [1, 3], [3]);

  var promise = jiff_instance.share_array(null, null, 2, [1, 3], [1]);
  promise.then(function (array) {
    var intermediate1 = linear_search(array[1], elementShare[3]);
    var intermediate2 = jiff_instance.reshare(null, 2, [1, 3], [2, 4]);
    aggregateOr([intermediate1, intermediate2]);
  });
}
```
```neptune[title=Party&nbsp;2-2,frame=frame3,scope=4]
var input = 5;

function parallelSearch() {
  // get a share of the element
  var elementShare = jiff_instance.share(input, 2, [2, 4], [4]);

  // get a share of partition
  var promise = jiff_instance.share_array(null, null, 2, [2, 4], [2]);
  promise.then(function (array) {
    var intermediate = linear_search(array[2], elementShare[4]);
    jiff_instance.reshare(intermediate, 2, [1, 3], [2, 4]);
  });
}
```

The parties need to compute a logical or over all these intermediate values under MPC. Depending on the implementation, this logical or
may be expensive, but it is independent of the size of the array, it only depends on how many chunks we created.

The main difficulty in this aggregation is that only a subset of machines has access to a share of each intermediate result. To perform MPC,
shares must be possessed by the same set of machines. We provide a way around this using JIFF's **reshare** function, which re-randomizes and
transfers a secret shared to a different set of machines or parties, without leaking the information. We use **reshare** to transfer all shares
to a single clique, which is highly sequential. More parallelized protocols exist that perform a tree-like aggregation using several cliques, causing
the sequential depth of the aggregation to become logarithmic in the number of machines per party, as opposed to linear.

We provide two implementations of our or aggregation. The first performs multiplications linear in the number of machines per party, while the
second performs a single comparison check regardless of how many machines there are. Due to comparisons being much more expensive than
multiplications, the first approach outperforms the second for a reasonable number of machines per party.

```neptune[title=Party&nbsp;1-1,frame=frame4,scope=1]
aggregateOr = function (array) {
  var or = array[0].sadd(array[1]).ssub(array[0].smult(array[1]));
  for (var i = 2; i < array.length; i++) {
    or = or.sadd(array[i]).ssub(or.smult(array[i]));
  }
  jiff_instance.open(or).then(function (result) {
    Console.log(result);
  });
}

parallelSearch();
```

```neptune[title=Party&nbsp;1-2,frame=frame4,scope=2]
parallelSearch();
```

```neptune[title=Party&nbsp;2-1,frame=frame4,scope=3]
aggregateOr = function (array) {
  var or = array[0].sadd(array[1]).ssub(array[0].smult(array[1]));
  for (var i = 2; i < array.length; i++) {
    or = or.sadd(array[i]).ssub(or.smult(array[i]));
  }
  jiff_instance.open(or).then(function (result) {
    Console.log(result);
  });
}

parallelSearch();
```

```neptune[title=Party&nbsp;2-2,frame=frame4,scope=4]
parallelSearch();
```

```neptune[inject=true,language=html]
<br><br>
```

```neptune[title=Party&nbsp;1-1,frame=frame5,scope=1]
aggregateOr = function (array) {
  var sum = array[0].sadd(array[1]);
  for (var i = 2; i < array.length; i++) {
    sum = sum.sadd(array[i]);
  }
  
  var or = sum.cgteq(1);
  jiff_instance.open(or).then(function (result) {
    Console.log(result);
  });
}


parallelSearch();
```

```neptune[title=Party&nbsp;1-2,frame=frame5,scope=2]
parallelSearch();
```

```neptune[title=Party&nbsp;2-1,frame=frame5,scope=3]
aggregateOr = function (array) {
  var sum = array[0].sadd(array[1]);
  for (var i = 2; i < array.length; i++) {
    sum = sum.sadd(array[i]);
  }
  
  var or = sum.cgteq(1);
  jiff_instance.open(or).then(function (result) {
    Console.log(result);
  });
}


parallelSearch();
```

```neptune[title=Party&nbsp;2-2,frame=frame5,scope=4]
parallelSearch();
```
