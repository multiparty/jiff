# What is Preprocessing?
In general, MPC is much slower than standard computation - mostly due to communication costs between parties. While some operations are free (meaning they only rely on local computation), such as secure addition, other operations (e.g. secure multiplication) incur high communication costs.
One approach to reduce this communication cost is to rely on preprocessing: the idea that certain tasks can be performed ahead of time (even without knowing the inputs) to speed up
the actual online computation.

JIFF relies on the preprocessing model to speed up many primitives. JIFF uses preprocessing to generate a variety of helper values and correlated randomness
that is consumed online by the respective primitives. For example, secure multiplication relies beaver triples: three uniformly-random secret shared numbers
a, b, and c, such that a*b = c.

While preprocessing still incurs communication costs, it can ideally be executed before data is ready to be shared or before all parties online, which leads to a faster online phase.
Protocols used in preprocessing typically do not require preprocessing themselves. For example, preprocessing of beaver triples is accomplished via multiplication with the BGW protocol.

JIFF allows users to gain variable levels of control over the preprocessing stage. For most workflows, it is sufficient for users to specify what operations
their online computations execute, and JIFF can preprocess required helper values for these operations automatically. Additionally, users can specify which parties
should perform which piece of the preprocessing. Advanced users can specify which preprocessing protocols to use, or can provide their own custom ones.

Online operations for which preprocessing was not performed will attempt to get their needed correlated randomness from the server only if crypto provider is enabled.
Otherwise, an exception will be thrown indicating that preprocessing must be performed for that operation.

#### Tutorial content:
1. Basic pre-processing workflow
2. Pre-processing for an inner product (based on the previous tutorial)
4. Delegating preprocessing to a subset of parties
5. Consequences of not preprocessing
6. List of JIFF primitives that require pre-processing, and any protocol/primitive specific parameters

# How to Use Preprocessing in JIFF
The `jiffClient.preprocessing()` function is the main API call for specifying preprocessing tasks. All preprocessing needs to know is which operations will be performed and how many times, so the programmer does not need to know what other protocols or values those depend on.

The order of operations need not match the order preprocessing is called for them, only their counts.

Additionally, preprocessing takes additional optional parameters that allow customization of the preprocessing execution.

Each call to preprocessing returns a promise that is resolved when the preprocessing for the specified operation
is done.

```neptune[language=javascript,frame=norun1,run=false,title=Preprocessing&nbsp;Tasks]
var promise1 = jiff.preprocessing(<operation>, <number of times operation is used>);
var promise2 = jiff.preprocessing(<operation>, <number of times operation is used>,
    // these are optional parameters
    <custom protocols>,
    <threshold>, <receivers list>, <compute list>, <Zp>,
    <id list>, <protocol specific parameters>);
```

Calling jiffClient.preprocessing does not start the preprocessing for the given operations. It merely schedules a
preprocessing task corresponding to the given parameters. Tasks scheduled so far can be run by calling jiffClient.executePreprocessing.

calls to jiffClient.preprocessing and jiffClient.executePreprocessing can be interleaved. jiffClient.executePreprocessing
takes a callback as a parameter, which is called when all the preprocessing tasks schedules prior to the call are completed.

It is recommended to only run the online portion of the protocol when that callback is called, but not before.

```neptune[language=javascript,frame=norun2,run=false,title=Preprocesing&nbsp;Execution]
// this takes a callback to the main phase of computation
// it must be called AFTER all preprocessing tasks have
// been assigned using jiff.preprocessing
jiff.executePreprocessing(function() {
    /*
     * Main/online phase of computation...
     */
});
```
Now let's look at a concrete example:

# Setup

Most our preprocessing protocols assume an honest majority (i.e. based on BGW). Therefore, we cannot provide meaningful security
for two parties, and we must have three or more parties. In the case where we have only two parties, the use of the server as a crypto\_provider
is equivalent to having an honest majority computation between three parties, one of which is the server.

Our setup is similar to previous tutorials.

```neptune[title=Server,frame=frame1,env=server]
var JIFFServer = require('../../../../../lib/jiff-server.js');
var jiff_bignumber = require('../../../../../lib/ext/jiff-server-bignumber.js');

var jiff_instance = new JIFFServer(server, { logs:true });
jiff_instance.apply_extension(jiff_bignumber);

Console.log('Server is running on port 9111');
```

```neptune[title=Party&nbsp;1,frame=frame1,scope=1]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 3, party_id: 1, onConnect: onConnect, autoConnect: false, integer_digits: 3, decimal_digits: 2 };
var jiff_instance = new JIFFClient('http://localhost:9111', 'preprocessing-application', options);
jiff_instance.apply_extension(jiff_bignumber, options);
jiff_instance.apply_extension(jiff_fixedpoint, options);
jiff_instance.connect();
```

```neptune[title=Party&nbsp;2,frame=frame1,scope=2]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 3, party_id: 2, onConnect: onConnect, autoConnect: false, integer_digits: 3, decimal_digits: 2 };
var jiff_instance = new JIFFClient('http://localhost:9111', 'preprocessing-application', options);
jiff_instance.apply_extension(jiff_bignumber, options);
jiff_instance.apply_extension(jiff_fixedpoint, options);
jiff_instance.connect();
```

```neptune[title=Party&nbsp;3,frame=frame1,scope=3]
function onConnect() {
  Console.log('All parties connected!');
}

var options = { party_count: 3, party_id: 3, onConnect: onConnect, autoConnect: false, integer_digits: 3, decimal_digits: 2 };
var jiff_instance = new JIFFClient('http://localhost:9111', 'preprocessing-application', options);
jiff_instance.apply_extension(jiff_bignumber, options);
jiff_instance.apply_extension(jiff_fixedpoint, options);
jiff_instance.connect();
```

# Preprocessing for inner product
Remember our efficient inner product protcol from the previous tutorial.

```neptune[title=Party&nbsp;1,scope=1,frame=frame2]
function innerprod(input) {
  var promise = jiff_instance.share_array(input, null, 3, [1, 2, 3], [1, 2]);
  return promise.then(function (arrays) {
    var array1 = arrays[1];
    var array2 = arrays[2];

    var result = array1[0].smult(array2[0], null, false);
    for (var i = 1; i < array1.length; i++) {
      result = result.sadd(array1[i].smult(array2[i], null, false));
    }

    return jiff_instance.open(result);
  });
}
```

```neptune[title=Party&nbsp;2,scope=2,frame=frame2]
function innerprod(input) {
  var promise = jiff_instance.share_array(input, null, 3, [1, 2, 3], [1, 2]);
  return promise.then(function (arrays) {
    var array1 = arrays[1];
    var array2 = arrays[2];

    var result = array1[0].smult(array2[0], null, false);
    for (var i = 1; i < array1.length; i++) {
      result = result.sadd(array1[i].smult(array2[i], null, false));
    }

    return jiff_instance.open(result);
  });
}
```

```neptune[title=Party&nbsp;3,scope=3,frame=frame2]
function innerprod(input) {
  var promise = jiff_instance.share_array(input, null, 3, [1, 2, 3], [1, 2]);
  return promise.then(function (arrays) {
    var array1 = arrays[1];
    var array2 = arrays[2];

    var result = array1[0].smult(array2[0], null, false);
    for (var i = 1; i < array1.length; i++) {
      result = result.sadd(array1[i].smult(array2[i], null, false));
    }

    return jiff_instance.open(result);
  });
}
```

Note that we have n multiplications and additions under MPC, as well as a single open at the end. Additions do not require preprocessing as they do not need communication. But
the other primitives do too.

Additionally, if we use the default parameters, JIFF will assume that the multiplications we are attempting to preprocess for include a constant division at the end, since that
is the default behavior. However, we can customize that using the extra optional parameters.

```neptune[title=Party&nbsp;1,frame=frame3,scope=1]
var input = [1.32, 10.22, 5.67];

// preprocessing happens first
// preprocess for smult with default protocols, threshold, receivers and senders, and operation ids
// but with div set to false
jiff_instance.preprocessing('smult', input.length, null, null, null, null, null, null, {div: false});
jiff_instance.preprocessing('open', 1);

Console.log('Preprocessing tasks scheduled but not run yet!');
// call main phase of computation
jiff_instance.executePreprocessing(function () {
  Console.log('Done with Preprocessing!');
Console.log('Computing...');
  innerprod(input).then(function (result) {
    Console.log('Inner product', result.div(100)); // shift decimal point outside of MPC
    Console.log('Verify', 1.32*5.91 + 10.22*3.73 + 5.67*50.03);
  });
});
Console.log('Currently Preprocessing...');
```

```neptune[title=Party&nbsp;2,frame=frame3,scope=2]
var input = [5.91, 3.73, 50.03];

// preprocessing happens first
// preprocess for smult with default protocols, threshold, receivers and senders, and operation ids
// but with div set to false
jiff_instance.preprocessing('smult', input.length, null, null, null, null, null, null, {div: false});
jiff_instance.preprocessing('open', 1);

Console.log('Preprocessing tasks scheduled but not run yet!');
// call main phase of computation
jiff_instance.executePreprocessing(function () {
  Console.log('Done with Preprocessing!');
Console.log('Computing...');
  innerprod(input).then(function (result) {
    Console.log('Inner product', result.div(100)); // shift decimal point outside of MPC
    Console.log('Verify', 1.32*5.91 + 10.22*3.73 + 5.67*50.03);
  });
});
Console.log('Currently Preprocessing...');
```

```neptune[title=Party&nbsp;3,frame=frame3,scope=3]
var input = [null, null, null]; // 3rd party has no input

// preprocess for smult with default protocols, threshold, receivers and senders, and operation ids
// but with div set to false
jiff_instance.preprocessing('smult', input.length, null, null, null, null, null, null, {div: false});
jiff_instance.preprocessing('open', 1);

Console.log('Preprocessing tasks scheduled but not run yet!');
// call main phase of computation
jiff_instance.executePreprocessing(function () {
  Console.log('Done with Preprocessing!');
Console.log('Computing...');
  innerprod(input).then(function (result) {
    Console.log('Inner product', result.div(100)); // shift decimal point outside of MPC
    Console.log('Verify', 1.32*5.91 + 10.22*3.73 + 5.67*50.03);
  });
});
Console.log('Currently Preprocessing...');
```

# Asymmetric preprocessing

In the example above, all parties are involved in preprocessing as well as main computation, this is not always going to be the case.

Some of the machines may always be online, but others may come online just as the computation starts. In this case we can have the group of servers that is always online perform all the necessary pre-processing before the other servers come online and then share the values as soon as they connect.

Parties not participating in preprocessing should still call preprocessing and executePreprocessing. In such a case,
these functions largerly become no-ops. However, they will instruct JIFF to expect preprocessing results from the compute
parties, and delay starting the online computation, until these preprocessing results become available.

```neptune[title=Asymmetry,frame=frame5,run=false,env=None]
// define what operations we need to preprocess for, and how many of each
var operations = {'smult': 100, 'slt': 100};

// define the compute list, which parties will carry on the preprocessing
// we'll say parties 1, 2, and 3 are always online
var compute_parties = [1, 2, 3];
// define the receivers: parties that perform online computation but not necessarily
// the preprocessing 
var receivers = [1, 2, 3, 4, 5];

// Every party (even 4 and 5) should call the following functions
for (var op in operations) {
  // we'll leave the 'custom protocols' parameter as default
  jiff_instance.preprocessing(op, operations[op], null, 5, receivers, compute_parties);
}
jiff_instance.executePreprocessing(start_computation);
```

This way, all of the values that multiplications and comparisons rely on will be created and distributed before the start of any computation.

While we can definitely handle preprocessing for 100 multiplications and 100 comparisons, if we are doing thousands of each we may run out of memory from passing and
storing so many messages and promises. JIFF automatically performs these preprocessing tasks in batches, to ensure that this does not happen. Preprocessing
tasks are not uniformly sized, certain operations (e.g. sdiv) requires considerably more messages and memory than others. The batching mechanism in JIFF
is configured in terms of the count of primitive messages to account for such differences.
 
Depending on the memory constraints of the systems being used, JIFF can be configured to have a larger or smaller batch size at initialization time.preprocessing to batch the preprocessing
computation to avoid any memory issues. The batch size can be specified with the `preprocessingBatchSize` attribute in the options object passed
to the JIFFClient constructor.

Generally memory and performance constraints are much tighter when running in a browser, if all parties are running JIFF in node.js you are less likely to run out of memory.

Let's say we are preparing for 5000 multiplications, preprocessing in batches of 100, we can do this as follows:

```neptune[title=Batching,frame=frame6,env=NONE,run=false]
var options = {
    preprocessingBatchsize: 100,
    onConnect: function (jiff_instance) {
        jiff_instance.preprocessing('smult', 5000);
        jiff_instance.executePreprocessing(start_computation);
    }
};

jiff_instance = new JIFFClient('http://localhost:9111', 'preprocessing-demo', options);
```

# What If We Don't Preprocess anything?

In the case that JIFF tries to perform an operation which needs preprocessing, but none has been performed - the default behavior is to fail:

```sh
 UnhandledPromiseRejectionWarning: Error: No preprocessed value(s)
that correspond to the op_id "smult:1,2:0:triplet"
```

The other option is to have the server (which may also be a part of the computation) provide values to all parties for the operations, which happens at the time of computation.
This can be configured when creating a jiff instance by setting the `crypto_provider` option to true:
```neptune[title=Crypto&nbsp;Provider,frame=frame7,env=NONE,run=false]
var jiff_instance = new JIFFClient(server_address, 'comp_id', {'crypto_provider': true} );
```

If no operations preprocessed for, the server will be queried for anything that requires it. If some operations were specified for preprocessing,
but later more operations were added and there are not enough preprocessed values, the server will be queried for any operations that happen after
the parties have run out of preprocessed values.

While this allows you to get values such as beaver triples just-in-time, it also requires that you trust the coordinating server to generate
these values fairly and honestly, which may or may not be part of your logistical assumptions. It is recommended that you pre-process for
all operations that you anticipate performing.


# Primitive-specific Parameters

Some primitives support custom optional parameters in their preprocessing, which can be used to customize
preprocessing matching how these primitives are actually used.

These extra parameters are specified as an object given as the 9th argument to `.preprocessing()`, as we passed `div` in our inner product example above.

We begin by listing some extra parameters that are common between all primitives.

Common extra parameters:
1. **compute_threshold**: The threshold used during preprocessing, if this threshold is different than the final threshold, the preprocessing outputs are reshared
to have the final threshold. Defaults to half the compute parties (honest majority).
2. **op_id**: an operation id used to synchronize messages sent by the preprocessing protocol, must be unique and consistent between all the parties. The default auto-generated
id suffices for the vast majority of use cases. 

As mentioned earlier, not all operations on secret shares require pre-processing. For example, secure addition and secure subtraction require
only local computation and don't need any helper values. These primitives are skipped below.

Finally, note that some extensions make certain primitives support additional parameters. When composing extensions, all the parameters
supported by either extension used (including base) are supported.

Below is a complete table of all primitive specific extra parameters
```neptune[language=HTML,inject=true]
<style>
.paramsTable {
    min-width: 790px;
    max-width: 99%;
    margin-left: auto;
    margin-right: auto;
}
.paramsTable, 
.paramsTable th,
.paramsTable td {
    border: 1px solid black;
}

.paramsTable th,
.paramsTable td {
    padding: 15px;
    vertical-align: top;
}
</style>
<table class="paramsTable">
    <tr>
        <th>Extension</th>
        <th>Operation</th>
        <th>Parameter</th>
        <th>Description</th>
    </tr>
    <tr>
        <td rowspan="13">Base</td>
        <td>refresh, smult, sxor_bit, sor_bit, if_else, clt, cgt, clteq, cgteq, ceq, cneq, lt_halfprime, sdiv, smod, bit_decomposition</td>
        <td>N/A</td>
        <td>-</td>    
    </tr>
    <tr>
        <td>open, bits.open</td>
        <td>open_parties</td>
        <td>a list containing the ids of parties that will receive the result of the associated open/bits.open operations, use this for open statements where the receivers
            are different than the share holders. Defaults to the receivers_list provided to .preprocessing with this call <br> <i>Note: only holders
            of the share(s) being open should receive the results of this preprocessing</i> </td>
    </tr>
    <tr>
        <td>cdiv</td>
        <td>constant</td>
        <td>The constant to divide by, if passed, more of the cdiv operation can be performed during preprocessing, making the online cdiv call faster</td>    
    </tr>
    <tr>
        <td rowspan="2">cpow</td>
        <td>constant</td>
        <td>The constant exponent, if passed, the preprocessing performs exactly the necessary multiplications, otherwise, the preprocessing assumes the worse case (an exponent with all ones)</td>
    </tr>
    <tr>
        <td>constantBits</td>
        <td>The number of bits in the constant exponent, this is ignored if "constant" is given, use this when the constant exponent is not known, but an upper bound for it is known, use the number of bits
            of the upper bound <br> <i>Note: if the exponent is larger than Zp, either constant or constantBits must be provided to avoid errors
    </tr>
    <tr>
        <td rowspan="2">rejection_sampling</td>
        <td>lower_bound</td>
        <td>The lower bound to rejection sample from</td>
    </tr>
    <tr>
        <td>upper_bound</td>
        <td>The upper bound to rejection sample from</td>
    </tr>
    <tr>
        <td>bits.open, bits.cadd, bits.csubl, bits.csubr, bits.clt, bits.cgt, bits.clteq, bits.cgteq, bits.ceq, bits.cneq</td>
        <td>bitLength</td>
        <td>The number of secret bits on which the operation is performed, defaults to the number of bits in Zp, this will cause
            exceptions when the actual number of bits is greater than default, and will cause a slower preprocessing stage
            than needed if the actual number of bits is less than default</td>    
    </tr>
    <tr>
        <td rowspan="2">bits.cmult, bits.cdivl, bits.cdivr</td>
        <td>bitLength</td>
        <td>The number of secret bits on which the operation is performed, similar to above</td>
    </tr>
    <tr>
        <td>constantBits</td>
        <td>The number of bits in the constant passed to the operation, defaults to number of bits in Zp, similar effect to above</td>
    </tr>



    <tr>
        <td rowspan="3">bits.sadd, bits.ssub, bits.smult, bits.slt, bits.sgt, bits.slteq, bits.sgteq, bits.seq, bits.sneq, bits.sdiv</td>
        <td>bitLength</td>
        <td>The number of secret bits on which the operation is performed, defaults to number of bits in Zp, similar effect to above</td>
    </tr>
    <tr>
        <td>bitLengthLeft</td>
        <td>The number of secret bits in the left operand passed to the operation, defaults to bitLength</td>
    </tr>
    <tr>
        <td>bitLengthRight</td>
        <td>The number of secret bits in the right operand passed to the operation, defaults to bitLength</td>
    </tr>

    <tr>
        <td>Fixedpoint</td>
        <td>cmult, smult, smult_bgw</td>
        <td>div</td>
        <td>false for operations without a division at the end, defaults to true, should match the corresponding parameter passed to the operation during computation</td>
    </tr>

    <tr>
        <td>NegativeNumber</td>
        <td>cdiv, sdiv</td>
        <td>floor_down</td>
        <td>true for rounding down, false for round to zero, defaults to true, should match the corresponding parameter passed to the operation during computation</td>
    </tr>
</table>
```