import './style.css';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const $ = (id) => document.getElementById(id);
let selectedFile = null;
let selectedClip = null;
let ffmpeg = null;
let outputUrl = null;
let videoDuration = 0;
const clips = [];

$('videoFile').addEventListener('change', () => {
  selectedFile = $('videoFile').files?.[0] || null;
  if (!selectedFile) { $('fileInfo').textContent = 'Pilih file video milikmu.'; return; }
  const size = (selectedFile.size / 1024 / 1024).toFixed(1);
  const url = URL.createObjectURL(selectedFile);
  const probe = document.createElement('video');
  probe.preload = 'metadata';
  probe.onloadedmetadata = () => {
    videoDuration = probe.duration || 0;
    $('fileInfo').textContent = `${selectedFile.name} • ${size} MB • durasi ${formatTime(videoDuration)}. Pemrosesan berlangsung di browser.`;
    URL.revokeObjectURL(url);
    $('endTime').value = Math.min(Number($('duration').value), Math.floor(videoDuration || 30));
  };
  probe.onerror = () => { $('fileInfo').textContent = `${selectedFile.name} • ${size} MB`; };
  probe.src = url;
});

function formatTime(s) {
  s = Math.max(0, Math.floor(Number(s) || 0));
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
function secondsFromTimestamp(value) {
  if (typeof value === 'number') return value;
  const m = String(value || '').match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{2})/);
  if (!m) return NaN;
  return Number(m[1] || 0)*3600 + Number(m[2])*60 + Number(m[3]);
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function renderClips(items) {
  clips.splice(0, clips.length, ...items);
  if (!items.length) { $('clips').className='empty'; $('clips').textContent='AI belum mengembalikan kandidat klip.'; return; }
  $('clips').className='';
  $('clips').innerHTML = items.map((c,i)=>`
    <article class="clip">
      <div class="meta">KANDIDAT ${i+1} • ${escapeHtml(formatTime(c.start))}–${escapeHtml(formatTime(c.end))}</div>
      <h3>${escapeHtml(c.title || `Klip ${i+1}`)}</h3>
      <p>${escapeHtml(c.reason || '')}</p>
      <p><b>Narasi:</b> ${escapeHtml(c.narration || '')}</p>
      <button class="secondary choose" data-i="${i}">Pakai timestamp ini</button>
      <button class="secondary copy" data-i="${i}">Salin narasi</button>
    </article>`).join('');
  document.querySelectorAll('.choose').forEach(b=>b.addEventListener('click',()=>{
    selectedClip = clips[Number(b.dataset.i)];
    $('startTime').value = selectedClip.start;
    $('endTime').value = selectedClip.end;
    $('cutStatus').textContent = `Timestamp dipilih: ${selectedClip.title}. Periksa sebelum memotong.`;
  }));
  document.querySelectorAll('.copy').forEach(b=>b.addEventListener('click',async()=>{
    const text=clips[Number(b.dataset.i)].narration || '';
    try { await navigator.clipboard.writeText(text); $('aiStatus').textContent='Narasi disalin.'; }
    catch { window.prompt('Salin narasi ini:', text); }
  }));
}
$('analyzeBtn').addEventListener('click', async ()=>{
  const transcript=$('transcript').value.trim();
  if (!transcript) { $('aiStatus').textContent='Tempel transkrip terlebih dahulu. AI belum otomatis mentranskripsi audio.'; return; }
  const btn=$('analyzeBtn'); btn.disabled=true; btn.textContent='⏳ AI sedang menganalisis...';
  $('aiStatus').textContent='Menghubungi Gemini API...';
  try {
    const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      transcript, language:$('language').value, style:$('style').value,
      clipSeconds:Number($('duration').value), videoDuration:videoDuration || 600
    })});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error || 'Permintaan AI gagal.');
    renderClips(data.clips || []);
    $('aiStatus').textContent=`Gemini membuat ${data.clips?.length || 0} kandidat. Timestamp adalah perkiraan; periksa sebelum export.`;
  } catch(e) {
    $('aiStatus').textContent=`Gagal: ${e.message}. Pastikan GEMINI_API_KEY sudah diatur di Vercel.`;
  } finally { btn.disabled=false; btn.textContent='✦ ANALISIS DENGAN GEMINI AI'; }
});
$('demoBtn').addEventListener('click',()=>{
  const d=Math.max(1,Math.floor(videoDuration || 120));
  const len=Math.min(Number($('duration').value),d);
  renderClips([
    {title:'Hook pembuka',start:0,end:len,narration:'Mulai dengan hook yang kuat sesuai isi video. Ganti dengan narasi yang akurat.',reason:'Contoh kandidat untuk menguji pemotongan.'},
    {title:'Highlight utama',start:Math.max(0,Math.floor(d*.35)),end:Math.min(d,Math.floor(d*.35)+len),narration:'Rangkum satu insight utama dari video.',reason:'Contoh kandidat; cek timestamp.'},
    {title:'Penutup',start:Math.max(0,d-len),end:d,narration:'Akhiri dengan kesimpulan singkat dan ajakan komentar yang relevan.',reason:'Contoh kandidat; cek timestamp.'}
  ]);
  $('aiStatus').textContent='Mode contoh aktif; bukan hasil analisis AI.';
});
async function loadFFmpeg() {
  if(ffmpeg) return ffmpeg;
  $('cutStatus').textContent='Memuat mesin FFmpeg WebAssembly (pertama kali bisa agak lama)...';
  ffmpeg = new FFmpeg();
  ffmpeg.on('progress', ({progress}) => {
    if(Number.isFinite(progress)) $('cutStatus').textContent=`Memproses video: ${Math.round(progress*100)}%`;
  });
  const base='https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`,'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`,'application/wasm')
  });
  return ffmpeg;
}
$('cutBtn').addEventListener('click', async ()=>{
  if(!selectedFile) { $('cutStatus').textContent='Pilih file video terlebih dahulu. URL YouTube saja tidak dapat dipotong oleh browser.'; return; }
  const start=Number($('startTime').value), end=Number($('endTime').value);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start|| (videoDuration && end>videoDuration+0.5)) {
    $('cutStatus').textContent='Timestamp tidak valid. Pastikan akhir lebih besar dari mulai dan tidak melewati durasi video.'; return;
  }
  const btn=$('cutBtn'); btn.disabled=true;
  $('download').hidden=true; $('preview').hidden=true;
  try {
    const engine=await loadFFmpeg();
    const ext=(selectedFile.name.split('.').pop()||'mp4').toLowerCase().replace(/[^a-z0-9]/g,'') || 'mp4';
    const inputName=`input.${ext}`, outputName='ramadan-clipping.mp4';
    $('cutStatus').textContent='Menyalin file ke mesin pemrosesan...';
    await engine.writeFile(inputName, new Uint8Array(await selectedFile.arrayBuffer()));
    const ratio=$('ratio').value;
    let vf;
    if(ratio==='9:16') vf="scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280";
    else if(ratio==='1:1') vf="scale=720:720:force_original_aspect_ratio=increase,crop=720:720";
    else vf="scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720";
    $('cutStatus').textContent='Memotong dan mengenkode MP4. Video besar bisa memerlukan waktu dan RAM yang cukup.';
    await engine.exec(['-ss',String(start),'-i',inputName,'-t',String(end-start),'-vf',vf,'-c:v','libx264','-preset','ultrafast','-crf','26','-c:a','aac','-b:a','128k','-movflags','+faststart',outputName]);
    const bytes=await engine.readFile(outputName);
    const blob=new Blob([bytes.buffer],{type:'video/mp4'});
    if(outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl=URL.createObjectURL(blob);
    $('preview').src=outputUrl; $('preview').hidden=false;
    $('download').href=outputUrl; $('download').hidden=false;
    $('cutStatus').textContent=`Selesai! MP4 ${(blob.size/1024/1024).toFixed(1)} MB. File diproses secara lokal di browser.`;
    await engine.deleteFile(inputName); await engine.deleteFile(outputName);
  } catch(e) {
    $('cutStatus').textContent=`Pemrosesan gagal: ${e.message || e}. Coba video lebih pendek/kecil atau perangkat dengan RAM lebih besar.`;
  } finally { btn.disabled=false; }
});
