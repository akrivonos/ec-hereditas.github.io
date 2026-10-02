import {transferFiles,transferProblems,verifyTransferBundle} from '../data/handover.mjs?v=20261002-wf17';
import {handoverState} from '../data/media.mjs?v=20261002-wf17';
import {hash} from '../data/model.mjs?v=20261002-wf17';
import {download} from './session-media.mjs?v=20261002-wf17';

async function readBundle(file){if(!file?.size||file.size>32*1024*1024)throw Error('Оберіть файл пакета до 32 МБ.');let bundle;try{bundle=JSON.parse(await file.text());}catch{throw Error('Не вдалося прочитати файл пакета.');}await verifyTransferBundle(bundle);return bundle;}
export function inspectTransfer({dialog,esc,table,body}){
 dialog('Перевірити отриманий пакет','<label>Файл пакета<input type="file" name="bundle" accept=".json" required></label>',async fd=>{
  const bundle=await readBundle(fd.get('bundle'));setTimeout(()=>{
   const p=bundle.payload,d=dialog('Пакет перевірено',body(`<p>Контрольні суми файлів і зафіксованих описів збігаються. Елементів: ${p.items.length}; файлів: ${p.files.length}.</p>`)+table(['Файл','Початковий шлях','Дія'],p.files.map((f,i)=>[esc(f.filename),esc(f.origins.map(o=>o.source_path||'Не зазначено').join('; ')),`<button type="button" class="button secondary" data-extract="${i}">Завантажити файл</button>`]))+body(`<p>${esc(p.notes||'')}</p><p>Це перевірка вмісту. Приймання до архіву оформлюється окремо.</p>`),null,'Закрити');
   d.querySelectorAll('[data-extract]').forEach(b=>b.onclick=()=>{const f=p.files[Number(b.dataset.extract)];download(f.content,f.mime_type,f.filename.split(/[\\/]/).at(-1));});
  },0);
 },'Перевірити');
}

export function transferPreflight(c,h){
 const {st,actor,can,archive,action,dialog,input,select,choices,dispatch,flash,render,panel,body,table,details,btn,button,pg,esc}=c;
 const p=h.preflight;if(!p){if(!['prepared','returned'].includes(h.state))return '';action('transfer-begin',async()=>{await dispatch({type:'media.transfer.begin',id:h.id,expected_hash:await hash(handoverState(st,h))});render();});return panel('Перед відправленням',body(btn('Почати звірку','transfer-begin',can(st,actor,'intake.send',archive))));}
 const edit=['prepared','returned'].includes(h.state)&&can(st,actor,'intake.send',archive),files=transferFiles(st,h),problems=transferProblems(st,h);
 const command=async(type,values={})=>dispatch({type:'media.transfer.'+type,id:h.id,expected_hash:await hash(handoverState(st,h)),...values});
 const done=()=>{flash('Звірку збережено.');render();};
 action('preflight',()=>dialog('Звірка перед переданням',input('expected_files','Очікувана кількість файлів',p.expected_files,'number',true)+input('required_copies','Потрібно незалежних копій',p.required_copies,'number',true)+body('<p>Укажіть кількість за вашим планом резервування. Копії на одному носії рахуються як одна.</p>')+'<label class="check-label"><input name="notes_confirmed" type="checkbox" required>Файли зіставлено із сеансом, польові нотатки уточнено</label>',async fd=>{await command('confirm',{expected_files:Number(fd.get('expected_files')),required_copies:Number(fd.get('required_copies')),notes_confirmed:fd.has('notes_confirmed')});done();}));
 action('transfer-issue',()=>dialog('Зафіксувати проблему',select('kind','Тип проблеми',choices({missing:'Пропущений файл',unknown:'Невідомий файл',corrupt:'Пошкоджений файл',doubtful:'Сумнівний файл'}))+input('note','Що потрібно уточнити','','textarea',true),async fd=>{await command('issue',Object.fromEntries(fd));done();}));
 p.issues.filter(x=>!x.resolution).forEach(i=>action('resolve-'+i.id,()=>dialog('Усунути проблему',body(`<p>${esc(i.note)}</p>`)+input('reason','Що виправлено','','textarea',true),async fd=>{await command('resolve',{issue_id:i.id,reason:fd.get('reason')});done();})));
 action('transfer-refresh',()=>dialog('Оновити версії пакета','<p>Зберегти поточні версії вибраних матеріалів? Попередні перевірки копій потрібно буде повторити. Для додавання інших матеріалів підготуйте новий пакет із сеансу.</p>',async()=>{await command('refresh');done();},'Оновити'));
 action('transfer-export',async()=>{const bundle=await command('export');download(JSON.stringify(bundle,null,2),'application/json','Польовий-пакет-'+h.id+'.json');flash('Файл пакета підготовлено до збереження.');render();});
 action('transfer-backup',()=>dialog('Перевірити збережену копію','<label>Файл пакета<input type="file" name="bundle" accept=".json" required></label>'+input('location','Де збережено копію','','text',true)+input('failure_domain','Окремий носій або сховище','','text',true)+'<label class="check-label"><input type="checkbox" name="independent" required>Копія збережена на вказаному незалежному носії</label>'+body('<p>Обирайте файл саме зі збереженої копії. Вміст перевіряється автоматично; фізичне місце підтверджуєте ви.</p>'),async fd=>{await command('backup',{bundle:await readBundle(fd.get('bundle')),location:fd.get('location'),failure_domain:fd.get('failure_domain'),independent:fd.has('independent')});done();},'Перевірити'));
 const content=panel('Перед відправленням',table(['Файлів / очікується','Потрібно незалежних копій','Звірка та нотатки'],[[files.length+' / '+p.expected_files,String(p.required_copies),p.confirmed?'Підтверджено':'Потребує звірки']])+body(`<div class="actions">${btn('Звірити комплект','preflight',edit)}${btn('Зафіксувати проблему','transfer-issue',edit)}${btn('Оновити версії','transfer-refresh',edit)}${btn('Завантажити пакет','transfer-export',can(st,actor,'intake.send',archive))}${btn('Перевірити копію','transfer-backup',edit)}</div>`+(problems.length?'<ul>'+problems.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>':'<p>Пакет готовий до передання.</p>')))+
 panel('Походження файлів',table(['Первісна назва','Початковий шлях','Розмір'],files.map(f=>[esc(f.original_filename),esc(st.tables.file_ingest_occurrence.filter(o=>o.file_id===f.id).map(o=>o.source_path||'Не зазначено').join('; ')),f.byte_size+' Б'])))+
 panel('Перевірені копії пакета',table(['Місце','Окремий носій','Версія'],p.backups.map(b=>[esc(b.location),esc(b.failure_domain),b.digest===p.export_digest?'Поточна':'Застаріла'])))+
 panel('Проблеми та уточнення',table(['Проблема','Рішення','Дія'],p.issues.map(i=>[esc(i.note),esc(i.resolution||'Не усунено'),button('Відкрити завдання',pg(3,{id:i.task_id}),true)+' '+(!i.resolution?btn('Усунути','resolve-'+i.id,edit):'')])));
 return ['sent','accepted'].includes(h.state)?'<details class="page-help"><summary>Післясеансова звірка та копії</summary>'+content+'</details>':content;
}
