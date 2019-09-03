
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

})();