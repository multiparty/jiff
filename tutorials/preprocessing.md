# What is Preprocessing?
In general, MPC is much slower than standard computation - mostly due to communication costs between parties. While some operations are free (meaning they only rely on local computation), such as secure addition, other operations (e.g. secure multiplication) incur high communication costs. Specifically for multiplication, the protocol used in JIFF relies on helper values of a certain form, called beaver triples (a,b,c such that a\*b=c).

Preprocessing allows us to compute and distribute these values before the main phase of computation, which results in much lower communication costs during the online phase of a computation.

While preprocessing still incurs communication costs, it can ideally be executed before data is ready to be shared or before all parties online, which stops the generation of beaver triples and other helper-values from becoming a bottleneck during the online-phase.

# How to Use Preprocessing in JIFF
The `jiff.preprocessing()` exists to preprocess any values needed for later computation. All preprocessing needs to know is which operations will be performed and how many times, so the programmer does not need to know what other protocols or values those depend on.

For example, if we are going to compute a global average on a large dataset - we may not know the number of input rows, but we know there will be one division at the end. So, no matter how many additions we are performing, there will only ever be one secure division. To preprocess for this case in JIFF we call preprocessing and pass it `sdiv` as the dependent operations:
```javascript
jiff.preprocessing('sdiv', 1);
```
The preprocessing function takes many more optional parameters, but for our very simple example that is all it needs. After we've dealt with all the operations we anticipate performing, we need to tell JIFF we've finished:
```javascript
jiff.finish_preprocessing();
```
This is important for synchronization during the online-phase of computation, to ensure allparties are using the same pre-processed values for the same operations.


## A More Complicated Scenario
In the simple example above, all parties are involved in preprocessing as well as main computation, this is not always going to be the case. In addition, we may have a much more complicated computation than an average.

For this example, let's imagine we have a large database of user preferences and we want to cluster users based on these, but without revealing any individuals' preferences. Additionally, users may change their preferences and we want to recompute the clusters every day. This type of constraint solving is likely to involve many comparisons and multiplications.

Let's say some of the servers are always online, but others only come online to submit the updated user preferences and execute the constraint-solver. In this case we can have the group of servers that is always online perform all the necessary pre-processing before the other servers come online every day and then share the values as soon as they connect.
```javascript
// define what operations we need to preprocess for
var operations = {'smult': 100, 'slt': 100};

// define a receviers list, which parties will receive the preprocessed values (all for now)
var receivers = [];
for (var p = 1; p <= jiff.party_count; p++) {
  receivers.push(p);
}

// define the compute list, which parties will participate in the preprocessing
// we'll say parties 1, 2, and 3 are always online
var compute_parties = ['1', '2', '3']


for (var op in operations) {
  // we'll leave the 'batch', 'protocols', and 'threshold' parameters null for now and let JIFF use the defaults
  jiff.preprocessing(key, operations[key], null, null, null, receivers, compute_parties)
}
jiff.finish_preprocessing();
```
This way, all of the values that multiplications and comparisons rely will be created and distributed before the start of any computation.
# What If We Don't Preprocess anything?
In the case taht you don't know what operations will be performed in the future
