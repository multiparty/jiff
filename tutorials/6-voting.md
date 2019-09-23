# Vote tally
A simple, secure vote tally can be implemented in JIFF concisely:

JIFF operates on the SIMD paradigm - so all of the parties participating in the vote will execute the same code.

## Defining a JIFF Client
First, each user will run a JIFF client to participate in the computation. The client exports two main functionalities: connecting to the server and executing the computation. The client logic is in the file `party.js`:

We start by connecting to the server. We fill in the `hostname` that the server above is running on and the name of our computation (`computation_id`). We'll call this computation `'vote'`.

The `make_jiff` function uses this information to set up a new JIFF object.
We save the fully configured `jiff_instance` in a global variable, so we can use it when we compute our function.

We also need to tell the client where the JIFF client code is kept.

```javascript
var jiff = require('../../lib/jiff-client');
var jiff_instance = jiff.make_jiff('localhost:8080', 'vote');
```

## Using JIFF
The most basic and essential part of the JIFF library is the `share()` function. `share()` takes a user's input and divides it into unique parts according to the Shamir Secret Sharing scheme, then distributes a part to each participant.

```javascript
// for now let's say 1 is a yes vote and 0 is a no
var my_vote = 1;
var shares = jiff_instance.share(my_vote);
```
By default, the `share` function assumes that every party will provide an input. It returns an object that contains secret shares of everyone's values. This is the JSON encoding of this object:
```
{ 1: <SecretShare>, 2: <SecretShare>, ..., n: <SecretShare> }
```
Each `SecretShare` object contains a fragment of the input associated with that party and defines [other useful functions](https://multiparty.org/jiff/docs/jsdoc/SecretShare.html) for arithmetic operations and comparisons.

For example, we can use the `.add()` function on secret shares to sum our votes:
```javascript
var votes_for = shares[1];
// sum all the 'yes' votes
for (var i = 2; i < jiff_instance.party_count; i++) {
  votes_for = votes_for.add(shares[i]);
}
```
Let's print the result to see how many people voted 'yes'.
Notice that the `votes_for` variable is also a secret-share, so we can't directly use it - first we have to reveal it with the `.open()` function:
```javascript
var total_votes = my_jiff_instance.open(votes_for);
```
We have to wait for other parties to send their shares of the total in order to reconstruct the value, so `open()` returns a promise:
```javascript
//  wait for the promise to resolve, then log the result
total_votes.then(function (result) {
  console.log('The initiative received ', result, ' yes votes.');
});
```

# Voting for several choices
Now let's have several options to vote for instead of a yes/no:

```javascript
// represent votes as a 0/1 for each option
var my_votes = [0, 1, 0, 0];

jiff_instance.share_array(my_votes).then(function (votes) {
    var totals = votes[1];
    //Get a partial tally for each option in the vote by adding the shares across parties together.
    for (var j = 2; j <= jiff_instance.party_count; j++) {
      for (var i = 0; i < votes[j].length; i++) {
        totals[i] = totals[i].add(votes[j][i]);
      }
    }
```
Now open the totals for all options:
```javascript
      // reveal the results of the tally to all parties
      var results = [];
      for (var i = 0; i < totals.length; i++) {
        results.push(jiff_instance.open(totals[i]));
      }

      // wait for the opens to finish, then reveal the outcome
      Promis.all(results).then(function (tally) {
        for (var i = 0; i < tally.length; i++) {
          console.log('Option ' + i + 'Received' + tally[i] + 'votes');
        }
        my_jiff_instance.disconnect();
      });
  });
```

Now let's put everything together:

## Full client file
The only thing different here is that we wrap the computation logic in the `onConnect` function of the options passed to `make_jiff` so that the computation begins as soon as we've connected to the server:
```javascript
var jiff = require('../../lib/jiff-client');
var options = {party_count: 3};
options.onConnect = function (jiff_instance) {


  // represent votes as a 0/1 for each option
  var my_votes = [0, 1, 0, 0];

  jiff_instance.share_array(my_votes).then(function (votes) {
      var totals = votes[1];
      //Get a partial tally for each option in the vote by adding the shares across parties together.
      for (var j = 2; j <= jiff_instance.party_count; j++) {
        for (var i = 0; i < votes[j].length; i++) {
          totals[i] = totals[i].add(votes[j][i]);
        }
      }
      // reveal the results of the tally to all parties
      var results = [];
      for (var i = 0; i < totals.length; i++) {
        results.push(jiff_instance.open(totals[i]));
      }

      // wait for the opens to finish, then reveal the outcome
      Promis.all(results).then(function (tally) {
        for (var i = 0; i < tally.length; i++) {
          console.log('Option ' + i + 'Received' + tally[i] + 'votes');
        }
        my_jiff_instance.disconnect();
      });
  });
};
// connect to server and start computation when ready
var jiff_instance = jiff.make_jiff('http://localhost:8080', 'vote', options);
```

# With sanity/honesty checks
In our previous example, someone could have maliciously put a value greater than 1 in any of their votes, giving them an unfair say. Let's add some checks to make sure that everyone only votes once, and that their votes are not greater than 1:
```javascript
// Check 1
// each single vote option must be less than or equal to 1
var check = votes[1][0].clteq(1, 'initialize check');
for (j = 1; j <= jiff_instance.party_count; j++) {
  for (i = 0; i < votes[j].length; i++) {
    check = check.smult(votes[j][i].clteq(1));
  }
}

// Check 2
// Each party gets one vote only: sum of all votes of one party should be less than or equal to 1
for (j = 1; j <= jiff_instance.party_count; j++) {
  var sum = votes[j][0];
  for (i = 1; i < votes[j].length; i++) {
    sum = sum.add(votes[j][i]);
  }
  check = check.smult(sum.clteq(1));
}

// Apply Checks:
// if some check fails, set all votes to 0
for (i = 0; i < results.length; i++) {
  results[i] = results[i].smult(check);
}

```
Alternatively, we may only want to reveal to the vote total for the winner:

```javascript
var jiff = require('../lib/jiff-client');

var options = {party_count: 3};
options.onConnect = function (my_jiff_instance) {


  // represent votes as a 0/1 for each option
  var my_votes = [0, 1, 0, 0];

  jiff_instance.share_array(my_votes).then(function (votes) {
      /*
       * Securely add vote totals...
       * Do sanity checks...
       */

      // find the index of the max value
      var index = 0;
      for (var i = 1; i < totals.length; i++) {
        var cmp = results[index].gt(results[i]);
        // instead of a branch, we use an oblivious if/else
        index = cmp.if_else(index, i);
      }

      // reveal the winning vote to all parties
      jiff_instance.open(results[index]).then(function (result) {
          console.log('Option ' + index + 'won with ' + result + 'votes');
        }
        my_jiff_instance.disconnect();
      });
  });
};
var jiff_instance = jiff.make_jiff('http://localhost:8080', 'vote', options);
```

