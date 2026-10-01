import {MAX_MEDIA_BYTES,mediaMime,mediaUrl,fileBytes} from '../data/binary.mjs?v=20261001-wf13';
import {recordingGaps} from '../data/session.mjs?v=20261001-wf13';
export function mediaPreview(content,mime,esc,id=''){
 const url=mediaUrl(content,mime);if(!url)return `<pre class="source-text reading-text">${esc(typeof content==='string'?content:'Браузер не підтримує перегляд цього формату. Завантажте оригінал.')}</pre>`;
 return mime.startsWith('image/')?`<img src="${url}" alt="Зображення" style="max-width:100%;max-height:440px;object-fit:contain">`:`<${mime.startsWith('audio/')?'audio':'video'} ${id?`id="${esc(id)}"`:''} controls preload="metadata" src="${url}" style="width:100%;max-height:440px"></${mime.startsWith('audio/')?'audio':'video'}>`;
}
export function download(content,mime,name){const u=URL.createObjectURL(new Blob([fileBytes(content)],{type:mime})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
export async function encode(blob){const bytes=new Uint8Array(await blob.arrayBuffer());let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));return {encoding:'base64',data:btoa(raw)};}
async function duration(blob){
 if(blob.type.startsWith('image/'))return null;
 const u=URL.createObjectURL(blob),m=document.createElement(blob.type.startsWith('audio/')?'audio':'video');
 try{return await new Promise(resolve=>{const done=()=>{clearTimeout(timer);resolve(Number.isFinite(m.duration)&&m.duration>0?Math.round(m.duration*1000):null);},timer=setTimeout(done,3500);m.onloadedmetadata=done;m.onerror=done;m.src=u;});}finally{m.removeAttribute('src');m.load();URL.revokeObjectURL(u);}
}
export function demoWav(){
 const count=16000,b=new ArrayBuffer(44+count*2),v=new DataView(b),word=(off,s)=>[...s].forEach((x,i)=>v.setUint8(off+i,x.charCodeAt(0)));
 word(0,'RIFF');v.setUint32(4,b.byteLength-8,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,count*2,true);
 for(let i=0;i<count;i++)v.setInt16(44+i*2,Math.sin(i*2*Math.PI*(i<8000?440:660)/8000)*1800,true);return new Blob([b],{type:'audio/wav'});
}
export function sessionMediaDialogs(c,r,command){
 const {st,esc,input,select,choices,dialog,dispatch,render,flash,label}=c;
 const saved=async payload=>{await dispatch(command('field.session.media',payload));flash('Медіазапис додано.');render();};
 const common=input('title','Назва запису')+input('source_path','Початковий шлях на носії','','text',false,'Наприклад DCIM/Camera/VID_001.mp4. Браузер не читає повний шлях автоматично; первісна назва файла зберігається без змін.')+input('origin_note','Походження та підстава запису','','textarea',true,'Для імпортованого файла вкажіть, хто й коли записав його та де зберігається згода. Збереження файла не надає дозволу на публікацію.')+input('occurred_at','Коли зроблено запис','','datetime-local')+input('device_model','Пристрій')+input('technical_incidents','Технічні зауваження','','textarea');
 function importDialog(demo=false){
  const accepts={all:'audio/*,video/*,image/png,image/jpeg,image/webp',audio:'audio/*',video:'video/*',photo:'image/png,image/jpeg,image/webp'};
  const d=dialog(demo?'Додати навчальне аудіо':'Додати медіафайл',(demo?'<p>Дві синтетичні ноти, 2 секунди. Можна прослухати й позначити обидві частини.</p>':select('media_kind','Тип матеріалу',choices([['all','Аудіо, відео або фото'],['audio','Аудіо'],['video','Відео'],['photo','Фото']],'all'))+'<label>Файл<input name="media_file" type="file" accept="'+accepts.all+'" required></label>')+common+'<div data-duration>'+input('duration_seconds','Тривалість, секунд (якщо не визначається)','','number',false,'Потрібна для часових позначок; перевірте за оригінальним записом.')+'</div>',async fd=>{
   const blob=demo?demoWav():fd.get('media_file'),mime=blob.type.split(';')[0];if(!mediaMime(mime)||!blob.size||blob.size>MAX_MEDIA_BYTES)throw Error('Оберіть підтримуваний медіафайл до 2 МБ.');
   const kind=mime.startsWith('image/')?'photo':mime.split('/')[0],requested=fd.get('media_kind');
   if(requested&&requested!=='all'&&requested!==kind)throw Error('Файл не відповідає обраному типу матеріалу.');
   const measured=await duration(blob),manual=Number(fd.get('duration_seconds'));await saved({...Object.fromEntries(fd),content:await encode(blob),mime_type:mime,filename:demo?'Навчальні-тони.wav':blob.name,duration_ms:kind==='photo'?null:measured||(manual>0?Math.round(manual*1000):null)});
  });
  if(demo){d.querySelector('[name=title]').value='Навчальне аудіо: дві ноти';d.querySelector('[name=origin_note]').value='Синтетичний приклад для перевірки відтворення й часових позначок; не польовий матеріал.';}
  else {
   const type=d.querySelector('[name=media_kind]'),file=d.querySelector('[name=media_file]');
   const sync=()=>{file.accept=accepts[type.value];const photo=type.value==='photo'||file.files[0]?.type.startsWith('image/');d.querySelector('[data-duration]').hidden=photo;d.querySelector('[name=duration_seconds]').disabled=photo;};
   type.onchange=()=>{file.value='';sync();};file.onchange=sync;
  }
 }
 function recordDialog(kind){
  const gaps=recordingGaps(st,r.id,kind);if(gaps.length)throw Error('Спочатку задокументуйте дозвіл на '+({audio:'аудіозапис',video:'відеозапис',photo:'фотографування'}[kind])+': '+gaps.map(label).join(', ')+'.');
  let stream=null,recorder=null,chunks=[],blob=null,url=null,timer=null,started=0,elapsed=0,pausedAt=0,pausedMs=0,closed=false,pending=false;
  const d=dialog('Записати '+({audio:'аудіо',video:'відео',photo:'фото'}[kind]),common+'<p>Короткий запис: до 30 секунд і 2 МБ. Після зупинки перевірте й збережіть результат.</p><div class="actions"><button type="button" data-record="start" class="button">Увімкнути '+(kind==='audio'?'мікрофон':'камеру')+'</button><button type="button" data-record="pause" class="button secondary" disabled>Пауза</button><button type="button" data-record="stop" class="button secondary" disabled>'+ (kind==='photo'?'Зробити фото':'Зупинити')+'</button><button type="button" data-record="download" class="button secondary" disabled>Завантажити</button></div><p data-status role="status">Пристрій ще не ввімкнено.</p><div data-preview></div>',async fd=>{
   if(!blob||recorder&&recorder.state!=='inactive')throw Error('Спочатку зупиніть запис.');if(blob.size>MAX_MEDIA_BYTES)throw Error('Запис завеликий. Завантажте його та імпортуйте коротший фрагмент.');
   await saved({...Object.fromEntries(fd),content:await encode(blob),mime_type:blob.type.split(';')[0],filename:'Сеанс-'+new Date().toISOString().replace(/[:.]/g,'-')+(kind==='photo'?'.png':blob.type.includes('mp4')?'.mp4':'.webm'),duration_ms:kind==='photo'?null:await duration(blob)||elapsed,live:true});
  });
  const q=x=>d.querySelector('[data-record='+x+']'),status=x=>d.querySelector('[data-status]').textContent=x;
  const release=()=>{clearTimeout(timer);stream?.getTracks().forEach(x=>x.stop());stream=null;};
  const cleanup=()=>{closed=true;if(recorder?.state&&recorder.state!=='inactive')recorder.stop();release();if(url)URL.revokeObjectURL(url);window.removeEventListener('pagehide',cleanup);};d.addEventListener('close',cleanup);d.addEventListener('cancel',cleanup);window.addEventListener('pagehide',cleanup);
  for(const el of d.querySelectorAll('.close,.cancel')){const close=el.onclick;el.onclick=()=>{cleanup();close();};}
  const preview=()=>{release();if(closed)return;url=URL.createObjectURL(blob);d.querySelector('[data-preview]').innerHTML=kind==='photo'?`<img src="${url}" alt="Щойно зроблене фото" style="max-width:100%">`:`<${kind} controls src="${url}" style="max-width:100%"></${kind}>`;q('download').disabled=false;q('stop').disabled=true;q('pause').disabled=true;status('Запис зупинено. Перевірте результат; його ще не збережено.');};
  q('start').onclick=async()=>{if(pending||closed)return;pending=true;q('start').disabled=true;try{
   if(!navigator.mediaDevices?.getUserMedia||kind!=='photo'&&!globalThis.MediaRecorder)throw Error('Браузер не підтримує запис. Скористайтеся додаванням файла.');
   if(!d.querySelector('[name=origin_note]').value.trim())throw Error('Вкажіть походження та підставу запису.');
   stream=await navigator.mediaDevices.getUserMedia({audio:kind!=='photo',video:kind!=='audio'});if(closed){release();return;}
   if(kind==='photo'){const v=document.createElement('video');v.autoplay=true;v.muted=true;v.playsInline=true;v.style.maxWidth='100%';v.srcObject=stream;d.querySelector('[data-preview]').replaceChildren(v);await v.play();}
   else {const candidates=kind==='audio'?['audio/webm;codecs=opus','audio/mp4']:['video/webm;codecs=vp8,opus','video/mp4'],mime=candidates.find(x=>MediaRecorder.isTypeSupported(x));if(!mime)throw Error('Формат запису недоступний у цьому браузері.');recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:64000,videoBitsPerSecond:250000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);if(chunks.reduce((n,x)=>n+x.size,0)>=MAX_MEDIA_BYTES&&recorder.state!=='inactive')stop();};
    recorder.onstop=()=>{blob=new Blob(chunks,{type:mime.split(';')[0]});preview();};recorder.onerror=()=>{status('Запис перервано. Перевірте наявний фрагмент.');stop();};started=performance.now();recorder.start(500);q('pause').disabled=false;timer=setTimeout(stop,30000);
   }q('stop').disabled=false;status(kind==='photo'?'Камеру ввімкнено. Натисніть «Зробити фото».':'Запис триває.');
  }catch(e){release();status(e.name==='NotAllowedError'?'Доступ до пристрою не надано. Можна додати готовий файл.':e.message);q('start').disabled=false;}finally{pending=false;}};
  function stop(){if(recorder&&recorder.state!=='inactive'){elapsed=Math.max(1,Math.round(performance.now()-started-pausedMs-(pausedAt?performance.now()-pausedAt:0)));recorder.stop();release();}}
  q('stop').onclick=()=>{if(kind!=='photo'){stop();return;}const v=d.querySelector('video'),canvas=document.createElement('canvas');canvas.width=v.videoWidth;canvas.height=v.videoHeight;if(!canvas.width){status('Дочекайтеся зображення камери.');return;}canvas.getContext('2d').drawImage(v,0,0);canvas.toBlob(b=>{blob=b;preview();},'image/png');};
  q('pause').onclick=()=>{if(recorder.state==='recording'){recorder.pause();pausedAt=performance.now();q('pause').textContent='Продовжити';status('Запис на паузі.');}else if(recorder.state==='paused'){recorder.resume();pausedMs+=performance.now()-pausedAt;pausedAt=0;q('pause').textContent='Пауза';status('Запис триває.');}};
  q('download').onclick=async()=>download(await encode(blob),blob.type,kind==='photo'?'Фото.png':blob.type.includes('mp4')?'Запис.mp4':'Запис.webm');
 }
 return {importDialog,recordDialog};
}
