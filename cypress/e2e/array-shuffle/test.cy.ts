describe('Array Concat and Shuffle', () => {
  before(() => {
    // Load the fixture data before the tests
    cy.fixture('mpc_input.json').as('inputData');
  });

  it('Search Output', () => {
    // Visit the HTML page
    cy.visit('array-shuffle/client.html');

    // Load the input data and interact with the UI
    cy.get('@inputData').then((inputData) => {
      const arrayInput1 = (inputData as any)['array-shuffle']['1'] as number[];
      const arrayInput2 = (inputData as any)['array-shuffle']['2'] as number[];

      // Start JIFF Clients
      cy.get('#connectButton').click();

      // Input the array1
      cy.get('#inputText1').clear().type(JSON.stringify(arrayInput1));
      cy.get('#submit1').click();

      // Input the array2
      cy.get('#inputText2').clear().type(JSON.stringify(arrayInput2));
      cy.get('#submit2').click();

      // Check the output by sorting
      cy.get('#output p').each(($p) => {
        const resultText = $p.text().replace('Result is: ', '');
        const actualNumbers = resultText.split(',').map(Number).sort();
        const expectedNumbers = arrayInput1.concat(arrayInput2).sort();

        expect(actualNumbers).to.deep.equal(expectedNumbers);
      });
    });
  });
});
