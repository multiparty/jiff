// Setup JIFF Client
const JIFFClient = require("../../lib/jiff-client.js");

const options = {
    party_count: 2,
    crypto_provider: true,
};

var jiffClient = new JIFFClient(
    "http://localhost:8112",
    "our-setup-application",
    options,
);

var entries:{ [key: number]: number };
entries = { 1: 60, 2: 60 };

// Addition 60 + 60 = 120
jiffClient.wait_for([1, 2], async () => {
    const input = await jiffClient.share(entries[2]);
    const sec_ttl = await input[1].sadd(input[2]);
    const pub_ttl = await sec_ttl.open();
});


// Subtraction 60 - 60 = 0
jiffClient.wait_for([1, 2], async () => {

    const input = await jiffClient.share(entries[2]);
    const sec_ttl = await input[1].ssub(input[2]);
    const pub_ttl = await sec_ttl.open();
})


// Multiplication 60 x 60 = 3600
jiffClient.wait_for([1, 2], async () => {

    const input = await jiffClient.share(entries[1]);
    const sec_ttl = await input[1].smult(input[2]);
    const pub_ttl = await sec_ttl.open();
  
})    


// Division 60 / 60 = 0
jiffClient.wait_for([1, 2], async () => {

    const input = await jiffClient.share(entries[1]);
    const sec_ttl = await input[1].sdiv(input[2]);
    const pub_ttl = await sec_ttl.open();

})