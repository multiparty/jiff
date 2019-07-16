In this tutorial, we'll look at the implemention of searching with two parties.

#### Problem Statement :
Suppose **party 1** has an array of values and **party 2** has a value.
We want to find out whether **party 1**'s value is present in **party 2**'s array, without either party knowing each others inputs.

## Set up and Connect Parties to the Server
Start with setting up the server and connecting parties to the server. <br>
Once the set up of the server and parties is taken care of, we can start the computation.

## Sharing
Party 1 shares the **array** to parties 1 and 2 :
``` javascript
function compute() {
   var array = [1, 2, 3, 4, 5]
   var shares = jiff_instance.share_array(array, null, 2, [1, 2], [ 1 ]);
}
```
Party 2 shares the **value** to parties 1 and 2 :
``` javascript
function compute() {
  var value = 4;
  var shares = jiff_instance.share(value, 2, [1, 2], [ 2 ]);
}
```
share_array is a secret share of the array shared by party 1. <br>
share_val is a secret share of the value shared by party 2.
``` javascript
var share_array = shares[1];
var share_val = shares[2];
```

## Linear Search
To implement regular linear search, we simply iterate through the values of an array and stop when we find the value we are looking for.
``` javascript
var array = [1, 2, 3, 4, 5];
var value = 2;

for (var i = 0; i < array.length; i++) {
  if (array[i] === value) {
   return true;
  } 
}
return false;
```

Notice how with regular linear search, we would stop the iteration early and this would leak:

 * the value being searched for (party 2's input) to **party 1**
 * the position of the value in the array (party 1's input) to **party 2**

Therefore, in order to implement linear search under MPC,
we must iterate through **all** the elements of the array before returning so that no information about the inputs is leaked.






## Binary Search