declare global {
  namespace jest {
    interface Matchers<R> {
      toContainObjects<E extends object>(expected: E[]): R;
    }
  }
}

export {};
