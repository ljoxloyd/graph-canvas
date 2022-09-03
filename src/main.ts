import type { Subscription } from 'rxjs'
import { fromEvent, map, switchMap, takeUntil } from "rxjs";

interface GridTheme {
    primary: string
    secondary: string
    background: string
}

class GridCanvas {
    static attachTo(el: HTMLCanvasElement) {
        return new GridCanvas(el);
    }

    public init() {
        this.setupEvents();
        this.adjustCanvasSize();
        this.setCursor("grab");
        return this;
    }

    public paint() {
        this.paintGrid()
        return this
    }

    public config(theme: Partial<GridTheme>) {
        Object.assign(this.theme, theme)
        return this
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

    private readonly theme: GridTheme = {
        primary: "#2d2d2d",
        secondary: "#d2d2d2",
        background: '#fff'
    }

    private readonly gap = 160;
    private readonly subgap = this.gap / 4;

    private readonly ctx: CanvasRenderingContext2D;

    private readonly subscriptions = new Array<Subscription>();

    private setupEvents(self = this) {
        let i = 0;
        self.subscriptions.forEach(subscription => {
            subscription.unsubscribe();
        });

        const mouseDown$ = fromEvent(self.el, "mousedown");
        self.subscriptions[i++] = mouseDown$.subscribe(() => {
            self.setCursor("grabbing");
        });

        const mouseUp$ = fromEvent(self.el, "mouseup");
        self.subscriptions[i++] = mouseUp$.subscribe(() => {
            self.setCursor("grab");
        });

        self.subscriptions[i++] = mouseDown$
            .pipe(
                switchMap(() =>
                    fromEvent<MouseEvent>(self.el, "mousemove").pipe(takeUntil(mouseUp$))
                ),
                map(event => ({
                    x: (self.shiftX + event.movementX) % self.gap,
                    y: (self.shiftY + event.movementY) % self.gap,
                }))
            )
            .subscribe(pos => {
                self.shiftX = pos.x;
                self.shiftY = pos.y;
                self.paintGrid();
            });

        self.subscriptions[i++] = fromEvent(window, "resize").subscribe(() => {
            self.adjustCanvasSize();
            self.paintGrid();
        });
    }

    private paintGrid(self = this): void {
        const { ctx, gap, subgap, theme } = self
        self.clear();

        ctx.beginPath()
        ctx.strokeStyle = theme.secondary;
        self.drawLines(subgap);
        ctx.stroke();

        ctx.beginPath()
        ctx.strokeStyle = theme.primary;
        self.drawLines(gap);
        ctx.stroke();
    }

    private drawLines(step: number, self = this) {
        const { ctx, el, shiftY, shiftX, gap } = self
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

    private clear(self = this) {
        const { ctx, theme, el } = self
        ctx.fillStyle = theme.background
        ctx.fillRect(0, 0, el.width, el.height);
    }

    private adjustCanvasSize(self = this) {
        self.el.width = window.innerWidth;
        self.el.height = window.innerHeight;
    }

    private setCursor(value: "grab" | "grabbing", self = this) {
        self.el.style.cursor = value;
    }
}


// ================================================

class AppTheme {
    constructor(
        styles: CSSStyleDeclaration,
        public main = styles.getPropertyValue('--main'),
        public text1 = styles.getPropertyValue('--text1'),
        public text2 = styles.getPropertyValue('--text2'),
        public bg1 = styles.getPropertyValue('--bg1'),
        public bg2 = styles.getPropertyValue('--bg2'),
        public bg3 = styles.getPropertyValue('--bg3'),
        public bg4 = styles.getPropertyValue('--bg4'),
    ) {
    }
}

// ================================================
(() => {
    const canvasEl = document.querySelector("canvas");
    if (!canvasEl) return

    const theme = new AppTheme(getComputedStyle(document.body))

    GridCanvas
        .attachTo(canvasEl)
        .config({
            primary: theme.text1,
            secondary: theme.text2,
            background: theme.bg3,
        })
        .init()
        .paint();
})()
