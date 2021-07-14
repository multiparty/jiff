# JIFF

[![CircleCI Build Status](https://circleci.com/gh/multiparty/jiff.svg?style=shield)](https://app.circleci.com/pipelines/github/multiparty/jiff)

JIFF is a JavaScript library for building applications that rely on secure multi-party computation. JIFF is built to be highly flexible with a focus on usability, with the ability to be run in the browser, on mobile phones, or via Node.js. JIFF is designed so that developers need not be familiar with MPC techniques or know the details of cryptographic protocols in order to build secure applications.

## Requirements

### Server

Running the server requires [Node](https://nodejs.org/en/) and [npm](https://www.npmjs.com/).

### Client

For browsers, we provide a bundle including the base client side library and its dependencies ([libsodium-wrappers](https://www.npmjs.com/package/libsodium-wrappers) and socket.io). Extensions have to be imported separately.

For node.js clients, npm install should install all the required dependencies.

## Installation

### Server

Run npm from inside the project directory to automatically install the dependencies listed in `package.json`:
```shell
npm install
```

### Client - Browser

Make sure to include the library bundle:
```html
<!-- exposes JIFFClient to the global scope -->
<script src="/dist/jiff-client.js"></script>
```
Then inside a script tag (and after the page loads), initialize a JIFF object and set up a computation:
```javascript
var instance = new JIFFClient("http://localhost:8080", "<computation_id>", parties);
```
The instance object provides methods for sharing, opening, and performing operations on shares.

### Client - node.js

In node.js you must include the library (either the bundle or the source) and then use it:
```javascript
var JIFFClient = require('./dist/jiff-client.js');
var instance = new JIFFClient("http://localhost:8000", "<computation_id>", parties);
```

## Project Layout

    ├─ demos/               Example of common jiff use-cases and functionality
    ├─ docs/                JSDoc config and generated docs
    ├─ lib/                 Libraries for both client and server-side jiff instances
    │  ├─ client/           Implementation of the client side library
    │  ├─ server/           Implementation of the server side library
    │  ├─ ext/              Extended functionality for use cases (e.g. negative numbers): Includes server and client extensions
    │  ├─ common/           Some common helpers between both client and server code
    │  ├─ jiff-client.js    Main module for the client side library, include this (or the bundle under dist/) in your projects
    │  └─ jiff-server.js    Main module for the server side library, include this in your server code
    ├─ test/                Unit testing for base Jiff, demos, and extensions
    │  ├─ dev/              Limited tests for testing some features under development
    │  ├─ live/             Template and setup for live coding with JIFF with nodejs's command line shell (REPL)
    │  └─ suite/            Base Jiff and extension tests (See test/suite/README.md)
    ├─ tutorial/            Contains interactive tutorial files that can be run locally to learn JIFF!

## Running Tutorials

Clone the github repo, and run `npm run tutorial` inside its root directory.

On your terminal, you will see a list of "Routes/Documents". Open either document in your browser to go through the tutorial.

Each document is an independent tutorial. However, beginners are encouraged to view them in order.

## Running Demos and Examples

Run a sample server from one of the demos under `demos` in the following way:
```shell
node index.js demos/<demo-name>/server  # alternative way 1
node demos/<demo-name>/server.js  # alternative way 2
```
The output from the example server will direct you to open `localhost:8080/demos/<demo-name>/client.html` in a browser (you must open
an instance in a separate window/tab for every distinct party participating in the protocol).
You can then proceed with the protocol using the client interfaces.

Note that you can run Node.js parties that can also participate in the protocol by executing (e.g., a separate terminal for each party):
```shell
node demos/<demo-name>/party.js <input-value>
```

## Documentation

The latest documentation can be viewed on the [project page](https://multiparty.org/jiff/). The documentation can be generated using [JSDoc](http://usejsdoc.org/); you will find these docs in `docs/jsdocs/`:
```shell
./node_modules/.bin/jsdoc -r -c docs/jsdoc.conf.json
npm run-script gen-docs # shortcut
```
### Where to Look in the Docs

The documentation for the client side library is separated into the distinct modules, namespaces, and classes:


    ├─ modules
    │  └─ jiff-client            Parent module: represents the exposed JIFFClient global variable
    ├─ classes
    │  ├─ JIFFClient             Represents a client side jiff instance including the main API of JIFF
    │  ├─ SecretShare            Contains the API for SecretShare objects
    │  ├─ GuardedSocket          Internal wrapper around socket.io for added reliability
    │  └─ Deferred               Polyfill to construct deferred from native Promises
    ├─ namespaces
    │  ├─ protocols              Common protocols exposed by jiff client instances, suitable for preprocessing
    │  ├─ bits                   Primitives for operating on bit-wise shared secrets (hybrid protocols)
    │  └─ hooks                  Available hooks that can be used by users to customize behavior

## Running Tests

All of the JIFF library test cases can be run in the following way:
```shell
npm test
```

Demos are accompanied by test cases. The following command can be used to run the demo servers and test cases:
```shell
npm run-script test-demo -- demos/<demo-name>
```
The command assumes that the server is located at demos/<demo-name>/server.js and the test cases are located at demos/<demo-name>/test.js
See demos/run-test.sh for instructions on running test cases located in different directories or with different names.

See the [testing suite framework documentation](tests/suite/README.md) for more details on running and creating tests for the JIFF library.

## Bundling

If you made changes to the library and would like to bundle it again into a single browser-friendly file, you can run this command:
```shell
npm run-script build # will override dist/jiff-client.js
```

## Development

The JIFF libraries allow developers to customize or extend their functionality by introducing new *hooks*. Multiple hooks can be combined to form a library *extension*.

### Hooks

The JIFF client and server libraries support hooks. Hooks can be provided in the options parameter during instantiation or afterwards. Hooks allow the introduction of custom functionality to be executed at critical times during the computation, or the introduction of different implementations of specified primitives and operations (e.g. using a different sharing scheme).

The client-side [hooks documentation](lib/ext/Hooks.md) provides more details. If hooks are used to provide important reusable functionality, then it is recommended to bundle these hooks within a JIFF extension.

### Extensions

JIFF supports implementing extensions on top of the base implementations that can provide additional extended functionality. Some extensions can be found under `lib/ext`. Two important modules are implemented and provided in this repository: bignumbers and fixed point arithmetic.

See the [extensions documentation](lib/ext/README.md) and the documentation inside `src/ext/jiff-client-bignumber.js` for instructions on how to create additional extensions.

Both client and server libraries support extensions. Some extensions require customizing both the server and client libraries to behave properly (such as the bignumbers extension). Other extensions may require only server or client-side modifications (e.g., the fixed point arithmetic module is only client-side). A server that wants to participate in the computation would require only the client-side extension to use the additional functionality (unless, of course, that extension depends on additional server-side modifications as in bignumbers).

For examples on how to use an extension, see the following files:

1. `demos/sum-fixed/server.js`: using the server with the Node bignumber.js module.
2. `demos/sum-fixed/client.html`: using fixed point arithmetic extension in the browser.

Run the bignumber test suite in the following way:
```shell
npm run-script test-bignumber
```

## How to Contribute
Check out our contribution guidelines and resources @ [contributing](CONTRIBUTING.md).

# For Cryptographers

## Security Model and Assumptions

JIFF is secure against semi-honest adversaries.

JIFF's default preprocessing protocol for beaver triples generation is based on bgw. All protocols that depend on triplets/multiplication are
secure with an honest majority in the preprocessing phase, and against a dishonest majority in the online stage. This is important, since the parties
performing the preprocessing may be different than the ones carrying out the online computation.

If preprocessing is not used, and `crypto_provider` option is set to true during instance creation, JIFF will acquire all required
corelated randomness and preprocessing material from the server. This yields an asymetric trust model, where the computation is secure
against a dishonest majority of non-server parties, but insecure against coalitions of one or more party plus the server. Conretely, this
reduces to more traditional models in certain cases. For example, if the computation is made out of two parties and a server, this becomes
equivalent to 3-party computation with honest majority.

## Costs of Operations: [OUTDATED]
Below is a table of the current costs of operations in the *base* JIFF without extensions:


| Operation         | Rounds            | Total Messages                    | Preprocessing Rounds | Preprocessing Total Messages                 | Dependenices |
|-------------------|-------------------|-----------------------------------|----------------------|----------------------------------------------|--------------|
| Share             | 1                 | senders \* receivers              | 0                    | 0                                            | N/A          |
| Open              | 2                 | sender + sender \* receivers      | 1                    | senders \* senders                           | N/A          |
| +, -, c+, c-, c\* | 0                 | 0                                 | 0                    | 0                                            | N/A          |
| \*                | 2                 | 2\*parties + parties\*(parties-1) | 2                    | 2 \* (parties \* parties - 1)                | triplet,open |
| <, <=, >, >=      | 2\*(bits+3)       | O( bits \* parties^2 )            | 3                    | bits \* (2\*parties + parties^2)             | \*, open     |
| c<, c<=, c>, c>=  | 2\*(bits+3)       | O( bits \* parties^2 )            | 3                    | bits \* (2\*parties + parties^2)             | \*, open     |
| =, c=, !=, c!=    | 2\*(bits+4)       | O( bits \* parties^2 )            | 3                    | 2\*bits \* (2\*parties + parties^2)          | c<, c>, \*   |
| /                 | bits^2 + 5\*bits  | O( bits^2 \* parties^2 )          | 3                    | bits\*(2\*bits \* (2\*parties + parties^2))  | <, c<, \*    |
| c/                | 2\*(bits+3) + 5   | O( bits \* parties^2 )            | 3                    | 4 \* bits \* (2\*parties + parties^2)        | open, \*, c< |
| bits+             | 8\*bits           | O( parties^2 \* bits )            | 2                    | 8 \* bits \* (parties \* parties - 1)        | triplet,open | 
| bits-             | 8\*bits           | O( parties^2 \* bits )            | 2                    | 8 \* bits \* (parties \* parties - 1)        | triplet,open |
| bits*             | 12\*bits          | O( parties^4 \* bits^2 )          | 2                    | 12 \* bits^2 \* (parties \* parties - 1)^2   | triplet,open |
| bits/             | 25\*bits^2        | O( parties^2 \* bits^2 )          | 2                    | 25 \* bits^2 \* (parties \* parties - 1)     | triplet,open |

Some exact costs not shown in the table:
1. Exact total number of messages for secret inequalities is: 3\*(parties + parties^2 + (bits+1) \* (2\*parties + parties\*(parties-1))) + 2\*parties + parties\*(parties-1)
2. Exact total number of messages for constant inequalities is: 2\*(parties + parties^2 + (bits+1) \* (2\*parties + parties\*(parties-1))) + 2\*parties + parties\*(parties-1)
3. Exact total number of messages for equality checks: 2\*(\*(parties + parties^2 + (bits+1) \* (2\*parties + parties\*(parties-1))) + 2\*parties + parties\*(parties-1)) + 2\*parties + parties\*(parties-1)
4. Exact total number of messages for division is: bits \* ( 5\*(parties + parties^2 + (bits+1) \* (2\*parties + parties\*(parties-1))) + 2\*parties + parties\*(parties-1) + 2\*parties + parties\*(parties-1) )
5. Exact total number of messages for constant division is: 1 + 7\*parties + 4\*parties^2 + 8\*(parties + parties^2 + (bits+1) \* (2\*parties + parties\*(parties-1)))

Dependenices:
1. Multiplication has one message to synchronize beaver triplets and one open in sequence.
2. inequality tests has 3 less than half primes in parallel, each has an open and as many multiplication in sequence as bits.
3. constant inequality test has 2 less than half primes in parallel.
4. equality and constant equality tests have 2 inequalities in parallel, sequenced with a multiplication.
5. division has as many sequential iterations as bits, each iteration contains a constant inequality, secret inequality, and multiplication.
6. constant division has one open sequenced with 4 parallel constant inequality checks and two multiplications.
7. Secret XORs and ORs are equivalent to a single multiplication, constant XORs and ORs are free.


## Information and Collaborators

More information about this project, including collaborators and publications, can be found at [multiparty.org](https://multiparty.org/).
