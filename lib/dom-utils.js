/** @babel */

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
