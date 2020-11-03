/**
 * Returns true if the object is defined, returns false otherwise.
 *
 * @exports defined
 *
 * @example
 * if (Cesium.defined(positions)) {
 *      doSomething();
 * } else {
 *      doSomethingElse();
 * }
 */
export function defined(value) {
    return value !== undefined;
};
