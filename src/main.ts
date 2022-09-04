import { combineReducers, configureStore, createAction, createReducer } from '@reduxjs/toolkit';
import { from, fromEvent, map, switchMap, takeUntil, throttleTime } from "rxjs";

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
            return !this.size || this.size.width !== state.size.width || this.size.height !== state.size.height
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
    export const keys = <T extends {}>(record: T) => Object.keys(record) as Array<keyof T>
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

    export const init = () => {
        const styles = getComputedStyle(document.body)
        Utils.keys(theme).forEach(key => {
            theme[key] = styles.getPropertyValue('--' + key)
        })
        return theme
    }
}

// ================================================

const theme = Theme.init()

const grid = GridLayer.init(document.querySelector('canvas')!)

const initialGridSate: GridLayer.State = {
    background: theme.bg2,
    majorColor: theme.line,
    minorColor: theme.bg4,
    cellSize: 360,
    subCells: 3,
    cursor: 'grab',
    shift: {
        x: 0,
        y: 0,
    },
    size: {
        width: window.innerWidth,
        height: window.innerHeight,
    }
}

const resized = createAction('[grid] resized')
const grabbed = createAction('[grid] grabbed')
const dropped = createAction('[grid] dropped')
const shifted = createAction('[grid] shifted', (shift: GridLayer.Shift) => ({
    payload: shift
}))


const gridReducer = createReducer(initialGridSate, ({ addCase }) => {
    addCase(resized, (state) => {
        state.size.width = window.innerWidth
        state.size.height = window.innerHeight
    })
    addCase(dropped, (state) => {
        state.cursor = 'grab'
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

const store$ = from(store)

const anchor = document.querySelector<HTMLDivElement>('.GraphNodesAnchor')!

store$.pipe(
    map(s => s.grid)
).subscribe(state => {
    grid.update(state)
    anchor.style.transform = `translate(${state.shift.x}px, ${state.shift.y}px)`
})

const mouseDown$ = fromEvent(window, "mousedown");
mouseDown$.subscribe(() => {
    store.dispatch(grabbed())
});

const mouseUp$ = fromEvent(window, "mouseup");
mouseUp$.subscribe(() => {
    store.dispatch(dropped())
});

mouseDown$
    .pipe(
        switchMap(() =>
            fromEvent<MouseEvent>(window, "mousemove").pipe(takeUntil(mouseUp$))
        ),
        map(event => ({
            x: event.movementX,
            y: event.movementY,
        }))
    )
    .subscribe(by => {
        store.dispatch(shifted(by))
    });

fromEvent(window, "resize").pipe(
    throttleTime(300, undefined, { trailing: true, leading: true })
).subscribe(() => {
    store.dispatch(resized())
});

document.querySelectorAll<HTMLElement>('.GraphNode').forEach((node) => {
    node.style.top = Math.floor(Math.random() * (window.innerHeight - node.scrollHeight)) + 'px'
    node.style.left = Math.floor(Math.random() * (window.innerWidth - node.scrollWidth)) + 'px'
})
