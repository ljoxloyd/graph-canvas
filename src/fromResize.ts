import { Observable, Subject } from "rxjs";

const sizeNames = {
    'border-box': 'borderBoxSize',
    'content-box': 'contentBoxSize',
    "device-pixel-content-box": 'devicePixelContentBoxSize'
} as const;

export const createResizeObservableFactory = () => {
    const subject = new Subject<ResizeObserverEntry[]>();
    const observer = new ResizeObserver(subject.next.bind(subject));

    return (
        el: HTMLElement,
        box: ResizeObserverOptions["box"] = 'border-box'
    ) => new Observable<ResizeObserverSize>(subscriber => {

        observer.observe(el, { box });
        const subscription = subject.subscribe(entries => {
            const entry = entries.find(entry => entry.target === el);
            if (entry)
                subscriber.next(entry[sizeNames[box]][0]);
        });

        return () => {
            observer.unobserve(el);
            subscription.unsubscribe();
        };
    });
}

export const fromResize = createResizeObservableFactory()
