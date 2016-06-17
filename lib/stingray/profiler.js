/** @babel */

const profilerEventStruct = {
    type: {offset: 0, size: 1},
    name: {offset: 1, size: 8},
    time: {offset: 9, size: 8},
    threadId: {offset: 17, size: 4},
    coreId: {offset: 21, size: 1},

    size: 22,
};

const parsedProfilerEventStruct = {
    type: {offset: 0, size: 1},
    name: {offset: 1, size: 8},
    start: {offset: 9, size: 8},
    threadId: {offset: 17, size: 4},
    coreId: {offset: 21, size: 1},

    parent: {offset: 22, size: 4},
    firstChild: {offset: 26, size: 4},
    lastChild: {offset: 30, size: 4},
    prevSibling: {offset: 34, size: 4},
    nextSibling: {offset: 38, size: 4},

    elapsed: {offset: 42, size: 8},
    count: {offset: 50, size: 4},

    size: 54,
};

const align = 8;

function roundDownToAlign(x) {
    return x - x % align;
}

function roundUpToAlign(x) {
    return roundDownToAlign(x + align - 1, align);
}

function parseProfilerDataArrays(count, inType, inName, inTime, inThreadId, inCoreId) {
    // Count number of start events
    let numStartEvents = 0;

    for (let i = 0; i < count; ++i)
        numStartEvents += (inType[i] == 0 ? 1 : 0);

    // Index 0 is unused (indicates no value)
    // Index 1 is used for "default root"
    const outLength = numStartEvents + 2;

    // Allocation size divisible by 8 for good alignment.
    const outAllocCount = Math.ceil(outLength / 8) * 8;
    const outStruct = parsedProfilerEventStruct;
    const bytesToAlloc = outAllocCount * outStruct.size;
    const outBuffer = new ArrayBuffer(bytesToAlloc);

    const out = {}
    {
        const ab = outBuffer;
        const s = outStruct;
        const n = outLength;
        const sz = outAllocCount;
        out.n = outLength;
        out.type = new Uint8Array(ab, s.type.offset * sz, n);
        out.name = new Float64Array(ab, s.name.offset * sz, n);
        out.start = new Float64Array(ab, s.start.offset * sz, n);
        out.threadId = new Uint32Array(ab, s.threadId.offset * sz, n);
        out.coreId = new Uint8Array(ab, s.coreId.offset * sz, n);
        out.parent = new Uint32Array(ab, s.parent.offset * sz, n);
        out.firstChild = new Uint32Array(ab, s.firstChild.offset * sz, n);
        out.lastChild = new Uint32Array(ab, s.lastChild.offset * sz, n);
        out.prevSibling = new Uint32Array(ab, s.prevSibling.offset * sz, n);
        out.nextSibling = new Uint32Array(ab, s.nextSibling.offset * sz, n);
        out.elapsed = new Float64Array(ab, s.elapsed.offset * sz, n);
        out.count = new Uint32Array(ab, s.count.offset * sz, n);
    }

    const stack = [];
    stack.push(1);
    let outIndex = 2;

    for (let inIndex = 0; inIndex < count; ++inIndex) {
        const type = inType[inIndex];

        if (type == 0) {
            const i = outIndex;
            out.type[i] = inType[inIndex];
            out.name[i] = inName[inIndex];
            out.start[i] = inTime[inIndex];
            out.threadId[i] = inThreadId[inIndex];
            out.coreId[i] = inCoreId[inIndex];

            const p = stack[stack.length - 1];
            out.parent[i] = p;
            out.prevSibling[i] = out.lastChild[p];

            if (!out.firstChild[p])
                out.firstChild[p] = i;

            out.lastChild[p] = i;

            if (out.prevSibling[i])
                out.nextSibling[out.prevSibling[i]] = i;

            stack.push(outIndex);
            ++outIndex;
        }
        else if (type == 1 && stack.length) {
            const i = stack.pop();
            const end = inTime[inIndex];
            out.elapsed[i] = end - out.start[i];
        }
    }

    return out;
}

function parseProfilerDataBufferV1(inBuffer, indexOfNullChar) {
    // V1 Binary Format:
    // [Json Header] '\0'
    // [n x type, 1 byte each]
    // [n x name, 8 byte each]
    // [n x time, 8 byte each]
    // [n x thread id, 4 byte each]
    // [n x core id, 1 byte each]

    const inStruct = profilerEventStruct;
    const inBinaryData = inBuffer.slice(indexOfNullChar + 1);
    const inBytes = inBinaryData.byteLength;
    const count = inBytes / inStruct.size;

    const inType = new Uint8Array(inBinaryData, inStruct.type.offset * count, count);
    const inName = new Float64Array(inBinaryData, inStruct.name.offset * count, count);
    const inTime = new Float64Array(inBinaryData, inStruct.time.offset * count, count);
    const inThreadId = new Int32Array(inBinaryData, inStruct.threadId.offset * count, count);
    const inCoreId = new Uint8Array(inBinaryData, inStruct.coreId.offset * count, count);

    return parseProfilerDataArrays(count, inType, inName, inTime, inThreadId, inCoreId);
}

function parseProfilerDataBufferV2(inBuffer, indexOfNullChar, count) {
    // V2 Binary Format:
    // [Json Header] '\0' <padding-to-alignment>
    // [n x type, 1 byte each] <padding-to-alignment>
    // [n x name, 8 byte each] <padding-to-alignment>
    // [n x time, 8 byte each] <padding-to-alignment>
    // [n x thread id, 4 byte each] <padding-to-alignment>
    // [n x core id, 1 byte each] <padding-to-alignment>

    const inStruct = profilerEventStruct;
    const inTypeDataStart = roundUpToAlign(indexOfNullChar);
    const inNameDataStart = inTypeDataStart + roundUpToAlign(count * inStruct.type.size);
    const inTimeDataStart = inNameDataStart + roundUpToAlign(count * inStruct.name.size);
    const inThreadIdDataStart = inTimeDataStart + roundUpToAlign(count * inStruct.time.size);
    const inCoreIdDataStart = inThreadIdDataStart + roundUpToAlign(count * inStruct.threadId.size);

    const inType = new Uint8Array(inBuffer, inTypeDataStart, count);
    const inName = new Float64Array(inBuffer, inNameDataStart, count);
    const inTime = new Float64Array(inBuffer, inTimeDataStart, count);
    const inThreadId = new Int32Array(inBuffer, inThreadIdDataStart, count);
    const inCoreId = new Uint8Array(inBuffer, inCoreIdDataStart, count);

    return parseProfilerDataArrays(count, inType, inName, inTime, inThreadId, inCoreId);
}

export function parseProfilerDataBuffer(inBuffer) {
    // Binary Format:
    // [Json Header] '\0'
    // <version-specific binary data>

    // V1 Json Header Format:
    // { type: "profiler_data" }

    // V2 Json Header Format:
    // { type: "profiler_data", count: <event count> }

    // Find boundary between Json Header and binary data.
    let indexOfNullChar = 0;
    const dataView = new DataView(inBuffer, 0, 128);

    while (dataView.getUint8(indexOfNullChar))
        ++indexOfNullChar;

    // Parse Json Header
    const decoder = new TextDecoder("utf-8");
    const decodedString = decoder.decode(dataView).substring(0, indexOfNullChar);
    const header = JSON.parse(decodedString);

    if (header.count != null)
        return parseProfilerDataBufferV2(inBuffer, indexOfNullChar, header.count);

    return parseProfilerDataBufferV1(inBuffer, indexOfNullChar);
}
