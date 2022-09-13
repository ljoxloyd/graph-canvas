import {
    bindActionCreators,
    combineReducers,
    configureStore,
    createAction,
    createReducer,
} from '@reduxjs/toolkit';
import {
    filter,
    from,
    fromEvent,
    map,
    switchMap,
    takeUntil,
    tap,
    Observable,
    merge,
    Subject,
    throttleTime,
} from "rxjs";

namespace GridLayer {
    export interface Size {
        width: number
        height: number
    }
    export interface Shift {
        x: number
        y: number
    }
    export interface CanvasState {
        size: Size
    }
    export interface CursorState {
        cursor: string
    }
    export interface ContextState {
        shift: Shift
        majorColor: string
        minorColor: string
        background: string
        cellSize: number
        subCells: number
    }
    export interface State extends CanvasState, ContextState, CursorState {
    }

    interface Controller extends State { }
    class Controller {
        public update(state: State): void {
            const updates = [
                this.canvasChanged(state) && this.updateSize,
                this.cursorChanged(state) && this.updateCursor,
                this.updateGrid,
            ]
            Object.assign(this, state)
            for (const task of updates) if (task) task.call(this)
        }

        constructor(
            private readonly el: HTMLCanvasElement,
            private readonly ctx: CanvasRenderingContext2D
        ) {
        }

        private updateSize(): void {
            this.el.width = this.size.width;
            this.el.height = this.size.height;
        }

        private updateCursor(): void {
            this.el.style.cursor = this.cursor;
        }

        private updateGrid(): void {
            const { ctx, el } = this
            ctx.fillStyle = this.background
            ctx.fillRect(0, 0, el.width, el.height);
            ctx.lineWidth = 0.1

            ctx.beginPath()
            ctx.strokeStyle = this.minorColor;
            this.drawLines(this.cellSize / this.subCells, this.cellSize);
            ctx.stroke();

            ctx.beginPath()
            ctx.strokeStyle = this.majorColor;
            this.drawLines(this.cellSize, 1);
            ctx.stroke();
        }

        private drawLines(step: number, start: number): void {
            const { ctx, el } = this
            let x = el.width + this.shift.x % this.cellSize + start
            let y = el.height + this.shift.y % this.cellSize + start
            while (x > 0) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, el.height);
                x -= step;
            }
            while (y > 0) {
                ctx.moveTo(0, y);
                ctx.lineTo(el.width, y);
                y -= step;
            }
        }

        private canvasChanged(state: CanvasState): boolean {
            return !this.size
                || this.size.width !== state.size.width
                || this.size.height !== state.size.height
        }

        private cursorChanged(state: CursorState): boolean {
            return this.cursor !== state.cursor
        }
    }

    export const init = (el: HTMLCanvasElement) => {
        const maybeCtx = el.getContext("2d");
        if (!maybeCtx) {
            throw new Error("Couldn't get rendering context")
        }
        return new Controller(el, maybeCtx)
    }
}


namespace Utils {
    export const keys = <T extends {}>(record: T) => Object.keys(record) as Array<keyof T>;

    export const fromResize = (() => {
        const subject = new Subject<ResizeObserverEntry[]>();
        const observer = new ResizeObserver(subject.next.bind(subject));

        const sizeNames = {
            'border-box': 'borderBoxSize',
            'content-box': 'contentBoxSize',
            "device-pixel-content-box": 'devicePixelContentBoxSize'
        } as const;

        return (
            el: HTMLElement,
            box: ResizeObserverOptions["box"] = 'border-box'
        ) => new Observable<ResizeObserverSize>(subscriber => {

            observer.observe(el, { box });
            const subscription = subject.subscribe(entries => {
                const entry = entries.find(entry => entry.target === el);
                if (entry) subscriber.next(entry[sizeNames[box]][0])
            });

            return () => {
                observer.unobserve(el);
                subscription.unsubscribe();
            };
        });
    })()
}


namespace Theme {
    const theme = {
        main: '',
        text1: '',
        text2: '',
        line: '',
        bg1: '',
        bg2: '',
        bg3: '',
        bg4: ''
    }

    let initialized = false

    export const get = () => {
        if (initialized) return theme

        const styles = getComputedStyle(document.body)
        Utils.keys(theme).forEach(key => {
            theme[key] = styles.getPropertyValue('--' + key)
        })
        return theme
    }
}

// ================================================

namespace Model {
    const theme = Theme.get()

    const initialGridSate: GridLayer.State = {
        background: theme.bg2,
        majorColor: theme.line,
        minorColor: theme.bg4,
        cellSize: 360,
        subCells: 3,
        cursor: 'default',
        shift: {
            x: 0,
            y: 0,
        },
        size: {
            width: window.innerWidth,
            height: window.innerHeight,
        }
    }

    const grabbed = createAction('[grid] grabbed')
    const dropped = createAction('[grid] dropped')
    const resized = createAction('[grid] resized', (size: GridLayer.Size) => ({
        payload: size
    }))
    const shifted = createAction('[grid] shifted', (shift: GridLayer.Shift) => ({
        payload: shift
    }))

    const gridReducer = createReducer(initialGridSate, ({ addCase }) => {
        addCase(resized, (state, { payload }) => {
            state.size.width = payload.width
            state.size.height = payload.height
        })
        addCase(dropped, (state) => {
            state.cursor = 'default'
        })
        addCase(grabbed, (state) => {
            state.cursor = 'grabbing'
        })
        addCase(shifted, (state, { payload }) => {
            state.shift.x += payload.x
            state.shift.y += payload.y
        })
    })

    const store = configureStore({
        reducer: combineReducers({
            grid: gridReducer,
        }),
    })

    export const commit = bindActionCreators({
        resized,
        grabbed,
        dropped,
        shifted,
    }, store.dispatch)

    export const stream = from(store)
}

const canvas = document.querySelector('canvas')!
const parent = document.body

const mouseDown$ = fromEvent<MouseEvent>(canvas, "mousedown").pipe(
    filter(e => e.button === 1),
    tap(e => e.preventDefault())
);
const mouseUp$ = fromEvent<MouseEvent>(canvas, "mouseup").pipe(
    filter(e => e.button === 1),
    tap(e => e.preventDefault())
);

const dragScroll$: Observable<GridLayer.Shift> = mouseDown$.pipe(
    switchMap(() =>
        fromEvent<MouseEvent>(canvas, "mousemove").pipe(takeUntil(mouseUp$))
    ),
    map(e => ({
        x: e.movementX,
        y: e.movementY,
    }))
);

const wheelScroll$: Observable<GridLayer.Shift> = fromEvent<WheelEvent>(canvas, 'wheel').pipe(
    filter(e => !e.ctrlKey && !e.altKey),
    map(e => e.shiftKey ? ({
        x: -e.deltaY,
        y: -e.deltaX,
    }) : ({
        x: -e.deltaX,
        y: -e.deltaY,
    }))
)

const movement$ = merge(wheelScroll$, dragScroll$)

const resize$ = Utils.fromResize(parent, 'border-box').pipe(
    throttleTime(300, undefined, { trailing: true, leading: true }),
    map(size => ({
        height: size.blockSize,
        width: size.inlineSize,
    }))
)

movement$.subscribe(by => {
    Model.commit.shifted(by)
});
resize$.subscribe(size => {
    Model.commit.resized(size)
});
mouseDown$.subscribe(() => {
    Model.commit.grabbed()
});
mouseUp$.subscribe(() => {
    Model.commit.dropped()
});


// Main:

const grid = GridLayer.init(document.querySelector('canvas')!)

Model.stream.pipe(
    map(s => s.grid)
).subscribe(state => {
    grid.update(state)
})
