# JIFF

Server- and client-side library for building JavaScript application that have secure multi-party computation features. Parties running the server-side application can handle the relaying of shares between parties. Both client and server parties can act as input data contributors and as compute parties.

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
node index.js demos/sum/server
```
The output from the example server will direct you to open `localhost:8080/demos/sum/client.html` in a browser (you must open an instance in a separate window/tab for every distinct party participating in the protocol). You can then proceed with the protocol using the client interfaces. Note that the server script will also suggest the possibility of running a server-based party that can also participate in the protocol by executing (e.g., in a separate terminal):
```shell
node index.js demos/sum/party
```
Several other demos are also included:
```shell
node index.js demos/sum-fixed/server
node index.js demos/div/server
node index.js demos/vote/server
```

## Documentation

The latest documentation can be viewed at on the [project page](https://multiparty.org/jiff/). The documentation can be generated using [JSDoc](http://usejsdoc.org/); you will find these docs in `docs/jsdocs/`: 
```shell
./node_modules/.bin/jsdoc -c docs/jsdoc.conf.json
npm run-script gen-docs # shortcut
```

## Running Tests

The test cases can be run in the following way:
```shell
npm test
```

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
3. `demos/sum-fixed/client.html`: using fixed point arithmetic extension in the browser.
2. `tests/mocha-bignumber`: test suite of usage with the Node bignumber.js module.

Run the bignumber test suite in the following way:
```shell
npm run-script test-bignumber
```

## Information and Collaborators

More information about this project, including collaborators and publications, can be found at [multiparty.org](https://multiparty.org/).
