const MODEL = "gemini-2.5-flash";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Gunakan POST." });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY belum diatur di Vercel Environment Variables." });

  try {
    const { transcript, language = "Bahasa Indonesia", style = "Hook kuat / viral", clipSeconds = 30, videoDuration = 600 } = req.body || {};
    if (typeof transcript !== "string" || transcript.trim().length < 20) {
      return res.status(400).json({ error: "Transkrip terlalu pendek. Tempel transkrip video terlebih dahulu." });
    }
    if (transcript.length > 45000) return res.status(413).json({ error: "Transkrip terlalu panjang. Batasi maksimal 45.000 karakter." });

    const prompt = `Kamu adalah editor video pendek profesional. Berdasarkan transkrip yang diberikan, usulkan 3 kandidat klip untuk video vertikal. Bahasa narasi: ${language}. Gaya: ${style}. Target durasi per klip: sekitar ${clipSeconds} detik. Durasi total video sumber: ${videoDuration} detik.
PENTING: Jangan mengarang fakta yang tidak ada di transkrip. Pilih ide hook yang kuat. Keluarkan JSON valid saja dengan format:
{"clips":[{"title":"judul singkat","start":0,"end":30,"reason":"mengapa bagian ini menarik","narration":"narasi ringkas berdasarkan transkrip"}]}
Start/end adalah detik numerik, harus start >= 0, end > start, end <= durasi sumber. Jika transkrip berisi timestamp, gunakan itu sebagai petunjuk. Jika tidak, perkiraan timestamp hanya kandidat kasar dan tidak boleh diklaim akurat. Buat 3 klip yang berbeda. Narasi maksimal 2-3 kalimat. Durasi target sekitar ${clipSeconds} detik.

TRANSKRIP:
${transcript.trim()}`;

    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.4 }
      })
    });
    const payload = await upstream.json();
    if (!upstream.ok) {
      const message = payload?.error?.message || "Gemini API request gagal.";
      return res.status(upstream.status === 429 ? 429 : 502).json({ error: message });
    }
    const raw = payload?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return res.status(502).json({ error: "AI mengembalikan format yang tidak valid. Coba lagi." }); }
    const maxDuration = Math.max(1, Number(videoDuration) || 600);
    const maxClip = Math.max(5, Math.min(90, Number(clipSeconds) || 30));
    const clips = (Array.isArray(parsed.clips) ? parsed.clips : []).slice(0, 3).map((c, i) => {
      let start = Number(c.start), end = Number(c.end);
      if (!Number.isFinite(start)) start = i * maxClip;
      if (!Number.isFinite(end)) end = start + maxClip;
      start = Math.max(0, Math.min(maxDuration - 1, Math.floor(start)));
      end = Math.max(start + 1, Math.min(maxDuration, Math.floor(end)));
      if (end - start > maxClip * 2) end = Math.min(maxDuration, start + maxClip);
      return {
        title: String(c.title || `Klip ${i + 1}`).slice(0, 120),
        start, end,
        reason: String(c.reason || "").slice(0, 500),
        narration: String(c.narration || "").slice(0, 1200)
      };
    });
    if (!clips.length) return res.status(502).json({ error: "Tidak ada kandidat klip pada hasil AI." });
    return res.status(200).json({ clips, model: MODEL, note: "Timestamp dari AI adalah kandidat perkiraan. Periksa dan sesuaikan sebelum export." });
  } catch (err) {
    return res.status(500).json({ error: "Kesalahan backend saat menganalisis transkrip." });
  }
}