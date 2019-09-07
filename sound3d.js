importScripts("dft.js");

self.impulseResponse = null;

self.addEventListener("message", (message) => {
    switch (message.data["what"]) {
        case "setImpulseResponse": {
            console.log("audioWorker: setImpulseResponse");
            self.impulseResponse = message.data["impulseResponse"];
            break;
        }
        case "calcImpulseResponse": {
            let waveform = message.data["waveform"];
            self.postMessage({
                "what": "calcImpulseResponse",
                "waveform": waveform
            }, waveform.map((buffer) => buffer.buffer));
            break;
        }
    }
});
