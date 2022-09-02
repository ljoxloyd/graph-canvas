import 'reset.css'
import './style.css'
import { configureStore, createSlice, bindActionCreators, combineReducers } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { from, fromEvent, map, switchMap, takeUntil } from 'rxjs'

/*
======================================================
Setup
*/


const [canvas, ctx] = prepareToDraw(window.innerWidth, window.innerHeight)
document.body.appendChild(canvas)


const PATTERN_SIZE = 64

interface PatternOptions {
    shiftX: number
    shiftY: number
    size: number
    color?: string,
}

function createPattern({ shiftX, shiftY, size, color = 'black' }: PatternOptions) {
    const x = shiftX < 0 ? size + shiftX : shiftX
    const y = shiftY < 0 ? size + shiftY : shiftY
    const [canvas, ctx] = prepareToDraw(size)
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
    return ctx.createPattern(canvas, 'repeat')!;
}


const initialGridState = {
    position: { x: 1, y: 1 },
    moving: false
}

type GridState = typeof initialGridState

const gridSlice = createSlice({
    name: 'grid',
    initialState: initialGridState,
    reducers: {
        moteTo(state, { payload }: PayloadAction<GridState['position']>) {
            state.position = payload
        },
        moveBy(state, { payload }: PayloadAction<GridState['position']>) {
            state.position.x = (state.position.x + payload.x) % PATTERN_SIZE
            state.position.y = (state.position.y + payload.y) % PATTERN_SIZE
        },
        moving(state, { payload }: PayloadAction<boolean>) {
            state.moving = payload
        },
    },
})

const store = configureStore({
    reducer: combineReducers({
        grid: gridSlice.reducer
    })
})

export const commit = bindActionCreators({
    ...gridSlice.actions
}, store.dispatch)

export const store$ = from(store)

namespace Effect {
    export const updateGridPosition = (pos: GridState['position']): void => {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = createPattern({ shiftX: pos.x, shiftY: pos.y, size: PATTERN_SIZE });
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}


/*
======================================================
Render
*/

const mouseUp$ = fromEvent(window, "mouseup")
const mouseDown$ = fromEvent(window, "mousedown")

mouseDown$.subscribe(() => commit.moving(true))
mouseUp$.subscribe(() => commit.moving(false))

mouseDown$
    .pipe(
        switchMap(() =>
            fromEvent<MouseEvent>(window, "mousemove").pipe(takeUntil(mouseUp$))
        ),
        map(e => ({ x: e.movementX, y: e.movementY }))
    )
    .subscribe(commit.moveBy);


store$.pipe(map(state => state.grid.moving)).subscribe(is => {
    canvas.style.cursor = is ? 'grabbing' : 'grab'
})

store$
    .pipe(map(state => state.grid.position))
    .subscribe(Effect.updateGridPosition);


window.addEventListener('dblclick', () => {
    commit.moteTo({ x: 0, y: 0 })
})

/*
======================================================
Utils
*/

function prepareToDraw(width: number, height: number = width) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    return [canvas, ctx] as const
}
