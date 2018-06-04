# Routing Service Demo

A privacy preserving route recommendation demo.

# Service Protocol

The service consists of three important kind of parties:
* _Server_: serves client side html and javascript, routes messages between different components.
* _Backend-Server_: stores the data for the different route recommendations, and serves requests from frontend servers obliviously.
* _Frontend-Servers: the interface between clients and backend server. 
 Perform preprocessing with the backend server to obfuscate the recommendation data.
 Jointly obfuscate client queries and serve them to and from the backend server. There should be at least 2 front servers.
 
The protocol consists of two stages: (1) Precomputation. (2) Query.

## Precomputation
This happens once every time the route recommendations are updated:

1. The backend server initially possesses a table of the different route recommendations of the form:
[ 'source', 'destination', 'jump (first step in the path from source to destination)']
2. The backend server sends this table to the first frontend server.
3. The first front end server shuffles the table and garbles the entries using a PRF with a secret key, the first two columns need not be recoverable, but the jump must be decryptable.
4. The front end server sends the garbled table to the next frontend server, which repeates steps 3 and 4.
5. The last front end server sends the garbled table back to the backend server, which stores it.

## Query
This happens every time the client makes a query:

1. The client has a pair of numbers source and destination to query for.
2. The client comes up with src1, ..., srcN and dest1, ..., destN random numbers such that:
src1 * ... * srcN = src mod P
dest1 * ... * destN = dest mod P
where P is the order of the Elliptic curve used in the PRF from step 3 of the precomputation stage.
3. The client sends each srcI, destI to the corresponding front end server i.
4. Each front end server applies the PRF with its key on the received srcI and destI, and send the result to the backend server.
5. Backend servers multiplies all received results from each front end server.
6. The backend server returns the jump entry matching the received garbled source and destination to the front end servers.
7. The frontends servers decrypt the entry under MPC and sent it to the client.
8. The client reconstructs the jump entry from the received shares.

# Installation
To install all the needed dependencies run:
```shell
npm install
```
# Running The Demos
Use the following scripts to run the demo. The first script runs all needed parties. The second scripts signals the parties to perform the inital precomputation:
```shell
./scripts/run.sh
./scripts/recompute.sh boston
```

In your browser, go to http://localhost:3000 to use the demo's HTML interface. Then choose the queries by clicking on the source and destination pins on the map.

Alternatively, you can use a command line version of the client to test the demo:
```shell
node test.js <source_number> <destination_number>
```

To stop the servers running in the background:
```shell
./scripts/kill.sh
```

# File/Directory Structure
1. _data/_ contains the JSON files for the routing tables. Includes boston.json, the default routing table.
2. _parties/_ contains the source code for backend and frontend servers, as well as a configuration file for them.
3. _scripts/_ contains scripts for running and killing the service.
4. _scrape/_ contains the python script used to create the map of boston, and scrape the routes and locations used in this demo by default.
5. _server.js_ used for serving the client HTML and routing messages.
6. _index.html_/_client.js_ the client UI and code for querying the service.
7. _test.js_ command line nodejs code for querying the service.

## Changing The Number Of Frontend Servers
Initially, the demo is configured to use two frontend servers. To change the number of frontend servers, you need to change these three files:
1. parties/config.json: add or remove front end servers from the frontend servers array.
2. scripts/run.json: add or remove instructions to run the exact number of frontend servers.
3. client.js and test.js: add or remove the urls of the frontend servers from the urls array at the top of both files.

## Scraping Geojson Location Information and Modifying the UI
Use the scrape/get_data.py script to scrape the geojson information.
The script will scrape a map of boston by default, and then generate an HTML map file corresponding to it.

To use this script, you will need to install its dependencies:
```shell
cd scrape
./dependencies.sh # installs spatialindex c library
pip install -r requirements.txt # install python dependencies (virtualenv is recommended)
```

## Providing Routing Data
To run this demo on your own routing data, you need to create a json file under data/ that contains your routing information in the form:
[ 'source', 'destination', 'jump (first step in the path from source to destination)']

You will need to run the demo using test.js instead of the html client, since that one has the map of boston hardcoded in it.
