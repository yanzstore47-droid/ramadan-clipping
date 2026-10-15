# RAMADAN CLIPPING

Starter project untuk GitHub + Vercel dengan:
- Frontend responsif
- API backend `/api/analyze` yang memanggil Gemini API secara server-side
- FFmpeg.wasm untuk memotong dan mengenkode file video lokal menjadi MP4
- Pilihan rasio 9:16, 1:1, dan 16:9
- Kandidat klip, narasi AI, serta tombol download

## Batasan yang perlu diketahui
1. **Sumber video pada versi ini adalah file yang kamu upload dari perangkat**, bukan URL YouTube. Link saja tidak memberi akses legal/teknis untuk mengunduh file sumber.
2. AI memakai transkrip yang ditempel pengguna. Transkripsi otomatis dari audio belum termasuk; tambahkan layanan speech-to-text jika diperlukan.
3. Timestamp yang dibuat AI berdasarkan transkrip tanpa timestamp merupakan perkiraan. Periksa waktu mulai/akhir sebelum ekspor.
4. FFmpeg.wasm bekerja di browser. Video panjang/resolusi tinggi membutuhkan RAM dan waktu cukup besar; coba file pendek dulu.
5. Gemini API memiliki free-tier/kuota yang dapat berubah. "Gratis" berarti memakai kuota gratis yang tersedia, bukan jaminan penggunaan tanpa batas.
6. Jangan gunakan API key di frontend. Simpan `GEMINI_API_KEY` sebagai environment variable di Vercel.
7. Gunakan hanya video yang kamu miliki atau punya izin untuk mengeditnya.

## Deploy ke Vercel
1. Upload semua file/folder repository ini ke GitHub.
2. Impor repository di https://vercel.com/new
3. Vercel biasanya mendeteksi Vite. Build command `npm run build`; output directory `dist`.
4. Di Project Settings → Environment Variables, tambahkan:
   - Name: `GEMINI_API_KEY`
   - Value: API key dari https://aistudio.google.com/
   Pilih Production (dan Preview jika perlu), lalu redeploy.
5. Buka domain Vercel. Upload video milikmu, tempel transkrip, klik Analisis dengan Gemini AI, pilih timestamp, lalu potong MP4.

## Tes lokal
```bash
npm install
npm run dev
```
Untuk endpoint API secara lokal, gunakan Vercel CLI:
```bash
npm i -g vercel
vercel dev
```
Atur `GEMINI_API_KEY` di environment lokal atau buat `.env` (jangan commit file `.env`).

## Struktur
```text
ramadan-clipping/
├── api/
│   └── analyze.js
├── src/
│   ├── main.js
│   └── style.css
├── index.html
├── package.json
├── vercel.json
├── .env.example
└── README.md
```
