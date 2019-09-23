# Control Flow and Branching
Branching (e.g. via an if-else statement) can often leak information. This is apparent in our initial implementation of binary search. Additionally, when operating on secret shares you might want to branch based off of an operation that results in a share - not a binary value - without revealing that value.

JIFF has a convenient function for exactly this scenario, instead of writing a traditional if/else block like this:
```javascript
var comparison = share.lt(other_share);
// comparison is a secret share, this will fail!!
if (comparison) {
    result = 1;
} else {
    result = -1;
}

```
You would use the `if_else()` function in JIFF:
```javascript
var comparison = share.lt(other_share);
var result = comparison.if_else(1, -1);
}
```
Alternatively, you may want the result to be a secret share as well, which will not reveal the result of comparison and therefore not leak any information about either of the values that were compared:

```javascript
// share a secret
var shares = jiff.share(my_input);
var mine = shares[1]; // my secret-shared input
var yours = shares[2]; // other party's secret-shared input

var comparison = mine.lt(yours);
var min = comparison.if_else(mine, yours);
/*
 * Do something with the min value...
 */
}
```


The `if_else` implementation in the JIFF library is very concise:
```javascript
if_else = function (trueVal, falseVal, op_id) {
      if (op_id == null) {
        op_id = self.jiff.counters.gen_op_id('ifelse', self.holders);
      }

      var const1 = self.isConstant(trueVal);
      var const2 = self.isConstant(falseVal);
      if (const1 && const2) {
        return self.icmult(trueVal).isadd(self.inot().icmult(falseVal));
      } else if (const1) {
        return self.inot().ismult(falseVal.icsub(trueVal), op_id).icadd(trueVal);
      } else if (const2) {
        return self.ismult(trueVal.icsub(falseVal), op_id).icadd(falseVal);
      } else {
        return self.ismult(trueVal.issub(falseVal), op_id).isadd(falseVal);
      }
  };
```
