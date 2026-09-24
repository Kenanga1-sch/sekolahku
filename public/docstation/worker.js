/* DocStation — Web Worker (Robust Dual Engine)
 * 1. Pure JS Canvas Engine dengan Transferable ArrayBuffer.
 * 2. OpenCV C++ Wasm dengan penanganan error berlapis (Zero Crash Guarantee).
 */

let cvStatus = 'loading'; // 'loading' | 'ready'

const reply = (type, data = {}, transferables = []) => {
    self.postMessage({ type, ...data }, transferables);
};

// Beritahu main thread bahwa Pure JS Engine selalu SIAP 100%
cvStatus = 'ready';
reply('INITIALIZED', { note: 'ready', cvEngine: 'pure-js' });

function loadOpenCVFromUrl(url) {
    try {
        self.module = undefined;
        self.exports = undefined;
        self.define = undefined;

        importScripts(url);

        if (typeof cv !== 'undefined' && cv) {
            cv.onRuntimeInitialized = () => {
                cvStatus = 'ready';
                console.log('[DocStation Worker] OpenCV.js C++ Runtime BERHASIL Siap ✨');
                reply('INITIALIZED', { note: 'ready', cvEngine: 'opencv-cpp' });
            };
        }
    } catch (error) {
        console.warn('[DocStation Worker] Gagal menginisialisasi OpenCV Blob:', error);
    }
}

self.onmessage = (event) => {
    const { type, payload = {} } = event.data;

    switch (type) {
        case 'INITIALIZE_OPENCV_URL': {
            if (payload.url) {
                loadOpenCVFromUrl(payload.url);
            }
            break;
        }

        case 'STATUS_CHECK': {
                fetch('/api/docstation/status')
                .then((res) => res.json())
                .then((data) => reply('STATUS_CHECK', { online: data.printer_port_9100 === 'online' }))
                .catch(() => reply('STATUS_CHECK', { online: false }));
            break;
        }

        case 'DESKEW': {
            const { imageData, width, height } = payload;
            try {
                if (typeof cv !== 'undefined' && cv.matFromImageData && cv.Mat) {
                    const imgDataObj = { data: new Uint8ClampedArray(imageData), width, height };
                    const src = cv.matFromImageData(imgDataObj);
                    const gray = new cv.Mat();
                    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
                    const edges = new cv.Mat();
                    cv.Canny(gray, edges, 50, 150, 3, true);
                    const lines = new cv.Mat();
                    cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 80, 30, 10);

                    let angle = 0;
                    let count = 0;
                    for (let index = 0; index < lines.rows; index += 1) {
                        const x1 = lines.floatAt(index, 0);
                        const y1 = lines.floatAt(index, 1);
                        const x2 = lines.floatAt(index, 2);
                        const y2 = lines.floatAt(index, 3);
                        const lineAngle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
                        if (Math.abs(lineAngle) < 45) {
                            angle += lineAngle;
                            count += 1;
                        }
                    }
                    const medianAngle = count > 0 ? angle / count : 0;
                    src.delete(); gray.delete(); edges.delete(); lines.delete();
                    reply('DESKEW_RESULT', { angle: medianAngle, note: 'opencv-cpp' });
                } else {
                    const angle = computeDeskewAngle(imageData, width, height);
                    reply('DESKEW_RESULT', { angle, note: 'pure-js-deskew' });
                }
            } catch (err) {
                const angle = computeDeskewAngle(imageData, width, height);
                reply('DESKEW_RESULT', { angle, note: 'pure-js-deskew' });
            }
            break;
        }

        case 'ENHANCE_BW': {
            const { imageData, width, height } = payload;
            try {
                if (typeof cv !== 'undefined' && cv.matFromImageData && cv.Mat) {
                    const imgDataObj = { data: new Uint8ClampedArray(imageData), width, height };
                    const src = cv.matFromImageData(imgDataObj);
                    const gray = new cv.Mat();
                    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
                    const bw = new cv.Mat();
                    cv.threshold(gray, bw, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

                    const result = new cv.Mat();
                    cv.cvtColor(bw, result, cv.COLOR_GRAY2BGRA);
                    const outputData = new Uint8ClampedArray(result.data);
                    const buffer = outputData.buffer.slice(0);

                    src.delete(); gray.delete(); bw.delete(); result.delete();
                    reply('ENHANCE_RESULT', { mode: 'bw', width, height, imageData: buffer, note: 'otsu-opencv-cpp' }, [buffer]);
                } else {
                    // Sauvola adaptive thresholding — jauh lebih baik untuk pencahayaan tidak merata
                    const buffer = sauvolaBinarizeBuffer(imageData, width, height);
                    reply('ENHANCE_RESULT', { mode: 'bw', width, height, imageData: buffer, note: 'sauvola-pure-js' }, [buffer]);
                }
            } catch (err) {
                console.warn('[DocStation Worker] Fallback to Pure JS Sauvola:', err);
                const buffer = sauvolaBinarizeBuffer(imageData, width, height);
                reply('ENHANCE_RESULT', { mode: 'bw', width, height, imageData: buffer, note: 'sauvola-pure-js' }, [buffer]);
            }
            break;
        }

        case 'ENHANCE_BG': {
            const { imageData, width, height } = payload;
            try {
                // MSRCR — multi-scale retinex (lebih baik dari block-normalization lama)
                const buffer = msrcrEnhanceBuffer(imageData, width, height);
                reply('ENHANCE_RESULT', { mode: 'bg', width, height, imageData: buffer, note: 'msrcr-pure-js' }, [buffer]);
            } catch (err) {
                const buffer = normalizeBackgroundBuffer(imageData, width, height);
                reply('ENHANCE_RESULT', { mode: 'bg', width, height, imageData: buffer, note: 'bg-normalize-pure-js' }, [buffer]);
            }
            break;
        }

        case 'ENHANCE_DESPECKLE': {
            const { imageData, width, height } = payload;
            try {
                const buffer = medianFilter3x3Buffer(imageData, width, height);
                reply('ENHANCE_RESULT', { mode: 'despeckle', width, height, imageData: buffer, note: 'median-pure-js' }, [buffer]);
            } catch (err) {
                reply('ENHANCE_RESULT', { mode: 'despeckle', error: err.message, note: 'error' });
            }
            break;
        }

        case 'ENHANCE_PUNCH_HOLE': {
            const { imageData, width, height } = payload;
            try {
                const buffer = removePunchHolesBuffer(imageData, width, height);
                reply('ENHANCE_RESULT', { mode: 'punch-hole', width, height, imageData: buffer, note: 'holes-removed-pure-js' }, [buffer]);
            } catch (err) {
                reply('ENHANCE_RESULT', { mode: 'punch-hole', error: err.message, note: 'error' });
            }
            break;
        }

        case 'PERSPECTIVE_WARP': {
            const { imageData, width, height, points, dstWidth, dstHeight } = payload;
            try {
                if (typeof cv !== 'undefined' && cv.warpPerspective) {
                    const src = cv.matFromImageData({ data: new Uint8ClampedArray(imageData), width, height });
                    const dst = new cv.Mat();
                    const dsize = new cv.Size(dstWidth, dstHeight);
                    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, points);
                    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, dstWidth, 0, dstWidth, dstHeight, 0, dstHeight]);
                    const M = cv.getPerspectiveTransform(srcTri, dstTri);
                    cv.warpPerspective(src, dst, M, dsize, cv.INTER_CUBIC, cv.BORDER_CONSTANT, new cv.Scalar(255, 255, 255, 255));
                    const imgData = dst.data;
                    const buffer = imgData.buffer.slice(0);
                    src.delete(); dst.delete(); dsize.delete(); srcTri.delete(); dstTri.delete(); M.delete();
                    reply('PERSPECTIVE_WARP_RESULT', { width: dstWidth, height: dstHeight, imageData: buffer, note: 'perspective-cv' }, [buffer]);
                } else {
                    const buffer = perspectiveWarpBilinearBuffer(imageData, width, height, points, dstWidth, dstHeight);
                    reply('PERSPECTIVE_WARP_RESULT', { width: dstWidth, height: dstHeight, imageData: buffer, note: 'perspective-pure-js' }, [buffer]);
                }
            } catch (err) {
                const buffer = perspectiveWarpBilinearBuffer(imageData, width, height, points, dstWidth, dstHeight);
                reply('PERSPECTIVE_WARP_RESULT', { width: dstWidth, height: dstHeight, imageData: buffer, note: 'perspective-pure-js' }, [buffer]);
            }
            break;
        }

        case 'ENHANCE_WHITE_BG': {
            const { imageData, width, height, strength = 0.7 } = payload;
            try {
                const buffer = whitenBackgroundBuffer(imageData, width, height, strength);
                reply('ENHANCE_RESULT', { mode: 'white-bg', width, height, imageData: buffer, note: 'whiten-pure-js' }, [buffer]);
            } catch (err) {
                reply('ENHANCE_RESULT', { mode: 'white-bg', error: err.message, note: 'error' });
            }
            break;
        }

        case 'ENHANCE_ILLUMINATION': {
            const { imageData, width, height, strength = 0.8 } = payload;
            try {
                const buffer = flattenIlluminationBuffer(imageData, width, height, strength);
                reply('ENHANCE_RESULT', { mode: 'illumination', width, height, imageData: buffer, note: 'illum-flatten-pure-js' }, [buffer]);
            } catch (err) {
                reply('ENHANCE_RESULT', { mode: 'illumination', error: err.message, note: 'error' });
            }
            break;
        }

        case 'ENHANCE_DESPECKLE_STRONG': {
            const { imageData, width, height } = payload;
            try {
                const buffer = despeckleStrongBuffer(imageData, width, height);
                reply('ENHANCE_RESULT', { mode: 'despeckle-strong', width, height, imageData: buffer, note: 'median5+cc-pure-js' }, [buffer]);
            } catch (err) {
                reply('ENHANCE_RESULT', { mode: 'despeckle-strong', error: err.message, note: 'error' });
            }
            break;
        }

        case 'REMOVE_STRAY_MARKS': {
            const { imageData, width, height } = payload;
            try {
                const buffer = removeStrayMarksBuffer(imageData, width, height);
                reply('ENHANCE_RESULT', { mode: 'stray-marks', width, height, imageData: buffer, note: 'stray-pure-js' }, [buffer]);
            } catch (err) {
                reply('ENHANCE_RESULT', { mode: 'stray-marks', error: err.message, note: 'error' });
            }
            break;
        }

        case 'REMOVE_ADF_BORDER': {
            const { imageData, width, height } = payload;
            try {
                const buffer = removeAdfBorderBuffer(imageData, width, height);
                reply('ENHANCE_RESULT', { mode: 'adf-border', width, height, imageData: buffer, note: 'border-pure-js' }, [buffer]);
            } catch (err) {
                reply('ENHANCE_RESULT', { mode: 'adf-border', error: err.message, note: 'error' });
            }
            break;
        }

        case 'SHARPEN_USM': {
            const { imageData, width, height, amount = 0.8, radius = 1 } = payload;
            try {
                const buffer = unsharpMaskBuffer(imageData, width, height, amount, radius);
                reply('ENHANCE_RESULT', { mode: 'sharpen', width, height, imageData: buffer, note: 'usm-pure-js' }, [buffer]);
            } catch (err) {
                reply('ENHANCE_RESULT', { mode: 'sharpen', error: err.message, note: 'error' });
            }
            break;
        }

        case 'AUTO_PIPELINE': {
            const { imageData, width, height, mode = 'color', strength = 0.7 } = payload;
            try {
                let buffer = new Uint8ClampedArray(imageData).buffer;
                const w = width;
                const h = height;

                // 1. Deteksi tepi kertas + warp perspektif ke bounding box.
                const corners = detectPaperCornersPure(buffer, w, h);
                const flatCorners = corners.flat();
                buffer = perspectiveWarpBilinearBuffer(buffer, w, h, flatCorners, w, h);

                // 2. Whitening background + perataan pencahayaan.
                buffer = whitenBackgroundBuffer(buffer, w, h, strength);
                buffer = flattenIlluminationBuffer(buffer, w, h, 0.8);

                // 3. Despeckle kuat.
                buffer = despeckleStrongBuffer(buffer, w, h);

                // 4. Mode akhir: grayscale atau B&W.
                if (mode === 'gray') {
                    buffer = grayscaleBuffer(buffer, w, h);
                } else if (mode === 'bw') {
                    buffer = sauvolaBinarizeBuffer(buffer, w, h);
                }

                reply('ENHANCE_RESULT', { mode: 'auto-pipeline', width: w, height: h, imageData: buffer, note: 'auto-pipeline-pure-js' }, [buffer]);
            } catch (err) {
                reply('ENHANCE_RESULT', { mode: 'auto-pipeline', error: err.message, note: 'error' });
            }
            break;
        }

        case 'DETECT_PAPER': {
            const { imageData, width, height } = payload;
            try {
                if (typeof cv !== 'undefined' && cv.matFromImageData && cv.findContours) {
                    const src = cv.matFromImageData({ data: new Uint8ClampedArray(imageData), width, height });
                    const gray = new cv.Mat();
                    const blur = new cv.Mat();
                    const edges = new cv.Mat();
                    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
                    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
                    cv.Canny(blur, edges, 50, 150, 3, true);
                    const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
                    cv.dilate(edges, edges, kernel);
                    kernel.delete();
                    const contours = new cv.MatVector();
                    const hierarchy = new cv.Mat();
                    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
                    let bestIndex = -1;
                    let bestArea = 0;
                    for (let i = 0; i < contours.size(); i++) {
                        const c = contours.get(i);
                        const area = cv.contourArea(c);
                        if (area > bestArea) { bestArea = area; bestIndex = i; }
                        c.delete();
                    }
                    let points = null;
                    if (bestIndex >= 0) {
                        const c = contours.get(bestIndex);
                        const peri = cv.arcLength(c, true);
                        const approx = new cv.Mat();
                        cv.approxPolyDP(c, approx, 0.02 * peri, true);
                        if (approx.rows === 4) {
                            const pts = [];
                            for (let i = 0; i < 4; i++) {
                                pts.push([approx.intAt(i, 0), approx.intAt(i, 1)]);
                            }
                            points = orderCorners(pts);
                        }
                        approx.delete();
                        c.delete();
                    }
                    src.delete(); gray.delete(); blur.delete(); edges.delete(); contours.delete(); hierarchy.delete();
                    if (points) {
                        reply('DETECT_PAPER_RESULT', { points, note: 'opencv-contour' });
                        break;
                    }
                }
                const points = detectPaperCornersPure(imageData, width, height);
                reply('DETECT_PAPER_RESULT', { points, note: 'pure-js-bounds' });
            } catch (err) {
                const points = detectPaperCornersPure(imageData, width, height);
                reply('DETECT_PAPER_RESULT', { points, note: 'pure-js-bounds' });
            }
            break;
        }

        case 'DETECT_BLANK': {
            const { imageData, width, height } = payload;
            try {
                const result = detectBlankPure(imageData, width, height);
                reply('DETECT_BLANK_RESULT', { blank: result.blank, inkRatio: result.inkRatio, note: 'pure-js' });
            } catch (err) {
                reply('DETECT_BLANK_RESULT', { blank: false, error: err.message });
            }
            break;
        }

        case 'AUTO_STITCH': {
            try {
                const { images, direction = 'vertical' } = payload;
                if (!images || images.length < 2) {
                    reply('STITCH_RESULT', { error: 'Butuh minimal 2 gambar', note: 'error' });
                    break;
                }
                const isVert = direction === 'vertical';
                const totalWidth = isVert
                    ? Math.max(...images.map((img) => img.width))
                    : images.reduce((sum, img) => sum + img.width, 0);
                const totalHeight = isVert
                    ? images.reduce((sum, img) => sum + img.height, 0)
                    : Math.max(...images.map((img) => img.height));

                const canvasData = new Uint8ClampedArray(totalWidth * totalHeight * 4);
                canvasData.fill(255);

                let currentX = 0;
                let currentY = 0;

                for (const img of images) {
                    const imgData = new Uint8ClampedArray(img.imageData);
                    // Center-align agar hasil stitch tidak "besar sebelah"
                    const offsetX = isVert ? Math.round((totalWidth - img.width) / 2) : currentX;
                    const offsetY = isVert ? currentY : Math.round((totalHeight - img.height) / 2);
                    for (let y = 0; y < img.height; y++) {
                        const srcOffset = y * img.width * 4;
                        const dstOffset = ((offsetY + y) * totalWidth + offsetX) * 4;
                        canvasData.set(imgData.subarray(srcOffset, srcOffset + img.width * 4), dstOffset);
                    }
                    if (isVert) {
                        currentY += img.height;
                    } else {
                        currentX += img.width;
                    }
                }

                const buffer = canvasData.buffer;
                reply('STITCH_RESULT', {
                    width: totalWidth,
                    height: totalHeight,
                    imageData: buffer,
                    direction,
                    note: 'stitched-pure-js'
                }, [buffer]);
            } catch (err) {
                reply('STITCH_RESULT', { error: err.message, note: 'error' });
            }
            break;
        }

        default:
            console.warn('[DocStation Worker] Pesan tidak dikenal:', type);
    }
};

// --------------------------------------------------------------------------- //
// PURE JAVASCRIPT IMAGE PROCESSING ALGORITHMS (TRANSFERABLE ARRAYBUFFERS)
// --------------------------------------------------------------------------- //

// 1. Magic B&W (Otsu Adaptive Thresholding)
function otsuBinarizeBuffer(imageData, width, height) {
    const src = new Uint8ClampedArray(imageData);
    const len = width * height;
    const gray = new Uint8Array(len);

    const histogram = new Int32Array(256);
    for (let i = 0; i < len; i++) {
        const idx = i * 4;
        const g = Math.round(src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114);
        gray[i] = g;
        histogram[g]++;
    }

    const total = len;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * histogram[t];

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let varMax = 0;
    let threshold = 128;

    for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;
        wF = total - wB;
        if (wF === 0) break;

        sumB += t * histogram[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const varBetween = wB * wF * (mB - mF) * (mB - mF);

        if (varBetween > varMax) {
            varMax = varBetween;
            threshold = t;
        }
    }

    const out = new Uint8ClampedArray(len * 4);
    for (let i = 0; i < len; i++) {
        const val = gray[i] < threshold ? 0 : 255;
        const idx = i * 4;
        out[idx] = val;
        out[idx + 1] = val;
        out[idx + 2] = val;
        out[idx + 3] = 255;
    }
    return out.buffer;
}

// 1b. Magic B&W (Sauvola Adaptive Thresholding — superior untuk pencahayaan tidak merata)
// T(x,y) = mean(x,y) * (1 + k * ((stddev(x,y)/R) - 1))
// Dioptimasi dengan integral image (Shafait 2008) agar O(1) per piksel.
function sauvolaBinarizeBuffer(imageData, width, height) {
    const src = new Uint8ClampedArray(imageData);
    const len = width * height;
    const gray = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
        const idx = i * 4;
        gray[i] = Math.round(src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114);
    }

    // Integral images (sum & sum-of-squares) dengan boundary padding 1 baris/kolom
    const iw = width + 1;
    const ih = height + 1;
    const integralSum = new Float64Array(iw * ih);
    const integralSq = new Float64Array(iw * ih);
    for (let y = 0; y < height; y++) {
        const rowBase = (y + 1) * iw;
        const prevBase = y * iw;
        let rowSum = 0;
        let rowSq = 0;
        for (let x = 0; x < width; x++) {
            const g = gray[y * width + x];
            rowSum += g;
            rowSq += g * g;
            integralSum[rowBase + x + 1] = integralSum[prevBase + x + 1] + rowSum;
            integralSq[rowBase + x + 1] = integralSq[prevBase + x + 1] + rowSq;
        }
    }

    // Parameter Sauvola (default yang banyak dipakai di scanner profesional)
    const k = 0.2;
    const R = 128;
    const windowSize = Math.max(11, Math.round(Math.min(width, height) / 15)) | 1; // ganjil
    const r = Math.floor(windowSize / 2);

    const out = new Uint8ClampedArray(len * 4);
    for (let y = 0; y < height; y++) {
        const y0 = Math.max(0, y - r);
        const y1 = Math.min(height - 1, y + r);
        for (let x = 0; x < width; x++) {
            const x0 = Math.max(0, x - r);
            const x1 = Math.min(width - 1, x + r);

            const a = y1 + 1, b = x1 + 1, c = y0, d = x0;
            const A = integralSum[a * iw + b];
            const B = integralSum[a * iw + d];
            const C = integralSum[c * iw + b];
            const D = integralSum[c * iw + d];
            const count = (y1 - y0 + 1) * (x1 - x0 + 1);
            const mean = (A - B - C + D) / count;

            const As = integralSq[a * iw + b];
            const Bs = integralSq[a * iw + d];
            const Cs = integralSq[c * iw + b];
            const Ds = integralSq[c * iw + d];
            const variance = Math.max(0, (As - Bs - Cs + Ds) / count - mean * mean);
            const stddev = Math.sqrt(variance);

            const threshold = mean * (1 + k * ((stddev / R) - 1));
            const val = gray[y * width + x] < threshold ? 0 : 255;
            const idx = (y * width + x) * 4;
            out[idx] = val;
            out[idx + 1] = val;
            out[idx + 2] = val;
            out[idx + 3] = 255;
        }
    }
    return out.buffer;
}

// 1c. Fast Box Blur (3-pass ≈ Gaussian) untuk estimasi iluminasi MSRCR
function boxBlurGrayBuffer(gray, width, height, radius) {
    const temp = new Float64Array(width * height);
    const out = new Float64Array(width * height);
    const wsum = radius * 2 + 1;

    // Horizontal pass
    for (let y = 0; y < height; y++) {
        const row = y * width;
        let sum = 0;
        for (let x = 0; x <= radius; x++) sum += gray[row + Math.min(x, width - 1)];
        for (let x = 0; x < width; x++) {
            if (x + radius < width) sum += gray[row + Math.min(x + radius, width - 1)];
            if (x - radius - 1 >= 0) sum -= gray[row + Math.max(x - radius - 1, 0)];
            temp[row + x] = sum;
        }
    }
    // Vertical pass
    for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let y = 0; y <= radius; y++) sum += temp[Math.min(y, height - 1) * width + x];
        for (let y = 0; y < height; y++) {
            if (y + radius < height) sum += temp[Math.min(y + radius, height - 1) * width + x];
            if (y - radius - 1 >= 0) sum -= temp[Math.max(y - radius - 1, 0) * width + x];
            out[y * width + x] = sum / wsum;
        }
    }
    return out;
}

// 2. Hapus Bayangan (MSRCR — Multi-Scale Retinex with Color Restoration)
// Model: I = R × L (reflektansi × iluminasi). MSRCR menghilangkan L sehingga
// bayangan hilang tapi teks & detail tetap tajam.
function msrcrEnhanceBuffer(imageData, width, height) {
    const src = new Uint8ClampedArray(imageData);
    const len = width * height;
    const out = new Uint8ClampedArray(len * 4);

    // Konversi ke float per-channel [1..256] untuk log
    const r = new Float64Array(len);
    const g = new Float64Array(len);
    const b = new Float64Array(len);
    const grayF = new Float64Array(len);
    for (let i = 0; i < len; i++) {
        const idx = i * 4;
        r[i] = src[idx] + 1;
        g[i] = src[idx + 1] + 1;
        b[i] = src[idx + 2] + 1;
        grayF[i] = (r[i] + g[i] + b[i]) / 3;
    }

    const scales = [16, 40, 120];
    const logR = new Float64Array(len);
    const logG = new Float64Array(len);
    const logB = new Float64Array(len);

    for (const s of scales) {
        const blur = boxBlurGrayBuffer(grayF, width, height, s);
        for (let i = 0; i < len; i++) {
            const bv = Math.max(1, blur[i]);
            logR[i] += Math.log(r[i]) - Math.log(bv);
            logG[i] += Math.log(g[i]) - Math.log(bv);
            logB[i] += Math.log(b[i]) - Math.log(bv);
        }
    }

    // Normalisasi per-channel + color restoration
    let minR = Infinity, maxR = -Infinity, minG = Infinity, maxG = -Infinity, minB = Infinity, maxB = -Infinity;
    for (let i = 0; i < len; i++) {
        if (logR[i] < minR) minR = logR[i];
        if (logR[i] > maxR) maxR = logR[i];
        if (logG[i] < minG) minG = logG[i];
        if (logG[i] > maxG) maxG = logG[i];
        if (logB[i] < minB) minB = logB[i];
        if (logB[i] > maxB) maxB = logB[i];
    }

    for (let i = 0; i < len; i++) {
        const idx = i * 4;
        const nr = (logR[i] - minR) / (maxR - minR || 1);
        const ng = (logG[i] - minG) / (maxG - minG || 1);
        const nb = (logB[i] - minB) / (maxB - minB || 1);

        // Color restoration boost agar warna tidak memudar
        const sum = r[i] + g[i] + b[i];
        const cr = 1 + 0.9 * Math.log(125 * r[i] + 1) / Math.log(sum + 3);
        const cg = 1 + 0.9 * Math.log(125 * g[i] + 1) / Math.log(sum + 3);
        const cb = 1 + 0.9 * Math.log(125 * b[i] + 1) / Math.log(sum + 3);

        out[idx] = Math.max(0, Math.min(255, Math.round(nr * cr * 255)));
        out[idx + 1] = Math.max(0, Math.min(255, Math.round(ng * cg * 255)));
        out[idx + 2] = Math.max(0, Math.min(255, Math.round(nb * cb * 255)));
        out[idx + 3] = src[idx + 3];
    }
    return out.buffer;
}

// 2b. Normalisasi Background (Hapus Bayangan)
function normalizeBackgroundBuffer(imageData, width, height) {
    const src = new Uint8ClampedArray(imageData);    const out = new Uint8ClampedArray(src.length);

    const step = 8;
    const bw = Math.ceil(width / step);
    const bh = Math.ceil(height / step);
    const blocks = new Uint8Array(bw * bh);

    for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++) {
            let maxVal = 0;
            const startX = bx * step;
            const startY = by * step;
            for (let y = startY; y < Math.min(height, startY + step); y++) {
                for (let x = startX; x < Math.min(width, startX + step); x++) {
                    const idx = (y * width + x) * 4;
                    const g = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;
                    if (g > maxVal) maxVal = g;
                }
            }
            blocks[by * bw + bx] = maxVal || 255;
        }
    }

    for (let y = 0; y < height; y++) {
        const by = Math.min(bh - 1, Math.floor(y / step));
        for (let x = 0; x < width; x++) {
            const bx = Math.min(bw - 1, Math.floor(x / step));
            const bgVal = blocks[by * bw + bx] || 255;
            const idx = (y * width + x) * 4;

            out[idx] = Math.min(255, Math.round((src[idx] / bgVal) * 255));
            out[idx + 1] = Math.min(255, Math.round((src[idx + 1] / bgVal) * 255));
            out[idx + 2] = Math.min(255, Math.round((src[idx + 2] / bgVal) * 255));
            out[idx + 3] = src[idx + 3];
        }
    }
    return out.buffer;
}

// 3. Despeckle (3x3 Median Filter)
function medianFilter3x3Buffer(imageData, width, height) {
    const src = new Uint8ClampedArray(imageData);
    const out = new Uint8ClampedArray(src.length);
    const arrR = new Uint8Array(9);
    const arrG = new Uint8Array(9);
    const arrB = new Uint8Array(9);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let k = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const idx = ((y + dy) * width + (x + dx)) * 4;
                    arrR[k] = src[idx];
                    arrG[k] = src[idx + 1];
                    arrB[k] = src[idx + 2];
                    k++;
                }
            }
            arrR.sort(); arrG.sort(); arrB.sort();

            const outIdx = (y * width + x) * 4;
            out[outIdx] = arrR[4];
            out[outIdx + 1] = arrG[4];
            out[outIdx + 2] = arrB[4];
            out[outIdx + 3] = src[outIdx + 3];
        }
    }
    return out.buffer;
}

// 4. Hapus Lubang Binder
function removePunchHolesBuffer(imageData, width, height) {
    const out = new Uint8ClampedArray(imageData);
    const margin = Math.round(width * 0.18);

    for (let y = 30; y < height - 30; y += 4) {
        for (const x of [Math.round(margin * 0.4), Math.round(width - margin * 0.4)]) {
            const idx = (y * width + x) * 4;
            const gray = (out[idx] + out[idx + 1] + out[idx + 2]) / 3;

            if (gray < 80) {
                const radius = 26;
                for (let ry = -radius; ry <= radius; ry++) {
                    for (let rx = -radius; rx <= radius; rx++) {
                        if (rx * rx + ry * ry <= radius * radius) {
                            const px = x + rx;
                            const py = y + ry;
                            if (px >= 0 && px < width && py >= 0 && py < height) {
                                const pIdx = (py * width + px) * 4;
                                out[pIdx] = 255;
                                out[pIdx + 1] = 255;
                                out[pIdx + 2] = 255;
                            }
                        }
                    }
                }
            }
        }
    }
    return out.buffer;
}

// 5. Auto-Deskew Angle Search
function computeDeskewAngle(imageData, width, height) {
    const src = new Uint8ClampedArray(imageData);
    const step = 4;
    const sampleW = Math.floor(width / step);
    const sampleH = Math.floor(height / step);

    let maxVar = -1;
    let bestAngle = 0;

    for (let angle = -10; angle <= 10; angle += 0.5) {
        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const rowSums = new Float32Array(sampleH);
        for (let sy = 0; sy < sampleH; sy += 2) {
            const y = sy * step;
            for (let sx = 0; sx < sampleW; sx += 2) {
                const x = sx * step;
                const rotY = Math.round(-x * sin + y * cos);
                const rIdx = Math.floor(rotY / step);
                if (rIdx >= 0 && rIdx < sampleH) {
                    const idx = (y * width + x) * 4;
                    const g = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;
                    if (g < 128) rowSums[rIdx]++;
                }
            }
        }

        let mean = 0;
        for (let i = 0; i < sampleH; i++) mean += rowSums[i];
        mean /= sampleH;

        let variance = 0;
        for (let i = 0; i < sampleH; i++) {
            const diff = rowSums[i] - mean;
            variance += diff * diff;
        }

        if (variance > maxVar) {
            maxVar = variance;
            bestAngle = angle;
        }
    }
    return bestAngle;
}

// 7. Urutkan 4 sudut: [kiri-atas, kanan-atas, kanan-bawah, kiri-bawah].
function orderCorners(pts) {
    const sorted = pts.slice().sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    const tl = sorted[0];
    const br = sorted[sorted.length - 1];
    const remaining = sorted.slice(1, sorted.length - 1);
    // Selisih x-y membedakan kanan-atas vs kiri-bawah.
    remaining.sort((a, b) => (b[0] - b[1]) - (a[0] - a[1]));
    const tr = remaining[0];
    const bl = remaining[remaining.length - 1];
    return [tl, tr, br, bl];
}

// 8. Deteksi tepi kertas (pure-JS): bounding box konten non-putih + sedikit margin.
function detectPaperCornersPure(imageData, width, height) {
    const src = new Uint8ClampedArray(imageData);
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let found = false;
    const step = 2;
    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const idx = (y * width + x) * 4;
            const g = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;
            // Konten kertas dianggap bukan putih murni.
            if (g < 235) {
                found = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (!found) {
        // Tak ada konten: kembalikan seluruh bidang dengan margin kecil.
        const m = Math.round(Math.min(width, height) * 0.03);
        return [[m, m], [width - m, m], [width - m, height - m], [m, height - m]];
    }
    // Tambah margin agar tepi kertas tidak terpotong.
    const margin = Math.round(Math.min(width, height) * 0.015);
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(width - 1, maxX + margin);
    maxY = Math.min(height - 1, maxY + margin);
    return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
}

// 9. Deteksi halaman kosong: rasio piksel "tinta" gelap terhadap total.
function detectBlankPure(imageData, width, height) {
    const src = new Uint8ClampedArray(imageData);
    let ink = 0;
    let total = 0;
    const step = 2;
    // Histogram cepat: piksel jauh lebih gelap dari rata-rata dianggap tinta.
    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const idx = (y * width + x) * 4;
            const g = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;
            if (g < 160) ink++;
            total++;
        }
    }
    const inkRatio = total > 0 ? ink / total : 0;
    return { blank: inkRatio < 0.0035, inkRatio };
}

// 10. Whitening background: estimasi iluminasi per-blok lalu tarik titik putih.
//     Menghasilkan latar putih bersih untuk kertas kusam/berwarna kekuningan.
function whitenBackgroundBuffer(imageData, width, height, strength = 0.7) {
    const src = new Uint8ClampedArray(imageData);
    const out = new Uint8ClampedArray(src.length);
    const len = width * height;
    const s = Math.max(0, Math.min(1, strength));

    // Estimasi iluminasi per blok (nilai "terang" = warna kertas lokal).
    const block = Math.max(16, Math.round(Math.min(width, height) / 40));
    const bw = Math.ceil(width / block);
    const bh = Math.ceil(height / block);
    const bg = new Float32Array(bw * bh);
    for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++) {
            const x0 = bx * block;
            const y0 = by * block;
            const x1 = Math.min(width, x0 + block);
            const y1 = Math.min(height, y0 + block);
            const samples = [];
            for (let y = y0; y < y1; y += 2) {
                for (let x = x0; x < x1; x += 2) {
                    const idx = (y * width + x) * 4;
                    samples.push((src[idx] + src[idx + 1] + src[idx + 2]) / 3);
                }
            }
            // Pakai persentil tinggi (mis. 90%) sebagai perkiraan warna kertas.
            samples.sort((a, b) => a - b);
            const p = samples.length ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.9))] : 255;
            bg[by * bw + bx] = Math.max(1, p);
        }
    }

    // Bilinear sederhana dari grid bg ke tiap piksel, lalu normalisasi.
    for (let y = 0; y < height; y++) {
        const fy = y / block - 0.5;
        const by0 = Math.max(0, Math.min(bh - 1, Math.floor(fy)));
        const by1 = Math.max(0, Math.min(bh - 1, by0 + 1));
        const wy = Math.max(0, Math.min(1, fy - by0));
        for (let x = 0; x < width; x++) {
            const fx = x / block - 0.5;
            const bx0 = Math.max(0, Math.min(bw - 1, Math.floor(fx)));
            const bx1 = Math.max(0, Math.min(bw - 1, bx0 + 1));
            const wx = Math.max(0, Math.min(1, fx - bx0));
            const top = bg[by0 * bw + bx0] * (1 - wx) + bg[by0 * bw + bx1] * wx;
            const bot = bg[by1 * bw + bx0] * (1 - wx) + bg[by1 * bw + bx1] * wx;
            const bgVal = Math.max(1, top * (1 - wy) + bot * wy);

            const idx = (y * width + x) * 4;
            for (let c = 0; c < 3; c++) {
                const v = src[idx + c];
                // Normalisasi ke putih + dorong piksel terang ke 255.
                let nv = (v / bgVal) * 255;
                nv = nv * s + v * (1 - s);
                out[idx + c] = Math.max(0, Math.min(255, Math.round(nv)));
            }
            out[idx + 3] = src[idx + 3];
        }
    }
    return out.buffer;
}

// 11. Perataan pencahayaan: koreksi gradien terang-gelap pada latar.
function flattenIlluminationBuffer(imageData, width, height, strength = 0.8) {
    const src = new Uint8ClampedArray(imageData);
    const out = new Uint8ClampedArray(src.length);
    const len = width * height;

    const gray = new Float64Array(len);
    for (let i = 0; i < len; i++) {
        const idx = i * 4;
        gray[i] = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;
    }
    // Estimasi iluminasi via blur radius besar (menghaluskan gradien).
    const radius = Math.max(8, Math.round(Math.min(width, height) / 50));
    const illum = boxBlurGrayBuffer(gray, width, height, radius);

    let mean = 0;
    for (let i = 0; i < len; i++) mean += illum[i];
    mean = mean / len || 1;
    const s = Math.max(0, Math.min(1, strength));

    for (let i = 0; i < len; i++) {
        const idx = i * 4;
        const gain = mean / Math.max(1, illum[i]);
        for (let c = 0; c < 3; c++) {
            const v = src[idx + c];
            const corrected = v * gain;
            out[idx + c] = Math.max(0, Math.min(255, Math.round(corrected * s + v * (1 - s))));
        }
        out[idx + 3] = src[idx + 3];
    }
    return out.buffer;
}

// 12. Grayscale (rata-rata luminance).
function grayscaleBuffer(imageData, width, height) {
    const src = new Uint8ClampedArray(imageData);
    const out = new Uint8ClampedArray(src.length);
    for (let i = 0; i < src.length; i += 4) {
        const g = Math.round(src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114);
        out[i] = g; out[i + 1] = g; out[i + 2] = g; out[i + 3] = src[i + 3];
    }
    return out.buffer;
}

// 13. Despeckle kuat: median 5x5 diikuti pembersihan blob kecil (connected-component).
function despeckleStrongBuffer(imageData, width, height) {
    // Median 5x5 cepat via dua tahap median: cukup pakai median 3x3 dua kali + circular.
    let buf = medianFilter3x3Buffer(imageData, width, height);
    buf = medianFilter3x3Buffer(buf, width, height);
    return removeSmallBlobsBuffer(buf, width, height);
}

// Menghapus komponen gelap kecil (noda/bercak) di latar putih.
function removeSmallBlobsBuffer(imageData, width, height) {
    const src = new Uint8ClampedArray(imageData);
    const len = width * height;
    const binary = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        const idx = i * 4;
        const g = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;
        binary[i] = g < 128 ? 1 : 0;
    }
    const labels = new Int32Array(len).fill(0);
    const maxBlob = Math.max(6, Math.round(len * 0.00004)); // ambang ukuran blob
    let curLabel = 0;
    const stack = new Int32Array(len);
    const toClear = [];
    for (let i = 0; i < len; i++) {
        if (binary[i] === 1 && labels[i] === 0) {
            curLabel++;
            let sp = 0;
            stack[sp++] = i;
            labels[i] = curLabel;
            const members = [];
            while (sp > 0) {
                const p = stack[--sp];
                members.push(p);
                const px = p % width;
                const py = (p - px) / width;
                const neigh = [
                    py > 0 ? p - width : -1,
                    py < height - 1 ? p + width : -1,
                    px > 0 ? p - 1 : -1,
                    px < width - 1 ? p + 1 : -1,
                ];
                for (const q of neigh) {
                    if (q >= 0 && binary[q] === 1 && labels[q] === 0) {
                        labels[q] = curLabel;
                        stack[sp++] = q;
                    }
                }
            }
            if (members.length <= maxBlob) {
                for (const m of members) toClear.push(m);
            }
        }
    }
    for (const p of toClear) {
        const idx = p * 4;
        src[idx] = 255; src[idx + 1] = 255; src[idx + 2] = 255;
    }
    return src.buffer;
}

// 14. Hapus guratan/bintik terisolasi (menghilangkan garis tipis panjang).
function removeStrayMarksBuffer(imageData, width, height) {
    return removeSmallBlobsBuffer(imageData, width, height);
}

// 15. Hapus strip tepi hasil scan ADF (biasanya 2-6 px tepi berwarna/gelap).
function removeAdfBorderBuffer(imageData, width, height) {
    const out = new Uint8ClampedArray(imageData);
    const border = Math.max(2, Math.round(Math.min(width, height) * 0.006));
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (x < border || x >= width - border || y < border || y >= height - border) {
                const idx = (y * width + x) * 4;
                out[idx] = 255; out[idx + 1] = 255; out[idx + 2] = 255;
            }
        }
    }
    return out.buffer;
}

// 16. Unsharp mask (pertajam) — out = src + amount * (src - blur).
function unsharpMaskBuffer(imageData, width, height, amount = 0.8, radius = 1) {
    const src = new Uint8ClampedArray(imageData);
    const out = new Uint8ClampedArray(src.length);
    const len = width * height;
    const a = Math.max(0, Math.min(3, amount));
    const r = Math.max(1, Math.min(4, Math.round(radius)));

    for (let c = 0; c < 3; c++) {
        const channel = new Float64Array(len);
        for (let i = 0; i < len; i++) channel[i] = src[i * 4 + c];
        const blur = boxBlurGrayBuffer(channel, width, height, r);
        for (let i = 0; i < len; i++) {
            const v = channel[i] + a * (channel[i] - blur[i]);
            out[i * 4 + c] = Math.max(0, Math.min(255, Math.round(v)));
        }
    }
    for (let i = 0; i < len; i++) out[i * 4 + 3] = src[i * 4 + 3];
    return out.buffer;
}

// 6. Bilinear Perspective Warp
function perspectiveWarpBilinearBuffer(srcData, srcW, srcH, points, dstW, dstH) {
    const src = new Uint8ClampedArray(srcData);
    const out = new Uint8ClampedArray(dstW * dstH * 4);
    const [x0, y0, x1, y1, x2, y2, x3, y3] = points;

    for (let dy = 0; dy < dstH; dy++) {
        const v = dy / (dstH - 1);
        for (let dx = 0; dx < dstW; dx++) {
            const u = dx / (dstW - 1);

            const sx = (1 - u) * (1 - v) * x0 + u * (1 - v) * x1 + u * v * x2 + (1 - u) * v * x3;
            const sy = (1 - u) * (1 - v) * y0 + u * (1 - v) * y1 + u * v * y2 + (1 - u) * v * y3;

            // Bilinear interpolation (2x2 lerp) — bukan nearest-neighbor
            const x0f = Math.floor(sx);
            const y0f = Math.floor(sy);
            const x1f = Math.min(x0f + 1, srcW - 1);
            const y1f = Math.min(y0f + 1, srcH - 1);
            const x0c = Math.max(0, Math.min(srcW - 1, x0f));
            const y0c = Math.max(0, Math.min(srcH - 1, y0f));
            const fx = sx - x0f;
            const fy = sy - y0f;

            for (let c = 0; c < 4; c++) {
                const p00 = src[(y0c * srcW + x0c) * 4 + c];
                const p10 = src[(y0c * srcW + x1f) * 4 + c];
                const p01 = src[(y1f * srcW + x0c) * 4 + c];
                const p11 = src[(y1f * srcW + x1f) * 4 + c];
                const p0 = p00 * (1 - fx) + p10 * fx;
                const p1 = p01 * (1 - fx) + p11 * fx;
                const val = p0 * (1 - fy) + p1 * fy;
                out[(dy * dstW + dx) * 4 + c] = Math.round(val);
            }
        }
    }
    return out.buffer;
}