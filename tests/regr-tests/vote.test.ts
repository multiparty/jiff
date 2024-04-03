describe('JIFF Voting', () => {
  var jiffClients: any[] = [];
  var jiffServer: any;
  var server: any;
  const entries: { [key: number]: number[] } = { 1: [1, 0, 0, 0], 2: [0, 0, 0, 1], 3: [0, 0, 0, 1] };
  var computation_id = 'test-voting';
  const party_count = 3;

  beforeEach(async () => {
    // Server Setup
    let port: number = 8112;
    const init_server = require('./server');
    const servers = init_server(port);
    (jiffServer = servers[0]), (server = servers[1]);
    await new Promise((resolve) => server.on('listening', resolve)); // Wait for server to be ready

    // Client Setup
    const JIFFClient = require('../../lib/jiff-client.js');
    const baseUrl = `http://localhost:${port}`;
    const options = {
      party_count: party_count,
      crypto_provider: true
    };

    jiffClients = Array.from({ length: party_count }, () => new JIFFClient(baseUrl, computation_id, options));

    const jiff_negativenumber = require('../../lib/ext/jiff-client-negativenumber.js');

    async function apply_extension(jiff: any) {
      await jiff.apply_extension(jiff_negativenumber, options);
    }
    Promise.all(jiffClients.map(apply_extension));
  });

  afterEach(async () => {
    // Shutting down client
    Promise.all(jiffClients.map((client) => client.socket.disconnect()));

    // Shutting down Server
    await jiffServer.closeAllSockets();
    await jiffServer.freeComputation(computation_id);
  });

  it('should correctly find the majority vote', async () => {
    async function sanityCheck(shares: any) {
      // first check: if sum of values in an array/share = 1
      var sum = shares[0];
      for (var i = 1; i < shares.length; i++) {
        sum = await sum.add(shares[i]);
      }
      var check1 = await sum.eq(1);

      // second check: if all elements are <= 1
      var check2 = await shares[0].lteq(1);
      for (var j = 1; j < shares.length; j++) {
        check2 = await check2.smult(shares[j].lteq(1));
      }

      // 1(=true) only if both first & second checks pass
      const sanity_flag = await check1.mult(check2);
      return sanity_flag;
    }

    async function find_majority_vote(jiffClient: any, id: number) {
      return new Promise((resolve, reject) => {
        jiffClient.wait_for([1, 2, 3], async () => {
          try {
            const input = await jiffClient.share_array(entries[id]);
            const checker1 = await sanityCheck(input[1]);
            const checker2 = await sanityCheck(input[2]);
            const checker3 = await sanityCheck(input[3]);
            var sanity_flag = await checker1.add(checker2);
            sanity_flag = await sanity_flag.add(checker3);
            sanity_flag = await sanity_flag.eq(3);

            // Aggregating all votes into the array named 'vote'
            var vote = input[1];
            for (var party = 2; party <= jiffClient.party_count; party++) {
              for (var idx = 0; idx < vote.length; idx++) {
                vote[idx] = await vote[idx].add(input[party][idx]);
              }
            }

            // Check who's got the majority vote
            var majo_idx = 0;
            var curr_max = vote[0];
            for (var i = 1; i < vote.length; i++) {
              var iIsMax = await vote[i].gt(curr_max);
              majo_idx = await iIsMax.if_else(i, majo_idx);
            }
            majo_idx = await sanity_flag.if_else(majo_idx, -1);

            const result = await jiffClient.open(majo_idx);
            resolve(result.toString(10));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    const results = await Promise.all(jiffClients.map((client, idx) => find_majority_vote(client, idx + 1)));
    results.map((res) => expect(res).toEqual('3'));
  }, 25000);
});
