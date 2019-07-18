In this tutorial, we'll look at the implemention of searching with two parties.

##Problem Statement :
Suppose **party 1** has an array of values and **party 2** has a value.
We want to find out whether **party 1**'s value is present in **party 2**'s array, without either party knowing each others inputs.
-------------------------------------------------------------------------
Let's start with the set up.

# Set up a server
We're going to stick with our simple server-as-message-router model from before. The `express` package provides a web framework, which we want to use over `http`. This code goes in the file `server.js`.

```javascript
var express = require('express');
var app = express();
var http = require('http').Server(app);
```

We configure the server to know where our libraries live.
```javascript
require('../../lib/jiff-server').make_jiff(http, { logs:true });
app.use('/demos', express.static('demos'));
app.use('/lib', express.static('lib'));
app.use('/lib/ext', express.static('lib/ext'));
```

Now we can set our server to run locally on port 8080.
```javascript
http.listen(8080, function() {
  console.log('listening on localhost:8080');
});
```

# Implementing client code
The client program has two jobs: they connect to the server, and they work together to search under MPC. <br>
In this tutorial, we will implement searching with 2 parties: <br>
**party 1** will input the array and **party 2** will input the value being searched for.

## Connecting to the server 
In the file `client.js`, we start by connecting to the server. First, we define the `hostname` that the server above is running on. Second, since this is a multi-party computation, we need to tell the server how many parties there are (`party_count`), and the name of our computation(`computation_id`). 

The `make_jiff` function uses this information to set up a new JIFF object.
We save the fully configured `jiff_instance` in a global variable, so we can use it when we compute our function.

```javascript
var jiff_instance; 

function connect() {

  var hostname = "http://localhost:8080";

  var computation_id = 'search'; 
  var options = {party_count: 2}; 

  // TODO: is this necessary if we're using npm?
  if (node) {
    jiff = require('../../lib/jiff-client');
    $ = require('jquery-deferred');
  }

  jiff_instance = jiff.make_jiff(hostname, computation_id, options);
}
```

# Start the Computation
Once the set up of the server and parties is taken care of, we can start the search computation.
The function outline shares our (hard-coded) input values, executes some computation, and logs the result when it is ready. Again, in `client.js`:
```javascript
function compute() {
  var input1 = [1, 2, 3, 4, 5];
  var input2 = 4;
  
  // share inputs
  ...

  // search
  ...

  // print results
  ...
}
```
The first step is to share our input with the rest of the parties. We use our saved and configured jiff_instance to do so. This operation is asynchronous—it requires communicating with every party to secret share the data—so it returns a promise.

Party 1 shares the **array** to parties 1 and 2. <br>
Party 2 shares the **value** to parties 1 and 2. <br>
``` javascript
var shares;
   
// share inputs
if (jiff_instance.id === 1) {
  shares = jiff_instance.share_array(input1, null, 2, [1, 2], [ 1 ]);
} else {
  shares = jiff_instance.share(input2, 2, [1, 2], [ 2 ]);
}  
```
Once both parties' input is shared, an object is returned containing the shares from every party. It has the form
```
{1 : [<party 1's array>], 2 : <party 2's value> }
```
We can then store the secret shares received by parties 1 and 2.
``` javascript
var array = shares[1];
var value = shares[2];
```

## Linear Search
Now that we have each parties shares, we can start the search computation. <br>
Let's start with implementing linear search first.
``` javascript
var result = linearsearch( array, value);
```
Regular linear search without MPC simply iterates through the values of 
an array and stops when the value we are looking for is found.
``` javascript
function linearsearch(array, value) {
  for (var i = 0; i < array.length; i++) {
    if (array[i] === value) {
      return true;
    } 
  }
  return false;
}
```
Notice how using regular linear search would stop the iteration early and leak:

 * the value being searched for (party 2's input) to **party 1**
 * the position of the value in the array (party 1's input) to **party 2**
---------------------------------------------------------------------------------------------
Therefore, in order to implement linear search under MPC,
we must iterate and compute on **all** the elements of the array.

We start by checking if a secret share in the array are equal to the value. <br>
This comparison will result in a secret share with a bit value (1 or 0), representing **true** or **false**. <br>
We then 'or' each secret share bit and return the result.

```javascript
function linearsearch(array, value) {
  var result = array[0].eq(value);
  for (var i = 1; i < array.length; array++) {
    cmp = array[i].eq(value);
    result = result.or_bit(cmp);
  }
  return result;
}
```
Finally, we need to reveal the results to each party. We use the JQuery deferred function to resolve
the results from all parties and reveal them correctly. We set this up before our promise and return
it afterward. Our complete compute function looks like this:
```javascript
function compute() {
   var shares; 
   var input1 = [1, 2, 3, 4, 5];
   var input2 = 4;
   
   var deferred = $.Deferred();
   
   // share inputs
   if (jiff_instance.id === 1) {
     shares = jiff_instance.share_array(input1, null, 2, [1, 2], [ 1 ]);
   } else {
     shares = jiff_instance.share(input2, 2, [1, 2], [ 2 ]);
   }
   
   var array = shares[1];
   var value = shares[2];
   
   // compute search
   var result = linearsearch( array, value);
   
   // open
   result.open().then(function (final_result) {
     deferred.resolve(final_result);
   });
   
   // print result
   deferred.promise.then(function (result) {
     console.log('search result:', result);
   });
}
```
## Binary Search
Next, we'll implement binary search under MPC. If you are not familiar with how binary search works, see this [tutorial].

In regular binary search, we split the array in half and decide whether to continue searching on the right or left half depending on the value in the middle.
This decision, if implemented in the usual way, would leak some information about the values being compared.

Therefore, we
