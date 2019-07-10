# Why Use JIFF?
My group of friends and I are planning a vacation together. We want to see if we can afford a certain trip (let's say total it would cost $5000) but none of us want to reveal how much we are willing to pay (maybe not the greatest friends...). Hey, I have an idea! Let's use JIFF to compute our total budget without sharing how much any individual is willing to pay. Then we can see if we can afford the trip and no one has to reveal their personal budget.

Here's what we'll do:
1. Install JIFF
2. Set up a server to help us coordinate and communicate
3. Each of us will use JIFF to (securely) our personal budget. This won't reveal anyone's information, but will allow us to work together to compute what we want to know (if we can afford our $5000 vacation).
4. Together, we'll compute the sum of our personal budgets, and compare this to the $5000 expense.
5. At the end, we'll only reveal if our total budget is greater or equal to $5000, the total budet can stay a secret!
6. Go on vacation!! (hopefully)

We'll walk through the process step-by-step, and at the end we'll have two working files: one to run the server, and one for each freind participate with.


# Installing JIFF
First, we'll install JIFF via npm:
```sh
npm install jiff-mpc
```

# Using JIFF
Now, we need to set up a server to pass messages between each other.
## Setting up the Server
The server only needs to contain one file, server.js. We simply make a jiff server instance, and listen on an open port:

```javascript
require('../../lib/jiff-server').make_jiff(http, { logs:true });

// Serve static files.
http.listen(8080, function () {
  console.log('listening on *:8080');
});
```

## Defining a JIFF Client
First, each friend makes a jiff client instance to participate in the computation. We'll call our computation 'our_computation':

```javascript
jiff = require('../../lib/jiff-client');
var my_jiff_instance = jiff.make_jiff('localhost:8080', 'our_computation');
```
Here we define the jiff instance, tell it to connect to the server running on localhost, and specify which computation we want to be part of.

## Computation
The JIFF instance lets us do all sorts of fun things, like (securely) sharing our input with all the parties in our computation. This is done with the jiff.share() method:

```javascript
var my_budget = 1000;
var shares = my_jiff_instance.share(my_budget);

```
the variable `shares` contains one secret-share of the value each friend sent (using the same code as us), as well as a secret-share of our budget.

Next let's sum everybody's budget together. For now, we'll assume there are only two of us planning the vacation (we can invite more people later!)
```javascript
var total_budget = shares[1].add(shares[2]);

```
The `add()` is a function on the secret-share object, which will return another secret share of the sum. Here we're adding two secret shares together, but we could also use it to add a public constant to a share.

The secret-share object has lots of useful functions defined for arithemtic operations(lke `add()`) as well as for comparisons.
We'll use a comparison to check if our total budget meets the cost of the vaction:
```javascript
var is_enough = sum.gteq(5000);
```
`is_enough` is also a secret share, but this time we know the true value will either be a 1 or a 0, depending on the result of the comparison.

Finally, we can reveal the result of our computation by opening the value contained in `is_enough`:
```javascript
var result = my_jiff_instance.open(is_enough);
```
Because we might be waiting for other people in the computation, `result` is actually a promise to a value, so we can't immediately print it out. Instead we'll wait for the promise to be resolved before printing anything:

```javascript
result.then(function (result) {
  if (result) console.log("We're going on vacation!");
  else console.log("We can't afford to go :(");
});
```

# Running the Whole Computation
Now that we know how to use the different features of JIFF, let's do some refactoring to make our program a bit more robust.

First we'll take input from the command line for our budget instead of hardcoding it:
```javascript
var my_budget = parseInt(process.argv[2], 10);
```
We should also build an object with the JIFF options and pass that to make_jiff, to make it more readable if we add anything in the future:
```javascript
var options = {'party_count': 2};
```
To make sure the client waits to connect before doing anything, we'll wrap our computation in a function and pass it to the JIFF instance as the `onConnect` option:
```javascript
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
```
Now we can make our JIFF instance and pass it everything it needs in the options parameter:
```javascript
var my_jiff_instance = jiff.make_jiff('localhost:8080', 'our_computation', options);
```
And that's it!
As soon as we connect to the server, our `onConnect` function will execute and we'll send shares to the other parties (when they're connected as well), run our computation and get the result, then disconnect from the server.

## Complete Files
### party.js
```javascript
jiff = require('../../lib/jiff-client');

var my_budget = parseInt(process.argv[2], 10);

var options = {'party_count': 2};
options.onConnect = function(my_jiff_instance) {

  var shares = my_jiff_instance.share(my_budget);

  var total_budget = shares[1].add(shares[2]);
  var result = my_jiff_instance.open(is_enough);

  result.then(function (result) {
    if (result) console.log("We're going on vacation!");
    else console.log("We can't afford to go :( ");

    jiff_instance.disconnect(false, true);
  });

};

var my_jiff_instance = jiff.make_jiff('localhost:8080', 'our_computation', options);

```
### server.js
```javascript
var express = require('express');
var app = express();
var http = require('http').Server(app);

//Serve static files
//Configure App
app.use('/demos', express.static('demos'));
app.use('/lib', express.static('lib'));
app.use('/lib/ext', express.static('lib/ext'));

require('../../lib/jiff-server').make_jiff(http, { logs:true });

// Serve static files.
try {
  http.listen(8080, function () {
    console.log('listening on *:8080');
  });
} catch (err) {
  console.log('ERROR:'+err.message)
}

console.log('To run a node.js based party: node party <input>');
```
