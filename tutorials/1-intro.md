# Why Use JIFF?
My group of friends and I are planning a vacation together. We want to see if we can afford a certain trip (let's say total it would cost $5000) but none of us want to reveal how much we are willing to pay (maybe not the greatest friends...). Hey, I have an idea! Let's use JIFF to compute our total budget without sharing how much any individual is willing to pay. Then we can see if we can afford the trip and no one has to reveal their personal budget.

The JIFF workflow looks like this. As a group, we
1. Install JIFF
2. Set up a central server to coordinate and communicate
3. Define the function we'd like to compute. In this case, we'll sum our personal budgets and compare to the $5000 threshold.

Then, we individually
4. Input our personal budgets. Input to JIFF is secret shared, which means that no other participants will know the value of our input.
5. Execute the function and reveal the result. We'll communicate via the server, but again, nobody will learn anything until we all coordinate to publicly reveal the answer.

If the result of the computation says that our group budget is at least $5000, then we can go on vacation!

We'll walk through this process step-by-step. We need to define two software artifacts: a server that coordinates the communication between each party, and a client, which defines the function we want to execute and is run by each friend individually.

# Installing JIFF
First, we'll install JIFF via `npm` on the command line:
```sh
$ npm install jiff-mpc
```


# Setting up the Server
We need to set up a server to pass messages between all the friends. The server hosts an `http` page and a message router. When computation parties need to communicate, they send their messages to the server, which forwards them to the final recipient. 

This communication logic is all defined in JIFF's server code. To run a computation, we need to set up an `http` server and initialize a JIFF instance.
This can be defined in a single file, which we call `server.js`. 

The `express` package provides a web framework, which we use over `http`. 
```javascript
var express = require('express');
var app = express();
var http = require('http').Server(app);
```

We tell the server where our libraries live.
```javascript
require('../../lib/jiff-server').make_jiff(http, { logs:true });
app.use('/demos', express.static('demos'));
app.use('/lib', express.static('lib'));
app.use('/lib/ext', express.static('lib/ext'));
```

Then we can set the server to run locally on an open port 8080.
```javascript
http.listen(8080, function() {
  console.log('listening on localhost:8080');
});
```

## Defining a JIFF Client
First, each friend will run a JIFF client to participate in the computation. The client exports two main functionalities: connecting to the server and executing the computation. The client logic is in the file `party.js`:

We start by connecting to the server. We fill in the `hostname` that the server above is running on and the name of our computation (`computation_id`). We'll call this computation `'vacation'`.

The `make_jiff` function uses this information to set up a new JIFF object.
We save the fully configured `jiff_instance` in a global variable, so we can use it when we compute our function.

We also need to tell the client where the JIFF client code is kept.

```javascript
// TODO: is this necessary if we're using npm?
jiff = require('../../lib/jiff-client');
jiff_instance = jiff.make_jiff('localhost:8080', 'vacation');
```

## Implementing our vacation function
Now we get to the fun part: defining the function we wish to securely evaluate. The `jiff_instance` contains all the primitives we need to securely share and operate on our data.

We start by sharing our individual budgets. This is done with the `jiff.share()` method. Since each party runs this separately, they will each define the `my_budget` variable to an appropriate amount.

```javascript
var my_budget = 1000;
var shares = my_jiff_instance.share(my_budget);

```
By default, the `share` function assumes that every party will provide an input. It returns an object that contains secret shares of everyone's values. This is the JSON encoding of this object:
```json
{ 1: <SecretShare>, 2: <SecretShare>, ..., n: <SecretShare> }
```
Each `SecretShare` object contains a fragment of the input associated with that party and defines [other useful functions](https://multiparty.org/jiff/docs/jsdoc/SecretShare.html) for arithmetic operations and comparisons.

We sum everybody's budget together to determine how much money we have to spend. For now, we'll assume there are only three of us planning the vacation (we can invite more people later!)

```javascript
var total_budget = shares[1].add(shares[2]).add(shares[3]);
```
We'll use a comparison to check if our total budget meets the cost of the vaction:
```javascript
var is_enough = sum.gteq(5000);
```
The variable `is_enough` is also a secret share, but we know it's a boolean value--either 0 or 1--depending on the result of the comparison.

Finally, we reveal the result of our computation by opening the value contained in `is_enough`. This operation has all parties reveal their individual secret shares to determine the true value.
```javascript
var result = my_jiff_instance.open(is_enough);
```
Since we might have to wait for other people to `open` their shares, `result` is actually a promise to a value. We'll wait for the promise to be resolved before printing our final result:

```javascript
result.then(function (result) {
  if (result) console.log("We're going on vacation!");
  else console.log("We can't afford to go :(");
});
```

# Running the Whole Computation
Now that we know how to use the different features of JIFF, let's do some refactoring to make our program a bit more robust.

First we'll take input from the command line for our budget instead of hardcoding it. This way, parties don't have to change the `party.js` file.
```javascript
var my_budget = parseInt(process.argv[2], 10);
```
We can build an object with to define JIFF options and pass it to `make_jiff`. This is more readable if we want to add [custom options](https://multiparty.org/jiff/docs/jsdoc/jiff.html#.make_jiff) in the future:
```javascript
var options = {'party_count': 3};
```
To make sure the client waits to connect before doing anything, we'll wrap our computation in a function and pass it to the JIFF instance as the `onConnect` option:
```javascript
options.onConnect = function(my_jiff_instance) {

  var shares = my_jiff_instance.share(my_budget);

  var total_budget = shares[1].add(shares[2]).add(shares[3]);
  var is_enough = sum.gteq(5000);
  var result = my_jiff_instance.open(is_enough);

  result.then(function (result) {
    if (result) console.log("We're going on vacation!");
    else console.log("We can't afford to go :( ");

    jiff_instance.disconnect();
  });
};
```
Now when we make our JIFF instance, we'll pass it everything it needs in the `options` parameter:
```javascript
var my_jiff_instance = jiff.make_jiff('localhost:8080', 'vacation', options);
```
And that's it!
When we connect to the server, our `onConnect` function will automatically execute. We'll send shares to the other parties as they connect, jointly run our computation and get the result, then disconnect from the server.

Remember you'll need someone else (or another shell) to run `party.js` as well, since it wouldn't be multi-party computation with just one person!

## Complete Files
### party.js
```javascript
jiff = require('../../lib/jiff-client');

var my_budget = parseInt(process.argv[2], 10);

var options = {'party_count': 3};
options.onConnect = function(my_jiff_instance) {

  var shares = my_jiff_instance.share(my_budget);

  var total_budget = shares[1].add(shares[2]);
  var result = my_jiff_instance.open(is_enough);

  result.then(function (result) {
    if (result) console.log("We're going on vacation!");
    else console.log("We can't afford to go :( ");

    jiff_instance.disconnect();
  });
};

var my_jiff_instance = jiff.make_jiff('localhost:8080', 'vacation', options);
```

### server.js
```javascript
var express = require('express');
var app = express();
var http = require('http').Server(app);

// Configure app to serve static files
app.use('/demos', express.static('demos'));
app.use('/lib', express.static('lib'));
app.use('/lib/ext', express.static('lib/ext'));

// Set up server jiff instance
require('../../lib/jiff-server').make_jiff(http, { logs:true });

// Run app
try {
  http.listen(8080, function () {
    console.log('listening on *:8080');
  });
} catch (err) {
  console.log('ERROR:'+err.message)
}

console.log('To run a node.js based party: node party <input>');
```
