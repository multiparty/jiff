# Regression Test 📝

This directory consists of a set of regression tests covering test cases from simple arithmetics to statistics performed in the MPC protocol.

## Before Getting Started
The e2e tests in this directory are run by JEST. The package.json includes JEST installation, however, if needed, you can install it separately with `npm install --save-dev jest`.

## What is covered 🛒

<table border="1">
    <tr>
        <b><th>Name</th></b>
        <b><th>Description</th></b>
    </tr>
    <tr>
        <td>Arithmetics</td>
        <td>Arithmetic operations with Secret Shares and Normal Integers </td>
    </tr>
    <tr>
        <td>Array</td>
        <td>Arithmetic operations and Linear/Binary Search with Secret Array elements </td>
    </tr>
    <tr>
        <td>Bits Share Comparison</td>
        <td>Bits Share Equality check</td>
    </tr>
    <tr>
        <td>Bits Share Preprocess</td>
        <td>Preprocess acceleration on Bits Share multiplication</td>
    </tr>
    <tr>
        <td>Bits Share Arithmetics</td>
        <td>Arithmetic Operations with Bits Share</td>
    </tr>
    <tr>
        <td>Preprocess</td>
        <td>Preprocess acceleration on Array Share multiplication</td>
    </tr>
    <tr>
        <td>Statistics</td>
        <td>Statistics Computation (Average and Standard Deviation)</td>
    </tr>
    <tr>
        <td>Voting</td>
        <td>Voting Mechanism using Secret Arrays</td>
    </tr>
</table>


## How to Run 🏃🏃‍♀️🏃‍♂️

**Run them All**

```shell
npx jest --no-chache --runInBand --coverage tests/regr-tests --silent
```

> ⚠️ Note
> - `--runInBand` tag is important because simultaneous execution without this tag causes deadlocks due to conflicts/congestion
> - `--coverage` tag generates a coverage report
> - `--silent` is optional but recommended, because it prevents noisy verbose.

**Run a single test**

```shell
npx jest --no-chache ./tests/regr-tests/<TestName>.test.ts --silent 
```
Replace <TestName> with an actual test name, such as `arithmetic`



## Code Structure ⌨️

The e2e tests in this directory follow the same code structure. 

The Setup Section underneath the `describe` statement imports necessary files and configures variables used in the test cases.

<div align="center">
<img width="50%" height="50%" alt="image" src="https://github.com/multiparty/jiff/assets/62607343/c368e155-5150-4a82-8b74-aa60ae5fbddb">
</div>

The `beforeEach` block initiates the Jiff server, establishes Jiff Client, and apply necessary extensions.

<div align="center">
<img width="60%" height="60%" alt="image" src="https://github.com/multiparty/jiff/assets/62607343/7c730ff0-29d2-4034-901d-8d86cff4f52f">
</div>

The `afterEach` block terminates the Jiff server, closing sockets and freeing up computation.
<div align="center">
<img width="40%" height="40%" alt="image" src="https://github.com/multiparty/jiff/assets/62607343/f32272b8-6dba-42a9-b597-e7f6489909bc">
</div>
