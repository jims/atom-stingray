/** @babel */

/*
TODO: Layout has changed:
    int32 type;
    uint32 alignment_padding;
    union
    {
        const char* name;
        uint64 name_padding;
    };
    int64 time;
    int64 rdtsc;
    uint32 thread_hash;
    int32 core_id;
*/

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

export function parseProfilerDataBuffer(inBuffer) {
    const inStruct = profilerEventStruct;
    const inBytes = inBuffer.byteLength;
    const inLength = inBytes / inStruct.size;

    const inType = new Uint8Array(inBuffer, inStruct.type.offset * inLength, inLength);
    const inName = new Float64Array(inBuffer, inStruct.name.offset * inLength, inLength);
    const inTime = new Float64Array(inBuffer, inStruct.time.offset * inLength, inLength);
    const inThreadId = new Int32Array(inBuffer, inStruct.threadId.offset * inLength, inLength);
    const inCoreId = new Uint8Array(inBuffer, inStruct.coreId.offset * inLength, inLength);

    // Count number of start events
    let numStartEvents = 0;

    for (let i = 0; i < inLength; ++i)
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

    for (let inIndex = 0; inIndex < n; ++inIndex) {
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
