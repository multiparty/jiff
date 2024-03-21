describe('JIFF Arithmetic Operations', () => {
    const JIFFClient = require("../../lib/jiff-client.js");
    const options = { party_count: 2, crypto_provider: true};

    var jiffClient = new JIFFClient("http://localhost:8080","our-setup-application",options)

    var inputs = [50,50]




    it('Adds 2 numbers', async ()=> {
        jiffClient.wait_for([1,2], async () => {
            const input1 = await jiffClient.share(inputs[0]);
            const input2 = await jiffClient.share(inputs[1]);

            const result = await input1.sadd(input2);
            const openResult = await result.open();

            
            expect(openResult).toEqual(100);
        });
    });

    it('Subtracts 2 numbers', async()=> {
        jiffClient.wait_for([1,2], async () => {
            const input1 = await jiffClient.share(inputs[0]);
            const input2 = await jiffClient.share(inputs[1]);

            const result = await input1.ssub(input2);
            const openResult = await result.open();

            
            expect(openResult).toEqual(0)
        })
    })
    
    it('Multiplies 2 numbers', async()=> {
        jiffClient.wait_for([1,2], async () => {
            const input1 = await jiffClient.share(inputs[0]);
            const input2 = await jiffClient.share(inputs[1]);

            const result = await input1.smult(input2);
            const openResult = await result.open();

            
            expect(openResult).toEqual(2500)
        })
    })

    it('Divides 2 numbers', async()=> {
        jiffClient.wait_for([1,2], async () => {
            const input1 = await jiffClient.share(inputs[0]);
            const input2 = await jiffClient.share(inputs[1]);

            const result = await input1.sdiv(input2);
            const openResult = await result.open();

            
            expect(openResult).toEqual(1)
        })
    })

});