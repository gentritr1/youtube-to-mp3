export class AudioStub {
    src = '';
    currentTime = 0;
    duration = 30;
    paused = true;
    volume = 1;
    preload = '';
    
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
    addEventListener() {}
    removeEventListener() {}
    removeAttribute() {}
}
