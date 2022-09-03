import 'reset.css'
import './style.css'
import { fromEvent, map, switchMap, takeUntil } from 'rxjs'

class GridCanvas {
    static attachTo(el: HTMLCanvasElement) {
        return new GridCanvas(el)
    }

    public init() {
        this.setupStreams()
        this.adjustCanvasSize()
        this.paintGrid()
        this.setCursor('grab')
        return this
    }

    private constructor(
        private readonly el: HTMLCanvasElement
    ) {
        this.ctx = el.getContext("2d")!;
    }

    private readonly position = { x: 0, y: 0, }

    private readonly sample = 100

    private readonly ctx: CanvasRenderingContext2D;

    private setupStreams() {
        const mouseDown$ = fromEvent(this.el, "mousedown");
        mouseDown$.subscribe(() => {
            this.setCursor('grabbing')
        })

        const mouseUp$ = fromEvent(this.el, "mouseup");
        mouseUp$.subscribe(() => {
            this.setCursor('grab')
        })

        mouseDown$
            .pipe(
                switchMap(() => fromEvent<MouseEvent>(this.el, "mousemove")
                    .pipe(takeUntil(mouseUp$))
                ),
                map(e => ({
                    x: (this.position.x + e.movementX) % this.sample,
                    y: (this.position.y + e.movementY) % this.sample,
                }))
            )
            .subscribe(pos => {
                this.position.x = pos.x;
                this.position.y = pos.y;
                this.paintGrid();
            });

        fromEvent(window, 'resize').subscribe(() => {
            this.adjustCanvasSize()
            this.paintGrid()
        })
    }

    private paintGrid(): void {
        const { ctx, el, position, sample } = this;

        ctx.fillStyle = "#fff";
        ctx.clearRect(0, 0, el.width, el.height);

        ctx.beginPath();
        ctx.strokeStyle = "black";
        let { x, y } = position;
        while (x < el.width) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, el.height);
            x += sample;
        }
        while (y < el.height) {
            ctx.moveTo(0, y);
            ctx.lineTo(el.width, y);
            y += sample;
        }
        ctx.stroke();
    }

    private adjustCanvasSize() {
        this.el.width = window.innerWidth
        this.el.height = window.innerHeight
    }

    private setCursor(value: 'grab' | 'grabbing') {
        this.el.style.cursor = value;
    }
}

/*
======================================================
Render
*/

GridCanvas.attachTo(document.querySelector('canvas')!).init()
