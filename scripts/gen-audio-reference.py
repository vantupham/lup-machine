"""
Sinh kết quả tham chiếu từ NumPy / librosa cho phần xử lý âm thanh tự cài đặt (src/core/audio).
Chạy: python scripts/gen-audio-reference.py
Yêu cầu: numpy, librosa.
"""
import json
import pathlib

import librosa
import numpy as np

OUT = pathlib.Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "audio-reference.json"
SR, N_FFT, WIN, HOP, N_MELS = 16000, 512, 400, 160, 40


def main() -> None:
    rng = np.random.default_rng(20261129)
    t = np.arange(SR) / SR
    # tổng các sóng sin (440 Hz, 1250 Hz tắt dần, 3000 Hz ngắn) + tiếng ồn
    y = 0.5 * np.sin(2 * np.pi * 440 * t)
    y += 0.3 * np.exp(-t / 0.3) * np.sin(2 * np.pi * 1250 * t)
    y += np.where((t > 0.4) & (t < 0.6), 0.2 * np.sin(2 * np.pi * 3000 * t), 0)
    y += 0.01 * rng.normal(size=SR)
    y = np.round(y, 6).astype(np.float32)

    frame = y[1000:1000 + N_FFT].astype(np.float64)
    spectrum = np.fft.rfft(frame)
    window = librosa.filters.get_window("hann", WIN, fftbins=True)
    window = librosa.util.pad_center(window, size=N_FFT)
    mel_basis = librosa.filters.mel(sr=SR, n_fft=N_FFT, n_mels=N_MELS, dtype=np.float64)
    stft = librosa.stft(y.astype(np.float64), n_fft=N_FFT, hop_length=HOP, win_length=WIN, window="hann", center=False)
    mel = mel_basis @ (np.abs(stft) ** 2)
    data = {
        "generator": f"librosa {librosa.__version__}, numpy {np.__version__}",
        "signal": y.astype(np.float64).tolist(),
        "frameStart": 1000,
        "rfftRe": spectrum.real.tolist(),
        "rfftIm": spectrum.imag.tolist(),
        "window": window.tolist(),
        "melFilters": mel_basis.tolist(),
        "melFrequencies": librosa.mel_frequencies(n_mels=N_MELS + 2, fmin=0, fmax=SR / 2).tolist(),
        "melSpectrogram": mel.tolist(),
        "melDb": librosa.power_to_db(mel, ref=1.0, amin=1e-10, top_db=None).tolist(),
    }
    OUT.write_text(json.dumps(data) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT} (frames: {mel.shape[1]})")


if __name__ == "__main__":
    main()
