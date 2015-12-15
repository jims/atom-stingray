/** @babel */

export function createStyledElement(elementType, styleAttributes) {
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
