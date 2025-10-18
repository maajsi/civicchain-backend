const { CATEGORY_URGENCY } = require('../../src/utils/priority');

describe('Priority CATEGORY_URGENCY', () => {
  test('contains expected keys and values', () => {
    expect(CATEGORY_URGENCY.pothole).toBeGreaterThan(0);
    expect(CATEGORY_URGENCY.garbage).toBeGreaterThan(0);
    expect(CATEGORY_URGENCY.streetlight).toBeGreaterThan(0);
    expect(CATEGORY_URGENCY.water).toBeGreaterThan(0);
    expect(CATEGORY_URGENCY.other).toBeGreaterThan(0);
  });
});
