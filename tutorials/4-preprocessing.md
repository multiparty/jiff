# What is Preprocessing?
In general, MPC is much slower than standard computation - mostly due to communication costs between parties. While some operations are free (meaning they only rely on local computation), such as secure addition, other operations (e.g. secure multiplication) incur high communication costs. Specifically for multiplication, the protocol used in JIFF relies on helper values of a certain form, called beaver triples (a,b,c such that a\*b=c). In JIFF, preprocessing of beaver triples is accomplished via multiplication with the BGW protocol.

While preprocessing still incurs communication costs, it can ideally be executed before data is ready to be shared or before all parties online, which leads to a faster online phase.


# How to Use Preprocessing in JIFF
The `jiff.preprocessing()` exists to preprocess any values needed for later computation. All preprocessing needs to know is which operations will be performed and how many times, so the programmer does not need to know what other protocols or values those depend on.

For example, if we are going to compute a global average on a large dataset - we may not know the number of input rows, but we know there will be one division at the end. So, no matter how many additions we are performing, there will only ever be one secure division. To preprocess for this case in JIFF we call preprocessing and pass it `cdiv` as the dependent operation. We use cdiv because the number of inputs is likely public:
```javascript
jiff.preprocessing('cdiv', 1);
```
The preprocessing function takes many more optional parameters, but for our very simple example that is all it needs. After we've dealt with all the operations we anticipate performing, we need to tell JIFF we've finished:
```javascript
jiff.finish_preprocessing();
```
This is important for synchronization during the online-phase of computation, to ensure allparties are using the same pre-processed values for the same operations.
Later, when we perform the secure division, any values that it relies on will be pulled from the table which stores preprocessed values:
```javascript
// let's assume the number of inputs is public
var number_of_inputs = 100;
var average = sum.div(number_of_inputs)
```
Calling `div()` as opposed to `cdiv` is okay here, as JIFF will recognize that `number_of_inputs` is a public constant and internally use the logic for constant division. You can almost always use the generic arithemtic operators (e.g. div, mult, add, sub) and JIFF will decide whether to use the protocol for operations by a secret share or by a constant.

## A More Complicated Scenario
In the simple example above, all parties are involved in preprocessing as well as main computation, this is not always going to be the case. In addition, we may have a much more complicated computation than an average.

For this example, let's imagine we have a large database of user preferences and we want to cluster users based on these, but without revealing any individuals' preferences. Additionally, users may change their preferences and we want to recompute the clusters every day. This type of constraint solving is likely to involve many comparisons and multiplications.

Some of the servers might always be online, but others only come online to submit the updated user preferences and execute the constraint-solver. In this case we can have the group of servers that is always online perform all the necessary pre-processing before the other servers come online every day and then share the values as soon as they connect.
```javascript
// define what operations we need to preprocess for, and how many of each
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
  // we'll leave the 'batch', 'protocols', and 'threshold' parameters null for now
  // and let JIFF use the defaults
  jiff.preprocessing(op, operations[op], null, null, null, receivers, compute_parties)
}
jiff.finish_preprocessing();
```
This way, all of the values that multiplications and comparisons rely will be created and distributed before the start of any computation.

By specifying the receivers as all parties, we tell JIFF to reshare all the helper values at the end with everyone, not just the three servers that helped generate the values.

While we can definitely handle preprocessing for 100 multiplications and 100 comparisons, if we are doing thousands of each we may run out of memory from passing and storing so many messages and promises. Depending on the memory constraints of the systems we are using - we can configure JIFF preprocessing to batch the preprocessing computation to avoid any memory issues. This is what the `batch` parameter is for, we specify the number of operations to preprocess for concurrently before stopping and cleaning up the promises and messages to save memory.
Let's say we are preparing for 5000 multiplications, we may want to perform this in batches of 100:
```javascript
var operations = {'smult': 5000};
for (var op in operations) {
  jiff.preprocessing(op, operations[op], 100, null, null, receivers, compute_parties)
}
```
# What If We Don't Preprocess anything?
In the case that JIFF tries to perform an operation which needs preprocessing, but none has been performed - the default behavior is to fail:
```sh
 UnhandledPromiseRejectionWarning: Error: No preprocessed value(s)
that correspond to the op_id "smult:1,2:0:triplet"
```

The other option is to have the server (which may also be a part of the computation) provide values to all parties for the operations, which happens at the time of computation. This can be configured when creating a jiff instance by setting the `crypto_provider` option to true:
```javascript
var jiff_instance = jiff.make_jiff(server_address, 'comp_id', {'crypto_provider': true} );
```
If no operations preprocessed for, the server will be queried for anything that requires it. If some operations were specified for preprocessing, but later more operations were added and there are not enough preprocessed values, the server will be queried for any operations that happen after the parties have run out of preprocessed values.

While this allows you to get values such as beaver triples just-in-time, it also requires that you trust the coordinating server to generate these values fairly and honestly, which may or may not be part of your logistical assumptions. It is recommended that you pre-process for all operations that you anticipate performing.
It also requires extra communication with the server during the main phase of computation.


# Which Operations Require Preprocessing
As mentioned earlier, not all operations on secret shares require pre-processing. For example, secure addition and secure subtraction require only local computation and don't need any helper values. Below is a table of all JIFF secret-share protocols that require preprocessing:

| Protocol |
|----------|
| smult    |
| sdiv     |
| sxor_bit |
| slt      |
| cgt      |
| clt      |
| clt_bits |
| cdiv     |
| smod     |
| if_else  |
| sor_bij  |
| slteq    |
| sgteq    |
| sgt      |
| clteq    |
| cgteq    |
| seq      |
| sneq     |
| ceq      |
| cneq     |

