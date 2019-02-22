# JIFF

Server- and client-side library for building JavaScript applications that have secure multi-party computation features. Parties running the server-side application can handle the relaying of shares between parties. Both client and server parties can act as input data contributors and as compute parties.

## Requirements

### Server

Running the server requires [Node](https://nodejs.org/en/) and [npm](https://www.npmjs.com/).

### Client

Make sure to use the `sockets.io.js` script file that **matches exactly** the version **used in the server**.

If the client code is to be served by the server, use:
```html
<script src="/socket.io/socket.io.js"></script>
```
If the client code is served independently, fetch the matching version of socket.io.js from a CDN, or use the file found in `<server_dir>/node_modules/socket.io-client/dist`.

Additionally, The [libsodium-wrappers](https://www.npmjs.com/package/libsodium-wrappers) web-assembly library is used for fast crypto (encryption). You must include the appropriate sodium wrapper js file, if the client code is to be server by the server, use:
```html
<script src="/lib/sodium.js"></script>
```
The libsodium-wrappers requirement can be removed as long as alternate implementation for encryption/decryption and signing is provided to JIFF through the appropriate hooks. Check out the hooks section below for additional info.

## Installation

### Server

Run npm from inside the project directory to install automatically the dependencies listed in `package.json`:
```shell
npm install
```

### Client

Make sure to include the library **after** socket.io and libsodium:
```html
<script src="/lib/jiff-client.js"></script>
```
Then inside a script tag (and after the page loads), initialize a JIFF object and set up a computation:
```javascript
var instance = jiff.make_jiff("http://localhost:8080", "<computation_id>", parties)
```
The instance object provides methods for sharing, opening, and performing operations on shares.

## Running Demos and Examples

Run a sample server from one of the demos under `demos` in the following way:
```shell
node demos/<demo-name>/server.js
```
The output from the example server will direct you to open `localhost:8080/demos/<demo-name>/client.html` in a browser (you must open an instance in a separate window/tab for every distinct party participating in the protocol).
You can then proceed with the protocol using the client interfaces.

Note that you can run node.js parties that can also participate in the protocol by executing (e.g., a separate terminal for each party):
```shell
node demos/<demo-name>/party.js <input-value>
```

## Project Layout
--------------

    ├─ demos/           Example of common jiff use-cases and functionality
    ├─ docs/            JSDoc config and generated docs
    ├─ lib/             Libraries for both client and server-side jiff instances
       ├─ ext/          Extended functionality for use cases (e.g. negative numbers)
    │  └─ server/       server-side specific helpers
    └─ test/            Unit testing for base Jiff, demos, and extensions
       ├─ dev/
       ├─ live/
       └─ suite/        Base Jiff and extension tests (See test/suite/README.md)



## Documentation

The latest documentation can be viewed at on the [project page](https://multiparty.org/jiff/). The documentation can be generated using [JSDoc](http://usejsdoc.org/); you will find these docs in `docs/jsdocs/`:
```shell
./node_modules/.bin/jsdoc -c docs/jsdoc.conf.json
npm run-script gen-docs # shortcut
```

## Running Tests

All the JIFF library test cases can be run in the following way:
```shell
npm test
```

Demos are accompanied by test cases. The following command can be used to run the demos servers and test cases:
```shell
npm run-script test-demo -- demos/<demo-name>
```
The command assumes that the server is located at demos/<demo-name>/server.js and the test cases are located at demos/<demo-name>/test.js
See demos/run-test.sh for instructions for running test cases located in different directories or with different names.

See the [testing suite framework documentation](tests/suite/README.md) for more details on running and creating tests for the JIFF library.

## Development

The JIFF libraries allow developers to customize or extend their functionality by introducing new *hooks*. Multiple hooks can be combined to form a library *extension*.

### Hooks

The JIFF client and server libraries support hooks. Hooks can be provided in the options parameter during instantiation or afterwards. Hooks allow the introduction of custom functionality to be executed at critical times during the computation, or the introduction of different implementations of specified primitives and operations (e.g. using a different sharing scheme).

The client-side [hooks documentation](lib/ext/Hooks.md) provides more details. If hooks are used to provide important reusable functionality, then it is recommended to bundle these hooks within a JIFF extension.

### Extensions

JIFF supports implementing extensions on top of the base implementations that can provide additional extended functionality. Some extensions can be found under `lib/ext`. Two important modules are implemented and provided in this repository: bignumbers and fixed point arithmetic.

See the [extensions documentation](lib/ext/README.md) and the documentation inside `src/ext/jiff-client-bignumber.js` for instructions on how to create additional extensions.

Both client and server libraries support extensions. Some extensions require customizing both the server and client libraries to behave properly (such as the bignumbers extension). Other extensions may require only server- or client-side modifications (e.g., the fixed point arithmetic module is only client-side). A server that wants to participate in the computation would require only the client-side extension to use the additional functionality (unless, of course, that extension depends on additional server-side modifications, as well, as in bignumbers).

For examples on how to use an extension, see out the following files:

1. `demos/sum-fixed/server.js`: using the server with the Node bignumber.js module.
2. `demos/sum-fixed/client.html`: using fixed point arithmetic extension in the browser.

Run the bignumber test suite in the following way:
```shell
npm run-script test-bignumber
```

### Costs of Operations:
Below is a table of the current costs of operations in the *base* jiff with no extensions:

| Operation         | Rounds            | Total Messages                   | Preprocessing Rounds | Preprocessing Total Messages               | Dependenices |
|-------------------|-------------------|----------------------------------|----------------------|--------------------------------------------|--------------|
| Share             | 1                 | senders \* receivers             | 0                    | 0                                          | N/A          |
| Open              | 2                 | sender + sender \* receivers     | 1                    | senders \* senders                         | N/A          |
| +, -, c+, c-, c\* | 0                 | 0                                | 0                    | 0                                          | N/A          |
| \*                | 2                 | 2\*parties + parties\*(parties-1)| 2                    | 2 \* (parties \* parties - 1)              | triplet,open |
| <, <=, >, >=      | 2\*(bits+3)       | O( bits \* parties^2 )           | 3                    | bits \* (2\*parties + parties^2)           | \*, open     |
| c<, c<=, c>, c>=  | 2\*(bits+3)       | O( bits \* parties^2 )           | 3                    | bits \* (2\*parties + parties^2)           | \*, open     |
| =, c=, !=, c!=    | 2\*(bits+4)       | O( bits \* parties^2 )           | 3                    | 2\*bits \* (2\*parties + parties^2)        | c<, c>, \*   |
| /                 | bits^2 + 5\*bits  | O( bits^2 \* parties^2 )         | 3                    | bits\*(2\*bits \* (2\*parties + parties^2))| <, c<, \*    |
| c/                | 2\*(bits+3) + 5   | O( bits \* parties^2 )           | 3                    | 4 \* bits \* (2\*parties + parties^2)      | open, \*, c< |


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
