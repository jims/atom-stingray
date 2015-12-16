/** @babel */

const SIZE = 24;

function createHtmlElements() {
    const root = document.createElement("div");
    root.classList.add("inline-block");
    
    const e = document.createElement("canvas");
    e.width = SIZE * window.devicePixelRatio;
    e.height = SIZE * window.devicePixelRatio;
    e.style.width = SIZE + "px";
    e.style.height = SIZE + "px";
    e.style.top = 0;
    e.style.left = 0;
    e.style.margin = "auto";
    root.appendChild(e);
    
    return {root: root, canvas: e};
}

export class ProgressIndicator {
    constructor() {
        this._elements = createHtmlElements();
        this._progress = 0;
        this.active = false;
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
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            const animate = () => {
                ctx.clearRect(0, 0, SIZE, SIZE);
                
                if (!this._active) {
                    ctx.fillStyle = "rgb(115, 201, 144)";
                    ctx.arc(rad, rad, 4, 0, 2*Math.PI, false);
                    ctx.fill();
                    return;
                }
                
                ctx.lineDashOffset = deg += 0.001;
                ctx.lineWidth = "1";
                ctx.strokeStyle = "rgb(157, 165, 180)";
                ctx.setLineDash([2, 2, 2, 2, 5, 2]);
                ctx.beginPath();
                ctx.arc(rad, rad, rad-3.5, 0, 2*Math.PI, false);
                ctx.stroke();
                deg -= 1;
                
                ctx.lineWidth = "2";
                ctx.strokeStyle = "rgb(100, 148, 237)";
                ctx.setLineDash([]);
                ctx.beginPath();  
                ctx.arc(rad, rad, rad-2, 0, this._progress*2*Math.PI, false);
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
