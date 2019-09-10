importScripts("dft.js");

self.channelCount = 0;
self.sampleBlockSize = 0;
self.impulseResponseChannelCount = 0;
self.impulseResponseSampleSize = 0;
self.impulseResponses = null;
self.workBuffers = null;
self.outputBuffers = null;
self.bufferPosition = 0;

self.addEventListener("message", (message) => {
    switch (message.data["what"]) {
        case "initialize": { // 初期化
            console.log("audioWorker: initialize");
            self.channelCount = message.data["channelCount"]; // チャネル数
            self.sampleBlockSize = message.data["sampleBlockSize"]; // 一度に処理するサンプル・ブロック・サイズ
            console.assert(self.channelCount > 0);
            console.assert(self.sampleBlockSize > 0);
            break;
        }
        case "setImpulseResponses": { // インパルス応答を設定
            console.log("audioWorker: setImpulseResponses");
            let impulseResponses = message.data["impulseResponses"]; // インパルス応答
            console.assert(impulseResponses.length > 0);

            // ステータスの初期化
            self.impulseResponseChannelCount = impulseResponses.length;
            self.impulseResponseSampleSize = Math.max(impulseResponses[0].length, self.sampleBlockSize) << 1;
            self.impulseResponses = new Array(self.impulseResponseChannelCount);
            let bufferSize = nextPowerOf2(self.impulseResponseSampleSize) << 1;
            for (let i = 0; i < self.impulseResponseChannelCount; ++i) {
                let from = impulseResponses[i];
                let to = new Float32Array(bufferSize);
                to.set(from);
                self.impulseResponses[i] = to;
            }
            self.workBuffers = new Array(self.channelCount);
            self.outputBuffers = new Array(self.channelCount);
            for (let i = 0; i < self.channelCount; ++i) {
                self.workBuffers[i] = new Float32Array(bufferSize);
                self.outputBuffers[i] = new Float32Array(bufferSize);
            }
            self.bufferPosition = 0;
            break;
        }
        case "calcImpulseResponses": { // インパルス応答を計算する
            let inputBuffers = message.data["inputBuffers"]; // 入力波形
            console.assert(inputBuffers.length == self.channelCount);
            console.assert(inputBuffers[0].length == self.sampleBlockSize);

            // 波形データを作業バッファにコピー
            for (let i = 0; i < inputBuffers.length; ++i) {
                let inputBuffer = inputBuffers[i];
                let workBuffer = self.workBuffers[i];
                workBuffer.fill(0);
                for (let j = 0; j < self.sampleBlockSize; ++j) {
                    let re = (j << 1);
                    let im = (j << 1) + 1;
                    workBuffer[re] = inputBuffer[re];
                    workBuffer[im] = 0;
                }
            }

            // 離散フーリエ変換を応用して畳み込み演算
            for (let i = 0; i < self.channelCount; ++i) {
                let impulseResponse = self.impulseResponses[i];
                let workBuffer = self.workBuffers[i];
                DFT.fftHighSpeed(self.impulseResponseSampleSize, self.workBuffers[i]);
                for (let j = 0; j < self.impulseResponseSampleSize; ++j) {
                    let re = (j << 1);
                    let im = (j << 1) + 1;
                }
                DFT.fftHighSpeed(self.impulseResponseSampleSize, self.workBuffers[i], true);
            }

            self.postMessage({
                "what": "calcImpulseResponses",
                "outputBuffers": inputBuffers
            }, inputBuffers.map((buffer) => buffer.buffer));
            break;
        }
    }
});

// 2のべき乗の値に繰り上げる
function nextPowerOf2(value) {
    value--;
    value |= value >>> 1;
    value |= value >>> 2;
    value |= value >>> 4;
    value |= value >>> 8;
    value |= value >>> 16;
    return value + 1;
}
