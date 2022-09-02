import 'reset.css'
import './style.css'
import { configureStore, createSlice, bindActionCreators, combineReducers } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { from, fromEvent, map, switchMap, takeUntil } from 'rxjs'

/*
======================================================
Setup
*/

const main = document.querySelector('main')!

const initialGridState = {
    position: { x: 0, y: 0 },
    moving: false
}

type GridState = typeof initialGridState

const gridSlice = createSlice({
    name: 'grid',
    initialState: initialGridState,
    reducers: {
        moveBy(state, { payload }: PayloadAction<GridState['position']>) {
            state.position.x = (state.position.x + payload.x) % 64
            state.position.y = (state.position.y + payload.y) % 64
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
        main.style.backgroundPosition = `${pos.x}px ${pos.y}px`
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
    main.style.cursor = is ? 'grabbing' : 'grab'
})

store$
    .pipe(map(state => state.grid.position))
    .subscribe(Effect.updateGridPosition);
