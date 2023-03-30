import { matcherHint, printExpected, printReceived } from 'jest-matcher-utils';
import { object } from 'ryutils';

expect.extend({
  toContainObjects(received: [], expected: []) {
    const pass = (() => {
      if (!Array.isArray(received) || !Array.isArray(expected)) {
        return false;
      }

      return expected.every(props => received.some(obj => object.isSubset(obj, props)));
    })();

    return {
      pass,
      message: () =>
        toHint('toContainObjects', !!this.isNot) + toMessage(received, expected, !!this.isNot),
    };
  },
});

function toHint(matcher: string, negative: boolean) {
  return `${matcherHint(matcher, undefined, undefined, { isNot: negative })}\n\n`;
}

function toMessage(received: unknown, expected: unknown, negative: boolean) {
  return (
    `Expected: ${negative ? 'not ' : ''}${printExpected(expected)}\n` +
    `Received: ${negative ? '    ' : ''}${printReceived(received)}`
  );
}
