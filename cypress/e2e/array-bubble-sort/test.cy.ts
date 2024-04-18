describe('Array Bubble Sort Sum of two arrays', () => {
  before(() => {
    // Load the fixture data before the tests
    cy.fixture('mpc_input.json').as('inputData');
  });

  it('Search Output', () => {
    // Visit the HTML page
    cy.visit('array-bubble-sort/client.html');

    // Load the input data and interact with the UI
    cy.get('@inputData').then((inputData) => {
      const arrayInput1 = (inputData as any)['array-bubble-sort']['1'] as number[];
      const arrayInput2 = (inputData as any)['array-bubble-sort']['2'] as number[];

      // Ensure the correct role is selected and the inputs are visible
      cy.get('#connectButton').click();

      // Input the array1
      cy.get('#inputText1').clear().type(JSON.stringify(arrayInput1));
      cy.get('#submit1').click();

      // Input the array2
      cy.get('#inputText2').clear().type(JSON.stringify(arrayInput2));
      cy.get('#submit2').click();

      // Check the output
      cy.get('#output').should('contain', '2,4,6');
    });
  });
});
