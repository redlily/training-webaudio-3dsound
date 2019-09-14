(function () {

    "use strict";

    // ======== UI ========

    let audioFileSelector = null;
    let audioIrSelector = null;
    let audioIrEnableCheck = null;
    let audioPlayButton = null;

    function onLoad(event) {
        console.log("onLoad");

        // ui
        audioFileSelector = document.getElementById("fileSelector");
        audioFileSelector.addEventListener("change", onFileSelected);
        audioIrSelector = document.getElementById("irSelector");
        audioIrSelector.addEventListener("change", onIrSelected);
        audioIrEnableCheck = document.getElementById("irEnabled");
        audioIrEnableCheck.addEventListener("change", onChangeIrEnabled);
        audioPlayButton = document.getElementById("playButton");
        audioPlayButton.addEventListener("click", onClickPlayButton);
    }

    function onUnload(event) {
        console.log("onUnload");

        // audio
        terminateAudio();

        // ui
        audioFileSelector.removeEventListener("change", onFileSelected);
        audioIrEnableCheck.removeEventListener("change", onChangeIrEnabled);
        audioPlayButton.removeEventListener("click", onClickPlayButton);

        // window
        removeEventListener("load", onLoad);
        removeEventListener("unload", onUnload);
        removeEventListener("focus", onResume);
        removeEventListener("blur", onSuspend);
    }

    function onSuspend(event) {
        console.log("onSuspend");
        // suspendAudio();
    }

    function onResume(event) {
        console.log("onResume");
        // resumeAudio();
    }

    function onFileSelected(event) {
        console.log("onFileSelected");
        setAudioUrl(URL.createObjectURL(event.target.files[0]));
    }

    function onIrSelected(event) {
        console.log("onChangeIrEnabled");
        setImpulseResponseUrl(event.target.value);
    }

    function onChangeIrEnabled(event) {
        console.log("onChangeIrEnabled");
        setImpulseResponseEnabled(event.target.checked);
    }

    function onClickPlayButton(event) {
        console.log("onClickPlayButton");
        initializeAudio();
        if (!isPlayAudio()) {
            playAudio();
        } else {
            stopAudio();
        }
    }

    addEventListener("load", onLoad);
    addEventListener("unload", onUnload);
    addEventListener("focus", onResume);
    addEventListener("blur", onSuspend);

    // ======== Audio ========

    const AUDIO_CHANNEL_COUNT = 2;
    const AUDIO_BUFFER_SIZE = 2 ** 14;

    let audioUrl = "../assets/bgm/default.mp3";
    let impulseResponseUrl = "../assets/ir/Bottle Hall.wav";

    let audioContext = null;
    let audioElement = null;
    let audioSource = null;
    let scriptProcessor = null;

    let audioWorker = null;
    let audioInputBuffers = null;
    let audioOutputBuffers = null;
    let audioIrEnabled = true;

    let audioPlaybackWhenResumed = false;

    function initializeAudio() {
        console.log("initializeAudio");
        if (isInitializeAudio()) {
            return;
        }

        // worklet
        audioWorker = new Worker("sound3d.js");
        audioWorker.addEventListener('message', onAudioWorkerMessage);
        audioWorker.postMessage({
            "what": "initialize",
            "channelCount": AUDIO_CHANNEL_COUNT,
            "sampleBlockSize": AUDIO_BUFFER_SIZE
        });
        audioInputBuffers = new Array(AUDIO_CHANNEL_COUNT);
        for (let i = 0; i < audioInputBuffers.length; ++i) {
            audioInputBuffers[i] = new Float32Array(AUDIO_BUFFER_SIZE);
        }
        setImpulseResponseEnabled(audioIrEnabled);

        // AudioContext
        audioContext = new (AudioContext || webkitAudioContext)();

        // script processor
        scriptProcessor = audioContext.createScriptProcessor(
            AUDIO_BUFFER_SIZE, AUDIO_CHANNEL_COUNT, AUDIO_CHANNEL_COUNT);
        scriptProcessor.addEventListener("audioprocess", onAudioProcess);
        scriptProcessor.connect(audioContext.destination);

        // audio
        audioElement = new Audio();
        audioElement.loop = true;
        audioElement.src = audioUrl;

        // audio source
        audioSource = audioContext.createMediaElementSource(audioElement);
        audioSource.connect(scriptProcessor);

        // デフォルトのインパルス応答を設定
        setImpulseResponseUrl(impulseResponseUrl);
    }

    // オーディオの終了処理
    function terminateAudio() {
        console.log("terminateAudio");
        if (!isInitializeAudio()) {
            return;
        }
        if (isPlayAudio()) {
            stopAudio();
        }
        audioWorker.removeEventListener("message", onAudioWorkerMessage);
        audioWorker.terminate();
        audioWorker = null;
        audioContext.close();
        audioContext = null;
    }

    // オーディオは初期化されているか
    function isInitializeAudio() {
        return audioContext != null;
    }

    // オーディオのレジューム処理
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

    // オーディオのサスペンド処理
    function suspendAudio() {
        console.log("suspendAudio");
        if (!isInitializeAudio()) {
            return;
        }
        audioPlaybackWhenResumed = isPlayAudio();
        stopAudio();
    }

    // オーディオの再生を開始する
    function playAudio() {
        console.log("playAudio");
        if (!isInitializeAudio()) {
            return;
        }
        audioElement.play();
    }

    // オーディオの再生を停止する
    function stopAudio() {
        console.log("stopAudio");
        if (!isInitializeAudio()) {
            return;
        }
        audioElement.pause();
    }

    // オーディオは再生中か
    function isPlayAudio() {
        if (!isInitializeAudio()) {
            return false;
        }
        return !audioElement.paused;
    }

    // インパルス応答を有効にするか否かを設定する
    function setImpulseResponseEnabled(enabled) {
        audioIrEnabled = enabled;
        if (isInitializeAudio()) {
            audioWorker.postMessage({
                "what": "setEnable",
                "enabled": enabled
            });
        }
    }

    // インパルス応答が収納されたファイルのURLを設定する
    function setImpulseResponseUrl(url) {
        impulseResponseUrl = url;
        if (isInitializeAudio()) {
            let request = new XMLHttpRequest();
            request.open("GET", url);
            request.responseType = "arraybuffer";
            request.onreadystatechange = function () {
                if (request.readyState == XMLHttpRequest.DONE) {
                    if (request.status == 200) {
                        setImpulseResponseData(request.response);
                    }
                }
            };
            request.send();
        }
    }

    // インパルス応答が収納された音声ファイルのデータを設定する
    function setImpulseResponseData(data) {
        audioContext.decodeAudioData(data)
            .then((audioBuffer) => {
                let impulseResponses = new Array(audioBuffer.numberOfChannels);
                for (let i = 0; i < impulseResponses.length; ++i) {
                    impulseResponses[i] = audioBuffer.getChannelData(i);
                }
                audioWorker.postMessage({
                    "what": "setImpulseResponses",
                    "impulseResponses": impulseResponses
                }, impulseResponses.map((buffer) => buffer.buffer));
            });
    }

    // 再生する音声データを設定する
    function setAudioUrl(url) {
        audioUrl = url;
        if (isInitializeAudio()) {
            audioElement.src = url;
        }
    }

    // ScriptProcessorの波形処理
    function onAudioProcess(event) {
        // オーディオ・スレッドで処理した波形データを出力先にコピー
        if (audioOutputBuffers != null) {
            for (let i = 0; i < event.outputBuffer.numberOfChannels; ++i) {
                event.outputBuffer.getChannelData(i).set(audioOutputBuffers[i]);
            }
            audioInputBuffers = audioOutputBuffers;
            audioOutputBuffers = null;
        } else {
            for (let i = 0; i < event.outputBuffer.numberOfChannels; ++i) {
                event.outputBuffer.getChannelData(i).fill(0);
            }
        }

        // オーディオ・スレッドに入力波形データを転送
        if (audioInputBuffers != null) {
            for (let i = 0; i < event.inputBuffer.numberOfChannels; ++i) {
                audioInputBuffers[i].set(event.inputBuffer.getChannelData(i));
            }
            audioWorker.postMessage({
                "what": "calcImpulseResponses",
                "inputBuffers": audioInputBuffers
            }, audioInputBuffers.map((buffer) => buffer.buffer));
            audioInputBuffers = null;
        }
    }

    // オーディオ・スレッドからメッセージを受信
    function onAudioWorkerMessage(message) {
        if (message.data["what"] === "calcImpulseResponses") {
            audioOutputBuffers = message.data["outputBuffers"];
        }
    }

})();
