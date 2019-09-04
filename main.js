
(function() {

    "use strict";

    // ======== UI ========

    let audioPlayButton = null;

    function onLoad(event) {
        console.log("onLoad");

        // ui
        audioPlayButton = document.getElementById("playButton");
        audioPlayButton.addEventListener("click", onClickPlayButton);
    }

    function onUnload(event) {
        console.log("onUnload");

        // audio
        terminateAudio();

        // ui
        removeEventListener("click", onClickPlayButton);

        // window
        removeEventListener("load", onLoad);
        removeEventListener("unload", onUnload);
        removeEventListener("focus", onResume);
        removeEventListener("blur", onSuspend);
    }

    function onSuspend(event) {
        console.log("onSuspend");
        suspendAudio();
    }

    function onResume(event) {
        console.log("onResume");
        resumeAudio();
    }

    function onClickPlayButton(event) {
        console.log("onClickPlayButton");
        initializeAudio();
        playAudio();
    }

    addEventListener("load", onLoad);
    addEventListener("unload", onUnload);
    addEventListener("focus", onResume);
    addEventListener("blur", onSuspend);

    // ======== Audio ========

    let audioContext = null;
    let audioElement = null;
    let audioSource = null;
    let scriptProcessor = null;

    let impulseResponseSpectrum = new Float32Array(2 ** 18);

    let audioPlaybackWhenResumed = false;

    function initializeAudio() {
        console.log("initializeAudio");
        if (isInitializeAudio()) {
            return;
        }

        // AudioContext
        audioContext = new (AudioContext || webkitAudioContext)();

        // audio
        audioElement = new Audio();
        audioElement.loop = true;
        audioElement.src = "sound.mp3";

        // audio source
        audioSource = audioContext.createMediaElementSource(audioElement);
        audioSource.connect(audioContext.destination);

        // script processor
        scriptProcessor = audioContext.createScriptProcessor(4096, 2, 2);

        //
        let request = new XMLHttpRequest();
        request.open("GET", "impulse_response/Narrow Bumpy Space.wav");
        request.responseType = "arraybuffer";
        request.onreadystatechange = function() {
            if (request.readyState == XMLHttpRequest.DONE) {
                if (request.status == 200) {

                }
            }
        };
        request.send();
    }

    function terminateAudio() {
        console.log("terminateAudio");
        if (!isInitializeAudio()) {
            return;
        }
        audioContext.close();
        audioContext = null;
    }

    function isInitializeAudio() {
        return audioContext != null;
    }

    function resumeAudio() {
        console.log("resumeAudio");
        if (!isInitializeAudio()) {
            return;
        }
        if (audioPlaybackWhenResumed) {
            audioPlaybackWhenResumed = false;
            playAudio();
        }
    }

    function suspendAudio() {
        console.log("suspendAudio");
        if (!isInitializeAudio()) {
            return;
        }
        audioPlaybackWhenResumed = isPlayAudio();
        stopAudio();
    }

    function playAudio() {
        console.log("playAudio");
        if (!isInitializeAudio()) {
            return;
        }
        audioElement.play();
    }

    function stopAudio() {
        console.log("stopAudio");
        if (!isInitializeAudio()) {
            return;
        }
        audioElement.pause();
    }

    function isPlayAudio() {
        if (!isInitializeAudio()) {
            return false;
        }
        return !audioElement.paused;
    }

    function setImpulseResponse(data) {
        audioContext.decodeAudioData(data)
            .then((audioBuffer) => {

            });
    }

})();

function test() {
    let a = [ 1, 0, 2, 0, 5, 0, 4, 0, 1, 0, 8, 0, 10, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];
    let b = [ 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];
    console.log(a);
    console.log(b);
    DFT.fftHighSpeed(16, a);
    DFT.fftHighSpeed(16, b);
    for (let i = 0; i < a.length / 2; ++i) {
        let j = i << 1;
        let ar = a[j + 0];
        let ai = a[j + 1];
        let br = b[j + 0];
        let bi = b[j + 1];
        a[j + 0] = ar * br - ai * bi;
        a[j + 1] = ar * bi + ai * br;
    }
    DFT.fftHighSpeed(16, a, true);
    console.log(a.map((v) => { return Math.round(v * 10000) / 10000; }));

    let c = new Float32Array(2 ** 18);
    let start = new Date();
    for (let i = 0; i < 100; ++i) {
        DFT.fftHighSpeed(c.length / 2, c);
    }
    console.log(new Date().getTime() - start.getTime());
}
