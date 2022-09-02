import 'reset.css'
import './style.css'
import { configureStore, createSlice, bindActionCreators, combineReducers } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { from, fromEvent, map, Observable, switchMap, takeUntil } from 'rxjs'

/*
======================================================
Setup
*/

const initialGridState = {
    position: {
        x: 0,
        y: 0
    },
    sample: 100,
}

type GridState = typeof initialGridState

const gridSlice = createSlice({
    name: 'grid',
    initialState: initialGridState,
    reducers: {
        moveBy(state, { payload }: PayloadAction<Position>) {
            state.position.x = (state.position.x + payload.x) % state.sample
            state.position.y = (state.position.y + payload.y) % state.sample
        },
    },
})

const store = configureStore({
    reducer: combineReducers({
        grid: gridSlice.reducer,
    })
})

export const commit = bindActionCreators({
    ...gridSlice.actions,
}, store.dispatch)

export const store$ = from(store)

type Position = Record<'x' | 'y', number>

type Size = Record<'width' | 'height', number>

class GridCanvas {
    constructor(
        private readonly el: HTMLCanvasElement
    ) {
        this.ctx = el.getContext("2d")!;

        const mouseDown$ = fromEvent(this.el, "mousedown");
        mouseDown$.subscribe(() => {
            this.setCursor('grabbing')
        })

        const mouseUp$ = fromEvent(this.el, "mouseup");
        mouseUp$.subscribe(() => {
            this.setCursor('grab')
        })

        this.movement$ = mouseDown$.pipe(
            switchMap(() =>
                fromEvent<MouseEvent>(this.el, "mousemove").pipe(
                    takeUntil(mouseUp$)
                )
            ),
            map(e => ({ x: e.movementX, y: e.movementY }))
        );
    }

    public readonly movement$: Observable<{ x: number; y: number }>;

    public paintGrid(grid: GridState): void {
        const { ctx, el } = this;

        ctx.fillStyle = "#fff";
        ctx.clearRect(0, 0, el.width, el.height);

        ctx.beginPath();
        ctx.strokeStyle = "black";
        let { x, y } = grid.position;
        while (x < el.width) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, el.height);
            x += grid.sample;
        }
        while (y < el.height) {
            ctx.moveTo(0, y);
            ctx.lineTo(el.width, y);
            y += grid.sample;
        }
        ctx.stroke();
        ctx.closePath();
    }

    public setCanvasSize({ width, height }: Size) {
        this.el.width = width;
        this.el.height = height;
    }

    public setCursor(value: 'grab' | 'grabbing') {
        this.el.style.cursor = value;
    }

    private readonly ctx: CanvasRenderingContext2D;
}

/*
======================================================
Render
*/

const gridCanvas = new GridCanvas(document.querySelector('canvas')!)

gridCanvas.movement$.subscribe(commit.moveBy);

const stretchCanvas = () => {
    gridCanvas.setCanvasSize({
        width: window.innerWidth,
        height: window.innerHeight
    })
}
stretchCanvas()
fromEvent(window, 'resize', stretchCanvas)

store$
    .pipe(map(state => state.grid))
    .subscribe(grid => {
        gridCanvas.paintGrid(grid)
    });

