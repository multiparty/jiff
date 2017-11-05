# JIFF
Server and Client side library for performing MPC in JavaScript. Server handles relaying shares between parties.
Clients and Servers can both participate in the computation and provide input data.

## Requirements
### Server: 
  Node and npm

### Client: 
Make sure to use the sockets.io.js script file that **matches exactly** the version **used in the server**.  
  
If the client code is to be served by the server, use:  
```
<script src="/socket.io/socket.io.js"></script>
```  
  
If the client code is served independently, fetch the matching socket.io.js from the CDN, or use the file from`<server_dir>/node_modules/socket.io-client/dist`

## Installation
### Server:
run npm from inside the project directory to install dependencies listed in package.json automatically:

`$ npm install`

### Client:
Make sure to include jiff.js **after** socket.io  
```
<script src="/lib/jiff-client.js"></script>
```  
  
Then inside a script tag (and after the page loads), initialize a jiff object and setup a computation:  
```
var instance = jiff.make_jiff("http://localhost:3000", "<computation_id>", parties)
```  
  
instance will provide methods for sharing, opening, and performing operations on shares.

## Documentation
The documentation can be generated using [JSDoc](http://usejsdoc.org/); you will find these docs in `docs/jsdocs/`:  
```
./node_modules/.bin/jsdoc -c docs/jsdoc.conf.json
```  
The latest documentation can be viewed at on the [project page](https://multiparty.org/jiff/).

## Running the application
To run a sample server:

`$ node index.js`

Then open `localhost:3000/apps/sum.html` (or any other file under `apps/`) in a browser, for every party open the page in a new tab/window.

## Information and Collaborators
More information about this project, including collaborators and publications, can be found at [multiparty.org](https://multiparty.org/).

## License
MIT
