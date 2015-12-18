/** @babel */

const SIZE = 24;

function createHtmlElements() {
    const root = document.createElement("div");
    root.classList.add("inline-block");

    const canvas = document.createElement("canvas");
    canvas.width = SIZE * window.devicePixelRatio;
    canvas.height = SIZE * window.devicePixelRatio;
    canvas.style.width = SIZE + "px";
    canvas.style.height = SIZE + "px";
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.margin = "auto";
    canvas.getContext("2d").scale(window.devicePixelRatio, window.devicePixelRatio);
    root.appendChild(canvas);

    return {root: root, canvas: canvas};
}

export class ProgressIndicator {
    constructor() {
        this._elements = createHtmlElements();
        this._progress = 0;
        this.active = false;

        const rad = SIZE / 2.0;
        const ctx = this._elements.canvas.getContext("2d");
        ctx.beginPath();
        ctx.fillStyle = "rgb(157, 165, 180)";
        ctx.arc(rad, rad, 4, 0, 2*Math.PI, false);
        ctx.fill();
    }

    get active() {
        return this._active;
    }

    set active(active) {
        this._active = active;
        const rad = SIZE / 2.0;

        if (active) {
            let deg = 0;
            const ctx = this._elements.canvas.getContext("2d");
            const animate = () => {
                ctx.clearRect(0, 0, SIZE, SIZE);

                if (!this._active) {
                    ctx.beginPath();
                    ctx.fillStyle = "rgb(115, 201, 144)";
                    ctx.arc(rad, rad, 4, 0, 2*Math.PI, false);
                    ctx.fill();
                    return;
                }

                ctx.lineDashOffset = deg -= 0.5;
                ctx.lineWidth = "1";
                ctx.strokeStyle = "rgb(157, 165, 180)";
                ctx.setLineDash([2, 2, 2, 2, 5, 2]);
                ctx.beginPath();
                ctx.arc(rad, rad, rad-3.5, 0, 2*Math.PI, false);
                ctx.stroke();

                ctx.lineWidth = "2";
                ctx.strokeStyle = "rgb(100, 148, 237)";
                ctx.setLineDash([]);
                ctx.beginPath();
                const start = 3*Math.PI/2;
                const progressRad = this._progress*2*Math.PI;
                const end = (start + progressRad) % (2*Math.PI);
                ctx.arc(rad, rad, rad-2, start, end, false);
                ctx.stroke();

                requestAnimationFrame(animate.bind(this));
            };

            requestAnimationFrame(animate.bind(this));
        } else {
            this.progress = 0;
        }
    }

    get progress() {
        return this._progress;
    }

    set progress(progress) {
        this._progress = progress;
    }

    get element() {
        return this._elements.root;
    }
}
