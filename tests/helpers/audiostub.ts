export class AudioStub {
    src = '';
    currentTime = 0;
    duration = 30;
    paused = true;
    ended = false;
    volume = 1;
    preload = '';
    loadCalls = 0;
    removedAttributes: string[] = [];
    listeners = new Map<string, Set<(event?: Event) => void>>();

    constructor(src = '') {
        this.src = src;
    }

    play() {
        this.paused = false;
        return Promise.resolve();
    }

    pause() {
        this.paused = true;
    }

    load() {
        this.loadCalls += 1;
    }

    addEventListener(type: string, handler: (event?: Event) => void) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type)?.add(handler);
    }

    removeEventListener(type: string, handler: (event?: Event) => void) {
        this.listeners.get(type)?.delete(handler);
    }

    removeAttribute(name: string) {
        this.removedAttributes.push(name);
        if (name === 'src') {
            this.src = '';
        }
    }

    emit(type: string, event?: Event) {
        this.listeners.get(type)?.forEach((handler) => {
            handler(event);
        });
    }
}
