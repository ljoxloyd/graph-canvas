import type { Subscription } from 'rxjs'
import { fromEvent, map, switchMap, takeUntil } from "rxjs";

class GridCanvas {
    static attachTo(el: HTMLCanvasElement) {
        return new GridCanvas(el);
    }

    public init() {
        this.setupEvents();
        this.adjustCanvasSize();
        this.setCursor("grab");
        this.paintGrid();
        return this;
    }

    private constructor(
        private readonly el: HTMLCanvasElement
    ) {
        const maybeCtx = el.getContext("2d");
        if (!maybeCtx) {
            throw new Error("Couldn't get a rendering context")
        }
        this.ctx = maybeCtx;
    }

    private shiftX = 0;
    private shiftY = 0;

    private readonly gap = 160;
    private readonly subgap = this.gap / 4;

    private readonly ctx: CanvasRenderingContext2D;

    private readonly subscriptions = new Array<Subscription>();

    private setupEvents() {
        let i = 0;
        this.subscriptions.forEach(subscription => {
            subscription.unsubscribe();
        });

        const mouseDown$ = fromEvent(this.el, "mousedown");
        this.subscriptions[i++] = mouseDown$.subscribe(() => {
            this.setCursor("grabbing");
        });

        const mouseUp$ = fromEvent(this.el, "mouseup");
        this.subscriptions[i++] = mouseUp$.subscribe(() => {
            this.setCursor("grab");
        });

        this.subscriptions[i++] = mouseDown$
            .pipe(
                switchMap(() =>
                    fromEvent<MouseEvent>(this.el, "mousemove").pipe(takeUntil(mouseUp$))
                ),
                map(event => ({
                    x: (this.shiftX + event.movementX) % this.gap,
                    y: (this.shiftY + event.movementY) % this.gap,
                }))
            )
            .subscribe(pos => {
                this.shiftX = pos.x;
                this.shiftY = pos.y;
                this.paintGrid();
            });

        this.subscriptions[i++] = fromEvent(window, "resize").subscribe(() => {
            this.adjustCanvasSize();
            this.paintGrid();
        });
    }

    private paintGrid({ ctx, gap, subgap } = this): void {
        this.clear();

        ctx.beginPath()
        ctx.strokeStyle = "#d2d2d2";
        this.drawLines(subgap);
        ctx.stroke();

        ctx.beginPath()
        ctx.strokeStyle = "#2d2d2d";
        this.drawLines(gap);
        ctx.stroke();
    }

    private drawLines(step: number, { ctx, el, shiftY, shiftX, gap } = this) {
        let x = shiftX - gap;
        let y = shiftY - gap;
        while (x < el.width) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, el.height);
            x += step;
        }
        while (y < el.width) {
            ctx.moveTo(0, y);
            ctx.lineTo(el.width, y);
            y += step;
        }
    }

    private clear({ ctx, el } = this) {
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, el.width, el.height);
    }

    private adjustCanvasSize({ el } = this) {
        el.width = window.innerWidth;
        el.height = window.innerHeight;
    }

    private setCursor(value: "grab" | "grabbing") {
        this.el.style.cursor = value;
    }
}

const canvasEl = document.querySelector("canvas");
if (canvasEl) {
    GridCanvas.attachTo(canvasEl).init();
}
