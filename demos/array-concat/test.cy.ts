describe('Concat two Strings through Secret Array Operation', () => {
  before(() => {
    // Load the fixture data before the tests
    cy.fixture('mpc_input.json').as('inputData');
  });

  it('Concatenate two arrays', () => {
    // Visit the HTML page
    cy.visit('array-concat/client.html');

    // Load the input data and interact with the UI
    cy.get('@inputData').then((inputData) => {
      const arrayInput1 = (inputData as any)['array-concat']['1'] as String;
      const arrayInput2 = (inputData as any)['array-concat']['2'] as String;

      // Start JIFF Clients
      cy.get('#connectButton').click();

      // Input the array1
      let input1 = JSON.stringify(arrayInput1);
      input1 = input1.slice(1, -1);
      cy.get('#inputText1').clear().type(input1);
      cy.get('#submit1').click();

      // Input the array2
      let input2 = JSON.stringify(arrayInput2);
      input2 = input2.slice(1, -1);
      cy.get('#inputText2').clear().type(input2);
      cy.get('#submit2').click();
      
      cy.wait(10000);
      // Check the output
      cy.get('#output').should(($el) => {
        const text = $el.text();
        expect(text.includes('abcdefghi') || text.includes('efghiabcd')).to.be.true;
      });
    });
  });
});
