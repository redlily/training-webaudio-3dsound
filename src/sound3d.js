importScripts("dft.js");

// 入力サンプルのチャネル数
self.channelCount = 0;
// 入力サンプルのブロックサイズ
self.sampleBlockSize = 0;

// インパルス応答のチャネル数
self.impulseResponseChannelCount = 0;
// インパルス応答のサンプル数
self.impulseResponseSampleSize = 0;
// インパルス応答の複素数バッファ
self.impulseResponses = null;

// 波形保管用の一時複素数バッファ
self.templateBuffers = null;
// 畳み込み演算用の複素数バッファ
self.workBuffers = null;
// 複素数バッファの書き込み開始位置
self.bufferPosition = 0;

// 処理の有効性を設定
self.enabled = true;

self.addEventListener("message", (message) => {
    switch (message.data["what"]) {
        // 初期化
        case "initialize": {
            self.channelCount = message.data["channelCount"]; // 処理するサンプルのチャネル数
            self.sampleBlockSize = message.data["sampleBlockSize"]; // 一度に処理するサンプルのブロックサイズ

            console.log(`audioWorker: initialize, ${self.channelCount}, ${self.sampleBlockSize}`);
            console.assert(self.channelCount > 0);
            console.assert(self.sampleBlockSize > 0);
            console.assert(self.sampleBlockSize == nextPowOf2(self.sampleBlockSize));
            break;
        }
        // インパルス応答の処理を有効にするか否かを設定
        case "setEnable": {
            self.enabled = message.data["enabled"]; // 有効か否か
            console.log(`setEnabled ${self.enabled}`);
            break;
        }
        // インパルス応答を設定
        case "setImpulseResponses": {
            let impulseResponses = message.data["impulseResponses"]; // インパルス応答

            console.log(
                `audioWorker: setImpulseResponses,`+
                `${impulseResponses.map((v) => " " + (Math.round(v.length / 480) / 100).toString())}`);
            console.assert(impulseResponses.length > 0);
            console.assert(impulseResponses.every((value => value.length == impulseResponses[0].length)));

            // インパルス応答関連の変数の初期化する
            self.impulseResponseChannelCount = impulseResponses.length;
            self.impulseResponseSampleSize = Math.max(nextPowOf2(impulseResponses[0].length), self.sampleBlockSize) << 1; // インパルス応答のデータの2倍程度のバッファサイズにする
            self.impulseResponses = new Array(self.impulseResponseChannelCount);
            for (let i = 0; i < self.impulseResponseChannelCount; ++i) {
                let src = impulseResponses[i];
                let srcNorm = Math.sqrt(src.reduce((acc, value) => acc + value ** 2)); // 反響音過多による音割れ防止のためインパルス応答の正規化を行うためのインパルス応答ベクトルのノルムを求めておく
                let dst = new Float32Array(self.impulseResponseSampleSize << 1); // インパルス応答のコピー先は離散フーリエ変換による畳込み演算を行うので複素数演算用の複素数配列を用意する
                for (let j = 0; j < src.length; ++j) {
                    let re = (j << 1);
                    let im = (j << 1) + 1;
                    dst[re] = src[j] / srcNorm / 2; // インパルス応答を正規化を行いながら複素数配列に複製していく
                    dst[im] = 0;
                }
                DFT.fftHighSpeed(self.impulseResponseSampleSize, dst); // 畳み込み演算のためにインパルス応答の周波数特性を離散フーリエ変換を用いて求めておく
                self.impulseResponses[i] = dst;
            }
            console.log(`impulseResponses's buffer size: 2^${Math.log2(self.impulseResponseSampleSize)}`);

            // 作業用バッファ関連の変数の初期化する
            self.workBuffers = new Array(self.channelCount);
            self.templateBuffers = new Array(self.channelCount);
            for (let i = 0; i < self.channelCount; ++i) {
                self.templateBuffers[i] = new Float32Array(self.impulseResponseSampleSize << 1);
                self.workBuffers[i] = new Float32Array(self.impulseResponseSampleSize << 1);
            }
            self.bufferPosition = 0;
            break;
        }
        // インパルス応答を計算
        case "calcImpulseResponses": {
            let waveformBuffers = message.data["inputBuffers"]; // 入力波形

            console.assert(waveformBuffers.length == self.channelCount);
            console.assert(waveformBuffers.every((value => value.length == self.sampleBlockSize)));

            // 波形データを一時バッファにコピーする
            let bufferOffset = self.bufferPosition << 1;
            for (let i = 0; i < waveformBuffers.length; ++i) {
                let src = waveformBuffers[i];
                let dst = self.templateBuffers[i];

                // 書き込み位置から一時バッファの前方半分の内容を消す
                dst.fill(0, bufferOffset, Math.min(bufferOffset + self.impulseResponseSampleSize, dst.length));
                dst.fill(0, 0, Math.max(bufferOffset + self.impulseResponseSampleSize - dst, 0));

                // 波形データを実数から複素数に変換しながらバッファにコピーする
                for (let j = 0; j < self.sampleBlockSize; ++j) {
                    dst[bufferOffset + (j << 1)] = src[j];
                }
            }

            if (self.enabled) {
                // 高速フーリエ変換を用いて畳み込み演算を行う
                for (let i = 0; i < self.channelCount; ++i) {
                    let ir = self.impulseResponses[i % self.impulseResponses.length];
                    let src = self.templateBuffers[i];
                    let wb = self.workBuffers[i];
                    wb.set(src);

                    // 畳み込み演算
                    DFT.fftHighSpeed(self.impulseResponseSampleSize, wb);
                    for (let j = 0; j < self.impulseResponseSampleSize; ++j) {
                        let re = (j << 1);
                        let im = (j << 1) + 1;
                        let ar = ir[re];
                        let ai = ir[im];
                        let br = wb[re];
                        let bi = wb[im];
                        wb[re] = ar * br - ai * bi;
                        wb[im] = ar * bi + ai * br;
                    }
                    DFT.fftHighSpeed(self.impulseResponseSampleSize, wb, true);

                    // 畳み込み演算の結果を入力元に戻す
                    let dst = waveformBuffers[i];
                    for (let j = 0; j < self.sampleBlockSize; ++j) {
                        dst[j] = wb[bufferOffset + (j << 1)];
                    }
                }
            }
            self.bufferPosition = (self.bufferPosition + self.sampleBlockSize) % self.impulseResponseSampleSize;

            // メインスレッドに計算結果を送信する
            self.postMessage({
                "what": "calcImpulseResponses",
                "outputBuffers": waveformBuffers
            }, waveformBuffers.map((buffer) => buffer.buffer));
            break;
        }
    }
});

// 引数の値以上の2のべき乗の値を求める
function nextPowOf2(value) {
    value--;
    value |= value >>> 1;
    value |= value >>> 2;
    value |= value >>> 4;
    value |= value >>> 8;
    value |= value >>> 16;
    return value + 1;
}
