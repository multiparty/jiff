```neptune[language=javascript,inject=true]
(function () {
  var script = document.createElement('script');
  script.setAttribute('src', '/dist/jiff-client.js');
  document.head.appendChild(script);
}());
```

# Introduction to JIFF

This tutorial assumes that you are familiar with MPC to some extent, if you need a quick primer on MPC, look at the previous tutorial!

#### Tutorial content:

1. An overview of JIFF's computation model and security guarantees.
2. Basic setup of JIFF in browser or node.js applications.
3. A simple voting application using JIFF.

# Overview of JIFF

JIFF is a **semi-honest** MPC framework with customizable primitives and behavior. Parties performing an MPC computation with JIFF (called JIFF clients)
can run browser or node.js based applications. JIFF ships built in with a variety of basic primitives, as well as extensions for advanced features.
JIFF provides hooks that allow developers to integrate JIFF MPC application within large non-MPC workflows and applications.

JIFF build in primitives run in the pre-processing model, where a configurable set of parties perform some computation ahead of time, before inputs
are known or any computation is run, to produce some correlated randomness and other cryptographic material, that is consumed during the online computation.
This allows the online computation to be more efficient.

JIFF's default preprocessing protocols require an **honest majority** to be secure (partically, the beaver triples generation protocol which is based on BGW).
While the default online primitives are secure against a **dishonest majority** provided access to secure and correct preprocessing material.

JIFF aims to support dynamic and asynchronous computation, where parties may have unreliable connectivity, and can join and leave the computation
dynamically. JIFF makes uses of a centeralized logistics server that acts as a message broker and provide a layer of reliability and fault tolerance.
By default, the server does not participate in the computation, and only sees encrypted traffic. However, the server may be configured
to fully participate in the computation as a party, or act as a **crypto provider** that provides materials needed by the online primitives.

The server performs some orchestration tasks, such as notifying parties when other parties join or leave, and facilitate initial exchange of public
keys, this behavior can be customized by developers.

This consists a paradigm shift compared to the traditional _peer-to-peer_ view of MPC, where all parties behave symmetrically and execute similar instructions.

```neptune[inject=true,language=html]
<img src="/static/images/jiff-server.png" alt="JIFF computation model" style="width: 80%; max-width: 1400px; margin-left: auto; margin-right: auto; display: block;"/>
```

# Why Use JIFF?
Good reasons to use JIFF:

1. You want to use MPC, but you want your application to run in a web stack (on browsers, servers, and/or mobile phones).
2. You want to use MPC, but you do not want to re-write all primitives from scratch!
3. You want to use MPC with many many parties.
4. You want to use MPC without becoming a cryptography expert or learning a bunch of domain specific languages.
5. Because it is cool!

Do not use JIFF if:
1. You do not need MPC.
2. If your desired output leaks a lot of sensitive information about the inputs! Use JIFF with differential privacy!

# Basic JIFF Setup

# Installing JIFF
We have not published the recent version of JIFF to NPM yet. Expect v1.0 to be released in October 2019!

Until JIFF is on NPM, you will have to clone the JIFF repo, and install all dependencies.
```command-line
git clone https://github.com/multiparty/jiff
cd jiff
git checkout docs # to use the documentation branch!
npm install # to install all dependencies
```

# Setting up the Server
First, we must setup a JIFF server. We use the standard **http** node.js module, with **express** on top, but other libraries will work too!

The same server can be re-used to serve the application and static files if desired.

```javascript
var express = require('express');
var app = express();
var server = require('http').Server(app);

app.use('/lib', express.static('/path/to/jiff/lib'));
app.use('/', express.static('/path/to/application/index'));
...

http.listen(9111, function() {
  console.log('listening on 9111');
});
```

Then we setup a JIFF server on top of our running http server.
```neptune[title=Server,env=server]
var JIFFServer = require('../../../../../lib/jiff-server.js'); // replace this with your actual path to jiff-server.js
var jiffServer = new JIFFServer(server, { logs:true });
Console.log('Server is running on port 9111');
```

## Defining a JIFF Client
Next, we define our JIFF clients. These clients can be either browser-based or node.js-based.

First, we must include the appropriate JIFF client library. All its dependencies (sockets.io and libsodium-wrappers) are 
bundled within it. The tutorial already has these files included.

```neptune[title=Browser,language=html,frame=frame1]
<script src="/dist/jiff-client.js"></script> <!-- exposes global object 'JIFFClient' -->
```

```neptune[title=Node,frame=frame1]
var JIFFClient = require('../../lib/jiff-client');
```

```neptune[inject=true]
setTimeout(function () {
  var icon = document.getElementById('frame1').getElementsByClassName('fa-play')[0];
  icon.parentNode.removeChild(icon);
}, 2000);
```

Next, the client must connect to the server. This requires passing three parameters: the server's URL, the computation id (which identifies the computation
in case multiple computations are served by the same server), and any additional options.

Several options can be provided to JIFF to customize the created client instance, computation, or connection. Noteably, client code can provide
the total expected party count, the preferred party id, as well as public keys for any subset of parties if known.
All these are optional. The server will attempt to fill in any unprovided options dynamically.


```neptune[title=Party&nbsp;1,frame=frame2,scope=1]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 3, crypto_provider: true, onConnect: onConnect };
var jiffClient = new JIFFClient('http://localhost:9111', 'our-setup-application', options);
```

```neptune[title=Party&nbsp;2,frame=frame2,scope=2]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 3, crypto_provider: true, onConnect: onConnect };
var jiffClient = new JIFFClient('http://localhost:9111', 'our-setup-application', options);
```

```neptune[title=Party&nbsp;3,frame=frame2,scope=3]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 3, crypto_provider: true, onConnect: onConnect };
var jiffClient = new JIFFClient('http://localhost:9111', 'our-setup-application', options);
```

## Our first application: voting

Now that all the parties are setup, they can perform some interesting computation.

We will use voting as a running example in this tutorial.

Assume the three parties are friends that want to see what their favorite type of beer is, without revealing which one is their individual preference.

Let us assume we have 4 options: IPA, Lager, Stout, and Pilsner. (It is the opinion of JIFF that these are the only 4 legitimate types of beer)

We can think of this voting program as a sum over each option, where the input of every party is a 1 for the prefered option, and 0 for all other options.

```neptune[title=Party&nbsp;1,frame=frame3,scope=1]
var options = ['IPA', 'Lager', 'Stout', 'Pilsner'];
var input = [1, 0, 0, 0];

jiffClient.wait_for([1, 2, 3], function () {
  var results = [];
  for (var i = 0; i < options.length; i++) {
    var ithOptionShares = jiffClient.share(input[i]);
    var ithOptionResult = ithOptionShares[1].sadd(ithOptionShares[2]).sadd(ithOptionShares[3]);
    results.push(jiffClient.open(ithOptionResult));
  }

  Promise.all(results).then(function (results) {
    Console.log('options', options);
    Console.log('results', results);
  });
});
```

```neptune[title=Party&nbsp;2,frame=frame3,scope=2]
var options = ['IPA', 'Lager', 'Stout', 'Pilsner'];
var input = [1, 0, 0, 0];

jiffClient.wait_for([1, 2, 3], function () {
  var results = [];
  for (var i = 0; i < options.length; i++) {
    var ithOptionShares = jiffClient.share(input[i]);
    var ithOptionResult = ithOptionShares[1].sadd(ithOptionShares[2]).sadd(ithOptionShares[3]);
    results.push(jiffClient.open(ithOptionResult));
  }

  Promise.all(results).then(function (results) {
    Console.log('options', options);
    Console.log('results', results);
  });
});
```

```neptune[title=Party&nbsp;3,frame=frame3,scope=3]
var options = ['IPA', 'Lager', 'Stout', 'Pilsner'];
var input = [0, 1, 0, 0];

jiffClient.wait_for([1, 2, 3], function () {
  var results = [];
  for (var i = 0; i < options.length; i++) {
    var ithOptionShares = jiffClient.share(input[i]);
    var ithOptionResult = ithOptionShares[1].sadd(ithOptionShares[2]).sadd(ithOptionShares[3]);
    results.push(jiffClient.open(ithOptionResult));
  }

  Promise.all(results).then(function (results) {
    Console.log('options', options);
    Console.log('results', results);
  });
});
```

Let us dive a bit deeper into this code. There are three jiff functions of interest that were used: *share*, *sadd*, and *open*.

The first and last function are JIFF's built in implementation of Shamir secret sharing share and reconstruct function from the previous tutorial.

### The _share_ function

The share function serves two purposes: (1) sharing the given input using shamir secret share with the parties (2) receiving a share from each party for its input.
Therefore, it corresponds to a share synchronization point between all parties. This design choice is inspired by our experience, demonstrating that a share operation
rarely involves one party.

The share function takes several optional parameters that can help customize its behavior.

```neptune[title=Share,scope=1,frame=frame4]
Console.log(jiffClient.share.toString().split('\n')[0]);
```

JIFF's documentation explain what these parameters mean.

```neptune[inject=true,language=html]
<img src="/static/images/share-docs.png" alt="JIFF documentation for the share function" style="width: 100%; margin-left: auto; margin-right: auto; display: block;"></img>
```

### JIFF's _SecretShare_ objects

The share function returns a map between party id and an object representing its share. These objects are called **SecretShare** objects. They wrap
the value of the share, and provide primitives to operate on it, such as _.sadd_ function for adding shares.

Additionally, because a share typically requires communication to be created, and because Javascript is single-threaded, the communication must be done asynchronously.
Hence, the value of the share cannot be accessed until later on. SecretShare objects include a promise that gets resolved when that value is available.
All operations on that SecretShare are scheduled to execute after the promise is resolved.

```neptune[title=Party&nbsp;1,frame=frame5,scope=1]
var shares = jiffClient.share(10, 2, [1, 2], [1, 2]);
Console.log(Object.keys(shares));
Console.log(shares[1].toString());
Console.log(shares[2].toString(), shares[2].value.toString());
shares[2].wThen(function (value) {
  Console.log('share resolved with value', value);
});
```
```neptune[title=Party&nbsp;2,frame=frame5,scope=2]
var shares = jiffClient.share(5, 2, [1, 2], [1, 2]);
```

### The _open_ function

Similar to share, the open function represents another synchronization point between parties. By default, a call to open refreshes (e.g. rerandomizes)
the SecretShare, and broadcasts it to all parties that holds an instance of that share. This can be customized as the open function also takes optional
arguments.

Because open involves asynchronous communication, a promise to the actual result is returned, which will be resolved when the result is available.

```neptune[title=Party&nbsp;1,frame=frame6,scope=1]
Console.log(jiffClient.open.toString().split('\n')[0]);
var promise = jiffClient.open(shares[1], [1, 3]);
Console.log(promise.toString());
promise.then(function (result) {
  Console.log(result);
});
```
```neptune[title=Party&nbsp;2,frame=frame6,scope=2]
var promise = jiffClient.open(shares[1], [1, 3]);
Console.log(promise == null);
```
```neptune[title=Party&nbsp;3,frame=frame6,scope=3]
// party 3 did not receive a share of this input, but it can still receive the output
// by calling receive_open!
var promise = jiffClient.receive_open([1, 2], [1, 3]);
Console.log(promise.toString());
promise.then(function (result) {
  Console.log(result);
});
```

### Asymmetry and Tradeoffs
In the last few code snippets, we already began to see how JIFF can be used asymmetrically. As input shares may be shared between
different subsets of parties, and parties code can be different acording to their role and capabilities. JIFF provides more highlevel
supports for asymmetry through some of its orchestration APIs (e.g. wait_for), synchronization ids, and high level protocols.

JIFF automatically matches synchronization points between different parties, even when their code may be radically different, using code
and message counters. The automatic ids are sufficient to synchronize correctly when any party's instructions can only be executed in one
possible order (no nesting of promises). For more complex scenarios, developers can manually synchronize by providing unique tags or synchronization
ids to operations that cause communication. The last optional parameter to the *share* function above is an example of such a id.

JIFF attempts to make the code look and feel synchronous, even when the actual implementation is very asynchronous, by using promises and scheduling
callbacks. A side effect of this is having unrestricted parallelism: operations are executed as soon as their promises are resolved, even when that
may cause operations to run in an order different to that of the code. This ensures minimal rounds of communication.

However, in the worst case, this may lead to the construction of a promises-dependence graph (e.g. promise circuit) of size equal to the
actual computation (as opposed to its code). All these promises and callbacks are stored in memory, which can lead to extreme use of memory
in large computations. In cases like that, a tradeoff must be made between space and time, by building parts of the graph only after previous parts
are completed, reducing the parallelism and memory usage.

### JIFF API Documentation

All of the public API of JIFF is documented using jsdocs. Including explanation of when and how to use the API, and example usage.

The docs are available in the /docs directory within the JIFF repo. Documentation for a specific version or branch of JIFF can be automatically generated,
by running the following command inside the repository in the desired branch or version commit.
```command-line
npm run gen-docs
```

# What's next?

The voting example demonstrated above has several problems: a cheating party can provide bad inputs, for example it may vote for multiple options,
or provide more than a single vote for one options. This is a common problem with MPC, as inputs are kept private. Any input sanitization code must be
implemented under MPC so that input privacy is preserved.

Additionally, the output of the vote itself leaks a lot of information. Consider the view of the third party. It knows the value of its vote ('Lager'), and
it knows the output, in particular, that two votes were cast for 'IPA'. Therefore, the two other parties must have voted for IPA. This is not the cases
for the first two parties, as they cannot be sure which party voted for 'Lager', as all possibilites are equally likely with their view, by MPC's security guarantees.

We address these two issues in the next tutorial.

