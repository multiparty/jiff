# WEB-MPC in JIFF
A (basic) demo for asynchronously and securly summing secrets from many input parties, with only two compute parties: a server, and an analyst.

## Roles
We have three roles:
* Server (server.js): handles routing and storing all communications, and participates in the final aggregation with analyst.
* Analyst (analyst.js): Sets up the computation initially by providing a computation id (similar to session id), a public key, and a maximum number of (input) parties to the server.
In addition, when the analyst chooses, the aggregation is executed in MPC between the analyst and the server.
* Input party (input-party.js): Secret shares its input between the server and the analyst. Sends both shares to the server: one encrypted under the server's public key, and the other under the analyst's public key.

## Execution
1. Run the server:
``` node server.js ```
2. Run the analyst to setup the computation:
``` node analyst.js```
3. Run as many input parties as desired:
``` node input-party.js ($INPUT\_VALUE) ```
4. Whenever desired: hit enter into the analyst's terminal to begin computation.

The order of these steps can be changed as follows:
1. Analyst may leave computation after initial setup (**but before any input party submits**), and re-join when desired to perform the aggregation. Simply Ctrl+c to exist analyst, and then re-run command to re-join.
2. Parties may leave computation at any time after sharing their inputs.
3. Server may be run before or after analyst, as long as analyst remains online until the server starts for the initial setup.
4. Input parties can only run after analyst runs: since they need its public key and the computation id. If you run the input party code before the analyst sets up the computation. The code will wait for that to happen,
submit the input, and then exit.

## Keys
By default, jiff generates a random public/private key pair for every party whenever a party is created.

The analyst needs to have the same private key that was used to initialize the computation in order to run aggregation, otherwise all shares encrypted by the input
parties using the previous key are un-retrievable.

Therefore, analyst.js will automatically save the public/private key pair in a file named keys.json when run.
Whenever analyst.js is run, it will automatically look for that file and utilize these keys.
If the file does not exist or has a bad format, it will use new keys.

Finally, the server is usually responsible for delivering all parties keys to each other. If you do not wish to trust the server to perform this step (e.g. man in the middle attacks),
you have to ensure delivery of the keys to the parties via some other channel (e.g. post request to the analyst directly, reading from a file, etc), and make sure these keys
are passed to the constructor of JIFFClient at the input parties, in a similar way to how analyst.js loads keys.

# The real WEB-MPC
This is a stripped down demo showing the high level organization and implementation idea. We have built and regularly deployed a more sophisticated platform of a similar name for computing statistics over private data.
You can find the implementation here [https://github.com/multiparty/web-mpc](https://github.com/multiparty/web-mpc)

Noteable features:
1. Same architecture: a server, analyst, and a bunch of input parties.
2. All parties have authentication: the analyst has a password required to manage sessions, input parties are given a session key and a user token id (independently via email).
3. Input parties can re-submit their data as many times as they like prior to the analyst closing the session (to correct mistakes).
4. Better tracking of parties that submit inputs via hooks.
5. The platform computes averages and standard deviations of values submitted as a spread sheet format.
6. The platform groups values according to the spread sheet structure. Optionally, it can additionally group input parties into cohorts (either pre-assigned or self-assigned).
7. All shares and other important state is stored in a mongo database on the server that interfaces with JIFF via JIFF hooks.
8. Analyst and input parties are all browser based, with nice UIs compatible with older browsers (IE 11).
