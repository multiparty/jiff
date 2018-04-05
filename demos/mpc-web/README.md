# MPC-WEB in JIFF
A (basic) demo for summing with many input parties, and two compute parties: a server, and an analyst.

## Roles
We have three roles:
* Server (server.js): handles routing and storing all communications, and participates in the final aggregation with analyst.
* Analyst (analyst.js): Sets up the computation initially by providing a computation id (similar to session id), a public key, and a maximum number of parties to the server.
In addition, when the analyst chooses, the aggregation is executed in MPC between the analyst and the server.
* Input party (party.js): Secret shares its input between the server and the analyst. Sends both shares to the server: one encrypted under the server's public key, and the other under the analyst's public key.

## Execution
1. Run the server:
``` node server.js ```
2. Run the analyst to setup the computation:
``` node analyst.js```
3. Run as many input parties as desired:
``` node party.js ($INPUT\_VALUE) ```
4. Whenever desired: type start into the analyst's terminal and hit enter to begin computation.

The order of these steps can be changed as follows:
1. Analyst may leave computation after initial setup, and re-join when desired to perform the aggregation. Simply Ctrl+c to exist analyst, and then re-run command to re-join.
2. Parties may leave computation at any time after sharing their inputs.
3. Server may be run before or after analyst, as long as analyst remains online until the server starts.
4. Input parties can only run after analyst runs: since they need its public key and the computation id.

## Keys
By default, jiff generates a random public/private key pair for every party whenever a party is created.
The analyst needs to have the same private key that was used to intialize the computation in order to run aggregation.
Therefore, analyst.js will automatically save the public/private key pair in a file named keys.json when run.
Whenever analyst.js is run, it will automatically look for that file and utilize these keys. 
If the file does not exist or has a bad format, it will use new keys.
