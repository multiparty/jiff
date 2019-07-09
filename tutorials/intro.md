# installing JIFF
JIFF can be installed via npm:
```
npm install jiff-mpc
```

# Set up
For our first JIFF applicion, we will have two parties that want to find the sum of their private values. To facilitate communication, we will first set up a JIFF server that routes messages.

# Setting up the Server
The server only needs to contain one file, server.js. First we will simply make a jiff server instance, and listen on an open port

```javascript
require('../../lib/jiff-server').make_jiff(http, { logs:true });

// Serve static files.
http.listen(8080, function () {
  console.log('listening on *:8080');
});
```

# Defining a JIFF Client
The two parties first need to connect to the JIFF server, and then can securely compute to their hearts' content.

First, we'll make a local jiff instance that connects to our server running on localhost, we'll call our computation 'our_computation':
```
my_jiff_instance = jiff.make_jiff('localhost:8080', 'our_computation');
```

## Computation
The JIFF instance lets us do all sorts of fun things, like (securely) sharing our input with all the parties in our computation. This is done with the jiff.share() method

```javascript
var my_super_secret_input = 10;
var shares = my_jiff_instance.share(my_super_secret_input);

```

Next, we want to sum both parties inputs:
```
var sum = shares[1].add(shares[2]);

```
And, finally, we can reveal the result of our computation by opening the sum variable:
```
var result = my_jiff_instance.open(sum);
```
