/** @babel */

export function consumeIf(evt, predicate) {
    console.assert(evt instanceof Event);
    console.assert(typeof(predicate) === "function");

    if (predicate(evt)) {
        evt.stopPropagation();
        evt.preventDefault();
        return true;
    }

    return false;
};
