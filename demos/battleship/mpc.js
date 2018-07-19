(function(exports, node) {
    
    var saved_instance;
    var ships;
    var guesses;

    var myGuesses = null;
    var oppoGuesses = null;
    var myShips = null;;
    var oppoShips = null;
  
    /**
     * Connect to the server and initialize the jiff instance
     */
    exports.connect = function (hostname, computation_id, options) {
      var opt = Object.assign({}, options);
  
      if(node)
        jiff = require('../../lib/jiff-client');
  
      saved_instance = jiff.make_jiff(hostname, computation_id, opt);
      return saved_instance;
    };


    // share ship locations, return your party_id
    exports.share_ships = function (input, jiff_instance) {
        if(jiff_instance == null) jiff_instance = saved_instance;

        return new Promise(function(resolve, reject) {
            let promise_ships = jiff_instance.share_array(input);
            promise_ships.then(function(res_ships) {
                ships = res_ships;
                resolve(jiff_instance.id);
            });
        });
    };





    /**
     * The MPC computation
     */
    function check_answers(p_guesses, p_ships){
        let answers = [];
        // 0 = miss
        // 1 = hit
        for (let g = 0; g < p_guesses.length; g++) {
            answers[g] = secret_share(0); // is this a secret share?
            for (let s = 0; s < s_ships.length; s++) {
                let a = p_guesses[g];
                let b = p_ships[s];
                answers[g] = answers[g].sadd(a.seq(b));
            }
        }
        return answers; // an array of secret shares
    };

    // gets guesses and partyID, shares guesses, check guesses, return answers and party_id
    exports.share_guesses = function (input, jiff_instance) {
        if(jiff_instance == null) jiff_instance = saved_instance;


        // return new Promise(function(resolve, reject) {
        //     let promise_ships = jiff_instance.share_array(input);
        //     promise_ships.then(function(res_ships) {
        //         ships = res_ships;
        //         resolve(jiff_instance.id);
        //     });
        // });


        // if(jiff_instance == null) jiff_instance = saved_instance;

        // console.log('reached HERE: share_guesses');

        // // share the array
        // guess_promise = jiff_instance.share_array(input.partyGuesses);
        // guess_promise.then(function(guesses) {

        //     console.log('reached HERE: array has been shared');
        
        //     var returnObj = {
        //         myAnswers: [0, 8],
        //         oppoAnswers: [0, 5],
        //     }

            // //var final_deferred = $.Deferred();
            // // var final_promise = final_deferred.promise();

            // if(input.partyID == 1) {
            //     myGuesses = guesses[1];
            //     oppoGuesses = guesses[2];
            //     myShips = ships[1];
            //     oppoShips = ships[2];
            // }
            // else {
            //     myGuesses = guesses[2];
            //     oppoGuesses = guesses[1];
            //     myShips = ships[2];
            //     oppoShips = ships[1];
            // }

            // // get new arrays
            // let t_myAnswers = check_answers(myGuesses, oppoShips);
            // let t_oppoAnswers = check_answers(oppoGuesses, myShips);

            // // Open the array
            // allMyAnswers_Promises = [];
            // allMyOppoAnswers_Promises = [];
            // for (var i = 0; i < t_myAnswers.length; i++) {
            //     allMyAnswers_Promises.push(jiff_instance.open(t_myAnswers[i]));
            //     allMyOppoAnswers_Promises.push(jiff_instance.open(t_oppoAnswers[i]));
            // }

            // Promise.all(allMyAnswers_Promises).then(function(results) {
            //     returnObj.myAnswers = results;
            //     console.log('reached HERE 2');
            // });

            // Promise.all(allMyOppoAnswers_Promises).then(function(results) {
            //     returnObj.oppoAnswers = results;
            //     console.log('reached HERE 3');
            // });

            // // reset stuff
            // var guesses = null;

            // var myGuesses = null;
            // var oppoGuesses = null;
            // var myShips = null;;
            // var oppoShips = null;

        //     console.log('reached HERE: about to return returnObj ' + returnObj.myAnswers + returnObj.oppoAnswers);
        //     return returnObj;
        // });
    };



    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! from array-substring/mpc !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!



    // exports.compute = function (input, jiff_instance) {
    //     if(jiff_instance == null) jiff_instance = saved_instance;
    
    //     // The MPC implementation should go *HERE*
    //     var final_deferred = $.Deferred(); // this will resolve to the final result
    //     var final_promise = final_deferred.promise(); // which is an array of 0/1 values for every index in the haystack
        
    //     // First, turn the string into an array of numbers
    //     var asciiCodes = [];
    //     for(var i = 0; i < input.length; i++)
    //       asciiCodes.push(input.charCodeAt(i));
    
    //     // Now secret share the array of numbers
    //     var inputPromise = jiff_instance.share_array(asciiCodes);
    
    //     // Perform the computation
    //     inputPromise.then(function(shares) {
    //       // Party 1 provides the haystack in which to look
    //       var haystack = shares[1];
    
    //       // Party 2 provides the needle to find
    //       var needle = shares[2];
          
    //       // Store a promise to the result of looking for the needle in every index
    //       var results = [];
    
    //       // Look for needle at every index in the haystack
    //       for(var i = 0; i <= haystack.length - needle.length; i++) {
    //         // Compare all the characters till the end of the substring
    //         var comparison = haystack[i].seq(needle[0]);
    //         for(var j = 1; j < needle.length; j++) {
    //           comparison = comparison.smult(haystack[i+j].seq(needle[j]));
    //         }
    
    //         results[i] = comparison.open();
    //       }
    
    //       // Combine the promises for every index, when the result is ready, pass it to the final_promise
    //       Promise.all(results).then(function(results) {
    //         final_deferred.resolve(results);
    //       });
    // });









    //!!!!!!!!!!!!!!!!!! SUM STUFF !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // exports.compute = function (input, jiff_instance) {
    //   if(jiff_instance == null) jiff_instance = saved_instance;
  
    //   // The MPC implementation should go *HERE*
    //   var shares = jiff_instance.share(input);
    //   var sum = shares[1];
    //   for(var i = 2; i <= jiff_instance.party_count; i++) {
    //     sum = sum.sadd(shares[i]);
    //   }
      
    //   // Return a promise to the final output(s)
    //   return jiff_instance.open(sum);
    // };






  }((typeof exports == 'undefined' ? this.mpc = {} : exports), typeof exports != 'undefined'));  