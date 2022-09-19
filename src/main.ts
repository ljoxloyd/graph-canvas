import {
    bindActionCreators,
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
    throttleTime,
} from "rxjs";
import { fromResize } from './fromResize';

class Shift {
    constructor(
        public x: number = 0,
        public y: number = 0,
    ) { }
}

type Ctx = CanvasRenderingContext2D

namespace Utils {
    export const keys = <T extends {}>(record: T) => Object.keys(record) as Array<keyof T>;
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
    };

    let initialized = false;

    export const get = () => {
        if (initialized)
            return theme;

        const styles = getComputedStyle(document.body);
        Utils.keys(theme).forEach(key => {
            theme[key] = styles.getPropertyValue('--' + key);
        });
        return theme;
    };
}

namespace Model {
    const theme = Theme.get()

    const initialState = {
        background: theme.bg2,
        majorColor: theme.line,
        minorColor: theme.bg4,
        cellSize: 360,
        subCells: 3,
        shift: { x: 0, y: 0 },
    }

    export type State = typeof initialState

    const shifted = createAction('[grid] shifted', (shift: Shift) => ({
        payload: shift
    }))

    const reducer = createReducer(initialState, ({ addCase }) => {
        addCase(shifted, (state, { payload }) => {
            state.shift.x += payload.x
            state.shift.y += payload.y
        })
    })

    const store = configureStore({
        reducer,
        middleware: []
    })

    export const commit = bindActionCreators({
        shifted,
    }, store.dispatch)

    export const stream = from(store)
}

type SurfaceProps = {
    color: string,
}

function Surface(ctx: Ctx, { color }: SurfaceProps) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

type MeshProps = {
    step: number;
    shift: Shift;
    color: string
};

function Mesh(ctx: Ctx, { step: step, shift, color }: MeshProps) {
    const { width, height } = ctx.canvas
    let x = width + shift.x % step
    let y = height + shift.y % step

    ctx.strokeStyle = color
    ctx.beginPath()
    while (x > 0) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        x -= step;
    }
    while (y > 0) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        y -= step;
    }
    ctx.stroke()
}

function Layer(ctx: Ctx, model: Model.State) {
    Surface(ctx, {
        color: model.background
    })
    Mesh(ctx, {
        step: model.cellSize,
        shift: model.shift,
        color: model.majorColor
    })
    Mesh(ctx, {
        step: model.cellSize / model.subCells,
        shift: model.shift,
        color: model.minorColor
    })
}

// ================================================
// Main:

const canvas = document.querySelector('canvas')!
const context = canvas.getContext('2d')!
const parent = document.body

const mouseDown$ = fromEvent<MouseEvent>(canvas, "mousedown").pipe(
    filter(e => e.button === 1),
    tap(e => e.preventDefault())
);
const mouseUp$ = fromEvent<MouseEvent>(canvas, "mouseup").pipe(
    filter(e => e.button === 1),
    tap(e => e.preventDefault())
);

const dragScroll$: Observable<Shift> = mouseDown$.pipe(
    switchMap(() =>
        fromEvent<MouseEvent>(canvas, "mousemove").pipe(takeUntil(mouseUp$))
    ),
    map(e => ({
        x: e.movementX,
        y: e.movementY,
    }))
);

const wheelScroll$: Observable<Shift> = fromEvent<WheelEvent>(canvas, 'wheel').pipe(
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

const resize$ = fromResize(parent, 'border-box').pipe(
    // startWith({ inlineSize: window.innerWidth, blockSize: window.innerHeight }),
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
    Object.assign(canvas, size)
    Model.commit.shifted({ x: 0, y: 0 })
});
mouseDown$.subscribe(() => {
    canvas.style.cursor = 'grabbing'
});
mouseUp$.subscribe(() => {
    canvas.style.cursor = 'default'
});

Model.stream.subscribe(state => {
    Layer(context, state)
})
