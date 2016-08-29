/** @babel */

export function addThrottledEventListener(eventTarget, type, listener) {
    console.assert(eventTarget instanceof EventTarget);
    console.assert(typeof(type) === "string");
    console.assert(typeof(listener) === "function");
    let request = null;

    function unthrottledListener(event) {
        if (request !== null)
            window.cancelAnimationFrame(request);

        request = window.requestAnimationFrame(() => listener(event));
    }

    eventTarget.addEventListener(type, unthrottledListener);
}

export function createDomElementWithClass(elementType, className) {
    console.assert(typeof(elementType) === "string");
    console.assert(typeof(className) === "string");
    const element = document.createElement(elementType);
    element.className = className;
    return element;
}

export function createDomElementWithStyle(elementType, styleAttributes) {
    console.assert(typeof(elementType) === "string");
    console.assert(styleAttributes == null || typeof(styleAttributes) === "object");
    const element = document.createElement(elementType);

    if (styleAttributes == null)
        return element;

    for (let key in styleAttributes) {
        if (styleAttributes.hasOwnProperty(key)) {
            const value = styleAttributes[key];
            const isInteger = typeof(value) === "number" && (value % 1) === 0;
            element.style[key] = isInteger ? (value + "px") : value;
        }
    }

    return element;
}

export function getContextPixelRatio(context) {
    console.assert(context instanceof CanvasRenderingContext2D);
    const devicePixelRatio = window.devicePixelRatio || 1;
    const backingStorePixelRatio = context.webkitBackingStorePixelRatio
                              || context.mozBackingStorePixelRatio
                              || context.msBackingStorePixelRatio
                              || context.oBackingStorePixelRatio
                              || context.backingStorePixelRatio
                              || 1;

    const pixelRatio = devicePixelRatio / backingStorePixelRatio;
    return pixelRatio;
}

export function setDomElementClass(element, className, enabled) {
    console.assert(element instanceof HTMLElement);
    console.assert(typeof(className) === "string");
    const classList = element.classList;

    if (classList.contains(className)) {
        if (!enabled)
            classList.remove(className);
    } else {
        if (enabled)
            classList.add(className);
    }
}
