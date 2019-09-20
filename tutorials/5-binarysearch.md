In this tutorial, we'll look at implementing searching with two parties. <br>
Let's say **party 1** inputs an array of values and **party 2** inputs a value to search for. They both want to find out whether the value exists in the array but neither party is willing to reveal its inputs.

To solve this, we can search under MPC and without revealing parties' inputs, return:<br>
- 1 if the value exists in party 1's array
- 0 if the value is not found in the array.
-----------------------------------------------------------------------------

# Setting up a server
We're going to stick with our simple server-as-message-router model from before. The server.js file will look the same as in the [intro tutorial](/multiparty/jiff/tutorials/1-intro.md).

# Implementing client code
The client program has two jobs: it connects to the server, and works with the server to search under MPC. <br>
In this tutorial, we will implement searching with 2 parties: <br>
**party 1** will input the array and **party 2** will input the value being searched for.

# <a name="Start-the-Computation"></a> Start the Computation
Once the set up of the server and parties is taken care of, we can start the search computation.
The function outline below shares our (hard-coded) input values, executes some computation, and logs the result when it is ready. Again, in the `client.js` program:
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
var result = linear_search(array, value);
```
As you can see below, regular linear search without MPC simply iterates through the values of
an array and stops when the value we are looking for is found.
``` javascript
function linear_search(array, value) {
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

We start by checking if each secret share in the array is equal to the value. <br>
This comparison will result in a secret share with a bit value (1 or 0), representing **true** or **false**. <br>
We then 'or' each secret share bit together and finally, return the result.

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
Finally, we need to **open** and reveal the results to each party. We set up the JQuery `deferred` function to wait for the results and once the results from all parties have been opened and revealed correctly, we can resolve it. <br>
Now that each party has opened their result, we can **print** the result.

Our complete compute function looks like this:
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
Next, we'll implement binary search under MPC. <br>
We'll use the outline of the `compute` function [above](#Start-the-Computation) and simply change the `linear_search` function to use a `binary_search` function instead.<br>
```javascript
var result = binary_search( array, value);
```
If you are not familiar with how binary search works, read this [tutorial](https://medium.com/karuna-sehgal/a-simplified-interpretation-of-binary-search-246433693e0b) first.

In regular binary search, we split the array in half and decide whether to continue searching the left or right half depending on the value in the middle.
This decision, if implemented in the usual way, would leak whether the condition is fulfilled or not and therefore, also leak information about the values being compared.

To solve this problem, JIFF has a helpful `if_else` function, which does not reveal any information about the decision taken.<br>
The `if_else` function (part of the secret share object) is expected to be called from a secret share bit and takes 2 arguments, **trueVal** and **falseVal**.
If the secret share's bit value is **1**, **trueVal** is returned or, if the secret share's bit value is **0**, **falseVal** is returned.<br>
No information about the values being compared is leaked here, because the values are hidden in secret shares and it cannot be determined if the condition was fulfilled.

Let's look at how to use the `if_else` function to decide which half of the array to continue searching on.
```javascript
// comparison condition
var mid = Math.floor(array.length/2);
var cmp = element.lt(array[mid]);

// Slice array in half, choose slice depending on cmp
var nArray = [];
for (var i = 0; i < mid; i++) {
  var c1 = array[i];
  var c2 = array[mid+i];
  nArray[i] = cmp.if_else(c1, c2);
}
```
As you can see above, **cmp** is the secret share bit returned by the comparison ( element < array[mid] ).<br>
If **cmp**'s bit is 1, the first half of the array will be returned. If **cmp**'s bit is 0, the second half of the array will be returned.

--------------------------------------------------------------------------------
Now that we understand how to split the array and continue searching on one half of the array, we can complete the `binary_search` function.

```javascript
function binary_search(array, element) {
  if (array.length === 1) {
    return array[0].seq(element);
  }

  // comparison
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
----------------------------------------------------------
We have now implemented linear and binary search. <br>
As a last step, we need to make sure the connecting and computation functions can be accessed by other files, so we wrap all the code in a wrapper.

```javascript
(function (exports, node) {
  ...
  function connect() { ... }
  function compute() { ... }

  exports.connect = connect;
  exports.compute = compute;

}((typeof exports === 'undefined' ? this.mpc = {} : exports), typeof exports !== 'undefined'));
```
