# jiff-client
Client side library for performing MPC in JavaScript.

## Requirements
Make sure to use the sockets.io.js script file that **matches exactly** the version **used in the server**. If the client code is to be served by the server, use:
```
<script src="/socket.io/socket.io.js"></script>
```
If the client code is served independently, fetch the matching socket.io.js from the CDN, or use the file from `<server_dir>/node_modules/socket.io-client/dist`

## Documentation
The documentation can be generated using [JSDoc](http://usejsdoc.org/):
```
jsdoc -c jsdoc.conf.json
```
The latest documentation can be viewed at on the [project page](https://multiparty.github.io/jiff-client/).

## Installation
Make sure to include jiff.js **after** socket.io
```
<script src="jiff.js"></script>
```
Then inside a script tag (and after the page loads), intialize a jiff object and setup a computation:
```
var instance = make_jiff("http://localhost", 3000, parties)
```
instance will provide methods for sharing, opening, and performing operations on shares.

## Running the test application
Open `test.html` in a browser with the server running.

## Collaborators
More information about this project, including collaborators and publications, can be found at [multiparty.org](https://multiparty.org/).

## License
MIT
