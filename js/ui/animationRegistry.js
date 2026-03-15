export const animationRegistry = {
    conversionProgress: [
        {
            name: 'vinyl',
            label: 'Spinning vinyl...',
            html: `<div class="anim-vinyl">
                <div class="vinyl-record"></div>
                <div class="vinyl-label"></div>
                <div class="vinyl-arm"></div>
            </div>`
        },
        {
            name: 'cassette',
            label: 'Loading tape...',
            html: `<div class="anim-cassette">
                <div class="cassette-label"></div>
                <div class="cassette-reel reel-left"></div>
                <div class="cassette-reel reel-right"></div>
                <div class="cassette-window">
                    <div class="cassette-tape"></div>
                </div>
            </div>`
        },
        {
            name: 'equalizer',
            label: 'Mixing audio...',
            html: `<div class="anim-equalizer">
                <div class="eq-bar"></div>
                <div class="eq-bar"></div>
                <div class="eq-bar"></div>
                <div class="eq-bar"></div>
                <div class="eq-bar"></div>
                <div class="eq-bar"></div>
                <div class="eq-bar"></div>
            </div>`
        },
        {
            name: 'waveform',
            label: 'Drawing waveform...',
            html: `<div class="anim-waveform">
                <svg class="waveform-svg" viewBox="0 0 140 60" aria-hidden="true" focusable="false">
                    <path class="waveform-line-bg" d="M5,30 Q15,10 25,30 T45,30 T65,30 T85,30 T105,30 T125,30 T135,30" />
                    <path class="waveform-glow" d="M5,30 Q15,10 25,30 T45,30 T65,30 T85,30 T105,30 T125,30 T135,30" />
                    <path class="waveform-line" d="M5,30 Q15,10 25,30 T45,30 T65,30 T85,30 T105,30 T125,30 T135,30" />
                </svg>
            </div>`
        }
    ]
};
