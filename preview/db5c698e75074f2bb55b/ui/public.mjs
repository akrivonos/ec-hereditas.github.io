import {activeAccount} from '../data/model.mjs?v=20261002-wf15';
import {publicView,publicSearch,publicResources,publicDownload,collectionView,collectionOwned,publicCitationVisible,publicExportDownload} from '../data/public.mjs?v=20261002-wf15';
import {wizard} from './wizard.mjs?v=20261002-wf15';

export function publicPages(ctx){
 const {s,actor,esc,pg,button,panel,heading,shell,dialog,render,flash,dispatch}=ctx,st=s(),t=st.tables,p=new URLSearchParams(location.search),signed=!!activeAccount(st,actor);
 const by=(type,id)=>t[type].find(x=>x.id===id),rev=id=>by('entity',id)?.current_revision_id;
 const link=(n,label,q={})=>`<a href="${pg(n,{role:'R05',...q})}">${esc(label)}</a>`,go=(n,q={})=>location.assign(pg(n,{role:'R05',...q}));
 const query=()=>({q:p.get('q')||'',category:p.get('category')||'',place:p.get('place')||'',collection:p.get('collection')||''});
 const body=html=>`<div class="panel-body">${html}</div>`;
 const table=(heads,rows,empty='Нічого не знайдено.')=>rows.length?`<div class="table-wrap media-table"><table><thead><tr>${heads.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((x,i)=>`<td data-label="${esc(heads[i])}">${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:body(`<p class="muted">${esc(empty)}</p>`);
 const details=rows=>`<dl class="detail-list">${rows.map(([label,v])=>`<div><dt>${esc(label)}</dt><dd>${esc(v||'Не зазначено')}</dd></div>`).join('')}</dl>`;
 const input=(name,label,value='',multiline=false,required=false)=>`<label>${esc(label)}${multiline?`<textarea name="${name}" ${required?'required':''}>${esc(value)}</textarea>`:`<input name="${name}" value="${esc(value)}" ${required?'required':''}>`}</label>`;
 const actions={},act=(key,fn)=>actions[key]=fn,btn=(label,key,enabled=true)=>`<button class="button secondary small" type="button" data-public-action="${key}" ${enabled?'':'disabled'}>${esc(label)}</button>`;
 const show=html=>{shell(html);document.querySelectorAll('[data-public-action]').forEach(el=>el.onclick=async()=>{try{await actions[el.dataset.publicAction]?.();}catch(e){flash(e.message,'error');render();}});};
 const done=message=>{flash(message);render();};
 const loginLink=(page=53,id=null,action=null)=>button('Увійти',pg(63,{role:'R05',return:'PG-'+page,returnId:id,returnAction:action}));
 const collections=()=>t.user_collection.filter(x=>collectionOwned(st,actor,x.id));
 const unavailable=()=>show(heading('Архів','Матеріал недоступний','Посилання зберігається, але матеріал зараз не можна переглянути.')+body('<p>Матеріал міг бути знятий з публікації або його доступ змінився.</p>')+button('До каталогу',pg(49,{role:'R05'})));
 const signIn=(title,n)=>show(heading('Мої матеріали',title,'Увійдіть, щоб зберігати власні добірки й бібліографію.')+panel('Збережіть обране',body('<p>Добірки та нотатки бачить лише їхній власник.</p>'+loginLink(n,p.get('id')))));
 const form=(title,html,cmd,after)=>dialog(title,html,async fd=>{const row=await dispatch(cmd(Object.fromEntries(fd)));if(after)after(row);else done('Зміни збережено.');});
 const saveFile=file=>{if(!file)throw new Error('Завантаження недоступне.');const url=URL.createObjectURL(new Blob([file.content],{type:file.mime})),a=document.createElement('a');a.href=url;a.download=file.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const materialRows=rows=>table(['Матеріал','Місце','Період'],rows.map(x=>[link(50,x.title,{id:x.id,...query()})+`<span class="sub">${esc(x.category||'')}</span>`,esc(x.place||'—'),esc(x.period||'—')]),'За цими умовами матеріалів немає. Спробуйте інший запит або приберіть фільтри.');
 const searchForm=(full=false)=>{
  const all=publicSearch(st),q=query(),choices=(key)=>[...new Set(all.map(x=>x[key]).filter(Boolean))].sort().map(v=>`<option value="${esc(v)}" ${v===q[key]?'selected':''}>${esc(v)}</option>`).join('');
  return `<form class="filters" action="${pg(49)}"><input type="hidden" name="role" value="R05"><input type="hidden" name="collection" value="${esc(q.collection)}">${input('q','Знайти матеріал',q.q)}${full?`<label>Тема<select name="category"><option value="">Усі теми</option>${choices('category')}</select></label><label>Місце<select name="place"><option value="">Усі місця</option>${choices('place')}</select></label>`:''}<button class="button">Знайти</button></form>`;
 };
 function home(){
  const rows=publicSearch(st),categories=[...new Set(rows.map(x=>x.category).filter(Boolean))],contexts=publicSearch(st,{kind:''}).filter(x=>x.kind!=='material');
  show(heading('Архів культурної спадщини','Відкрийте живу традицію','Шукайте пісні, спогади, аудіозаписи, відео та фото. Відкрийте матеріал, дізнайтеся про його контекст і збережіть у власну добірку.')+searchForm()+
   `<nav class="journey-filters" aria-label="Теми">${categories.map(x=>link(49,x,{category:x})).join('')}</nav>`+
   panel('Матеріали архіву',materialRows(rows),link(49,'Увесь каталог →'))+
   panel('Дізнатися більше',table(['Контекст','Опис'],contexts.map(x=>[link(52,x.title,{id:x.id}),esc(x.summary||'')]))));
 }
 function catalog(){show(heading('Архів','Каталог матеріалів','Пошук охоплює лише доступні публікації. Відкрийте матеріал, щоб прочитати опис, переглянути джерело або зберегти його.')+searchForm(true)+
  `<div class="public-results"><span>Знайдено: ${publicSearch(st,query()).length}</span>${link(49,'Очистити фільтри')}</div>`+panel('Матеріали',materialRows(publicSearch(st,query()))));}
 function saveToCollection(pub){
  if(!signed){dialog('Зберегти матеріал',body('<p>Увійдіть, щоб додати матеріал до приватної добірки.</p>'+loginLink(50,pub.id,'save')),null,'Закрити');return;}
  const rows=collections(),selected=rows.find(x=>x.id===p.get('collection'))?.id;const d=wizard({dialog,esc},{title:'Зберегти до добірки',submit:'Зберегти матеріал',steps:[
   {title:'Оберіть добірку',body:details([['Матеріал',pub.title]])+`<label>Добірка<select name="collection"><option value="new">Створити нову</option>${rows.map(x=>`<option value="${x.id}" ${x.id===selected?'selected':''}>${esc(x.title)}</option>`).join('')}</select></label><div data-new-title ${selected?'hidden':''}>${input('title','Назва нової добірки','',false,!selected)}</div>`},
   {title:'Власна нотатка',body:input('note','Чому зберігаєте цей матеріал','',true)}
  ],summary:v=>details([['Матеріал',pub.title],['Добірка',v.collection==='new'?v.title:rows.find(x=>x.id===v.collection)?.title],['Нотатка',v.note]]),onSubmit:async v=>{const row=await dispatch(v.collection==='new'?{type:'public.collection.create',title:v.title,publication_id:pub.id,note:v.note}:{type:'public.collection.add',id:v.collection,expected_revision_id:rev(v.collection),publication_id:pub.id,note:v.note});go(54,{id:row.id});}});
  d.querySelector('[name=collection]').onchange=e=>{const isNew=e.target.value==='new';d.querySelector('[data-new-title]').hidden=!isNew;d.querySelector('[name=title]').required=isNew;};
 }
 function cite(pub){
  const current=publicView(s(),pub.id,'cite');if(!current)throw new Error('Цитування недоступне.');
  const text=`${current.title}. ${current.attribution||''}. ${current.period||''}. ${pg(50,{role:'R05',id:current.id})}`;
  const d=dialog('Цитувати матеріал',`<label>Текст цитування<textarea readonly rows="5">${esc(text)}</textarea></label>`+(signed?'<button type="button" class="button secondary" data-keep-citation>Зберегти до цитувань</button>':''),async()=>{if(!publicView(s(),pub.id,'cite'))throw new Error('Цитування недоступне.');await navigator.clipboard.writeText(text);done('Цитування скопійовано.');},'Скопіювати');
  d.querySelector('[data-keep-citation]')?.addEventListener('click',async e=>{e.target.disabled=true;try{await dispatch({type:'public.citation',publication_id:pub.id});d.close();go(55);}catch(error){e.target.disabled=false;d.querySelector('[role=alert]').textContent=error.message;}});
 }
 function material(){
  if(!p.has('id'))return catalog();const x=publicView(st,p.get('id'));if(!x)return unavailable();if(x.kind!=='material')return context();
  const resources=publicResources(st,x.id),co=p.get('collection'),back=co&&collectionOwned(st,actor,co)?link(54,'← До добірки',{id:co}):link(49,'← До каталогу',query());
  act('save',()=>saveToCollection(x));act('cite',()=>cite(x));act('link',()=>dialog('Посилання на матеріал',`<label>Посилання<input readonly value="${esc(pg(50,{role:'R05',id:x.id}))}"></label>`,async()=>{await navigator.clipboard.writeText(pg(50,{role:'R05',id:x.id}));done('Посилання скопійовано.');},'Скопіювати'));
  show(back+heading('Матеріал',x.title,'Перегляньте опис і доступні ресурси. Збереження до добірки не змінює умов використання.',`<div class="public-actions">${btn('Зберегти до добірки','save')}${btn('Цитувати','cite',!!publicView(st,x.id,'cite'))}${btn('Поділитися посиланням','link')}</div>`)+
   panel('Про матеріал',body(`<p class="source-text">${esc(x.summary||'')}</p>`+details([['Тема',x.category],['Місце',x.place],['Період',x.period],['Джерело',x.attribution]])))+
   panel('Перегляд джерела',resources.length?body(button('Відкрити перегляд',pg(51,{role:'R05',id:x.id,...query(),collection:co}))) :body('<p>Зараз доступний опис. Текст або медіа не оприлюднено.</p>'))+
   panel('Контекст',table(['Дізнатися більше'],(x.context_ids||[]).map(id=>publicView(st,id)).filter(Boolean).map(c=>[link(52,c.title,{id:c.id,material:x.id,...query()})]),'Публічних відомостей про контекст поки немає.'))+
   panel('Використання',body(`<p>${esc(x.terms||'Умови використання не зазначено.')}</p>`)));
  if(p.get('save')==='1'){const next=new URL(location.href);next.searchParams.delete('save');history.replaceState(null,'',next);saveToCollection(x);}
 }
 function viewer(){
  if(!p.has('id'))return catalog();const x=publicView(st,p.get('id'));if(!x)return unavailable();const resources=publicResources(st,x.id),r=resources.find(r=>r.file_id===p.get('file'))||(!p.has('file')?resources[0]:null);
  act('larger',()=>{const el=document.querySelector('.public-reader');el.style.fontSize=Math.min(30,parseFloat(getComputedStyle(el).fontSize)+2)+'px';});
  act('smaller',()=>{const el=document.querySelector('.public-reader');el.style.fontSize=Math.max(14,parseFloat(getComputedStyle(el).fontSize)-2)+'px';});
  act('download',()=>saveFile(publicDownload(s(),x.id,r?.file_id)));
  show(link(50,'← До опису матеріалу',{id:x.id,...query(),collection:p.get('collection')})+heading('Перегляд джерела',x.title,'Оберіть доступну сторінку. Розмір тексту змінюється кнопками; завантаження доступне лише за окремим дозволом.')+
   (r?`<nav class="record-tabs" aria-label="Сторінки джерела">${resources.map(v=>link(51,'Сторінка '+v.position,{id:x.id,file:v.file_id,...query(),collection:p.get('collection')})).join('')}</nav><div class="public-actions">${btn('Збільшити текст','larger')}${btn('Зменшити текст','smaller')}${btn('Завантажити текст','download',!!publicDownload(st,x.id,r.file_id))}</div>`+
    panel(r.label,body(`<article class="source-text public-reader" aria-label="Текст джерела">${esc(r.content)}</article>`))+body(`<p>${esc(x.terms||'')}</p>`):panel('Перегляд недоступний',body('<p>Цей ресурс зараз не оприлюднений.</p>'))));
 }
 function context(){
  if(!p.has('id'))return show(heading('Архів','Контексти','Оберіть архів, місце або особу, щоб переглянути публічні відомості.')+panel('Контексти',table(['Назва'],publicSearch(st,{kind:''}).filter(x=>x.kind!=='material').map(x=>[link(52,x.title,{id:x.id})]))));
  const x=publicView(st,p.get('id'));if(!x||x.kind==='material')return unavailable();const related=publicSearch(st).filter(v=>v.context_ids?.includes(x.id)),back=p.get('material')&&publicView(st,p.get('material'));
  show((back?link(50,'← До матеріалу',{id:back.id,...query()}):link(49,'← До каталогу',query()))+heading('Контекст',x.title,'Тут наведено оприлюднений контекст і матеріали, пов’язані з ним.')+panel('Про цей контекст',body(`<p class="source-text">${esc(x.summary||'')}</p>`))+panel('Пов’язані матеріали',materialRows(related)));
 }
 function collectionList(){
  if(!signed)return signIn('Мої добірки',53);
  act('new',()=>form('Створити добірку',input('title','Назва добірки','',false,true),v=>({type:'public.collection.create',...v}),r=>go(54,{id:r.id})));
  const rows=collections().filter(x=>x.title.toLocaleLowerCase('uk').includes((p.get('q')||'').toLocaleLowerCase('uk')));
  rows.forEach(x=>{
   act('rename-'+x.id,()=>form('Перейменувати добірку',input('title','Назва добірки',x.title,false,true),v=>({type:'public.collection.rename',id:x.id,expected_revision_id:rev(x.id),...v})));
   act('delete-'+x.id,()=>dialog('Видалити добірку',`<p>Видалити приватну добірку «${esc(x.title)}» та її нотатки з вашого списку?</p>`,async()=>{await dispatch({type:'public.collection.delete',id:x.id,expected_revision_id:rev(x.id)});done('Добірку видалено.');},'Видалити'));
  });
  show(heading('Мої матеріали','Мої добірки','Добірки й нотатки доступні тільки вам. Відкрийте добірку, щоб змінити порядок матеріалів або підготувати бібліографію.',btn('Створити добірку','new'))+
   `<form class="filters"><input type="hidden" name="role" value="R05">${input('q','Знайти добірку',p.get('q')||'')}<button class="button">Знайти</button></form>`+
   panel('Добірки',table(['Назва','Матеріалів','Дії'],rows.map(x=>[link(54,x.title,{id:x.id}),String(t.user_collection_item.filter(i=>i.collection_id===x.id).length),btn('Перейменувати','rename-'+x.id)+btn('Видалити','delete-'+x.id)]),'Добірок ще немає. Збережіть матеріал із каталогу або створіть порожню добірку.')));
 }
 function exportWizard(collection=null){
  const citations=t.citation.filter(x=>publicCitationVisible(st,actor,x));
  wizard({dialog,esc},{title:'Експортувати бібліографію',submit:'Підготувати файл',steps:[
   {title:'Склад бібліографії',body:collection?details([['Добірка',collection.title],['Матеріали',collection.items.map(x=>x.publication?.title||'Матеріал недоступний').join('\n')]]):`<fieldset><legend>Цитування</legend>${citations.map(x=>`<label class="check-label"><input type="checkbox" name="citations" value="${x.id}" checked>${esc(publicView(st,x.target_entity_id).title)}</label>`).join('')}</fieldset>`},
   {title:'Формат файла',body:'<label>Формат<select name="format"><option value="text">Текст (.txt)</option><option value="csl_json">CSL JSON (.json)</option></select></label>'}
  ],summary:v=>details([['Склад',collection?collection.title:String(v.citations?.length||0)+' цитувань'],['Формат',v.format==='text'?'Текст':'CSL JSON']]),onSubmit:async v=>{await dispatch({type:'public.export',collection_id:collection?.id,expected_revision_id:collection?.revision_id,citation_ids:v.citations||[],format:v.format});go(55);}});
 }
 function collection(){
  if(!p.has('id'))return collectionList();if(!signed)return signIn('Моя добірка',54);
  const c=collectionView(st,actor,p.get('id'));if(!c)return show(heading('Мої матеріали','Добірка недоступна','Добірку може відкрити лише її власник.')+button('Мої добірки',pg(53,{role:'R05'})));
  act('export',()=>exportWizard(c));c.items.forEach(i=>{
   act('note-'+i.publication_id,()=>form('Власна нотатка',input('note','Нотатка',i.note||'',true),v=>({type:'public.collection.note',id:c.id,expected_revision_id:c.revision_id,publication_id:i.publication_id,...v})));
   act('remove-'+i.publication_id,()=>dialog('Прибрати матеріал',`<p>Прибрати ${i.restricted?'недоступний матеріал':`«${esc(i.publication.title)}»`} із цієї добірки?</p>`,async()=>{await dispatch({type:'public.collection.remove',id:c.id,expected_revision_id:c.revision_id,publication_id:i.publication_id});done('Матеріал прибрано з добірки.');},'Прибрати'));
   for(const [name,direction]of [['up',-1],['down',1]])act(name+'-'+i.publication_id,async()=>{await dispatch({type:'public.collection.move',id:c.id,expected_revision_id:c.revision_id,publication_id:i.publication_id,direction});done('Порядок оновлено.');});
  });
  show(link(53,'← Мої добірки')+heading('Приватна добірка',c.title,'Змінюйте порядок, додавайте власні нотатки та експортуйте бібліографію. Недоступні матеріали зберігаються як посилання; перед експортом приберіть їх зі складу.',`<div class="public-actions">${button('Додати з каталогу',pg(49,{role:'R05',collection:c.id}))}${btn('Експортувати бібліографію','export',c.items.length>0&&c.items.every(x=>!x.restricted&&publicView(st,x.publication_id,'cite')))}</div>`)+
   panel('Матеріали',table(['Матеріал','Нотатка','Порядок','Дії'],c.items.map((i,index)=>[i.restricted?'Матеріал недоступний':link(50,i.publication.title,{id:i.publication_id,collection:c.id}),i.restricted?'—':esc(i.note||'—'),btn('Вище','up-'+i.publication_id,index>0)+btn('Нижче','down-'+i.publication_id,index<c.items.length-1),(!i.restricted?btn('Нотатка','note-'+i.publication_id):'')+btn('Прибрати','remove-'+i.publication_id)]),'Добірка порожня. Відкрийте каталог і збережіть потрібні матеріали.')));
 }
 function exports(){
  if(!signed)return signIn('Цитування та експорт',55);
  const rows=t.citation.filter(x=>publicCitationVisible(st,actor,x)),files=t.bibliographic_export.filter(x=>x.requested_by===actor&&x.export_profile_version==='public-1');
  rows.forEach(x=>act('cite-'+x.id,()=>cite(publicView(st,x.target_entity_id))));files.forEach(x=>act('download-'+x.id,()=>saveFile(publicExportDownload(s(),actor,x.id))));act('export',()=>exportWizard());
  show(heading('Мої матеріали','Цитування та експорт','Скопіюйте цитування або збережіть бібліографію у файл. Якщо публікація чи умови доступу змінилися, підготуйте нове цитування.',btn('Експортувати бібліографію','export',rows.length>0))+
   panel('Мої цитування',table(['Матеріал','Дія'],rows.map(x=>[link(50,publicView(st,x.target_entity_id).title,{id:x.target_entity_id}),btn('Скопіювати','cite-'+x.id)]),'Збережіть цитування зі сторінки матеріалу або експортуйте добірку.'))+
   panel('Підготовлені файли',table(['Формат','Стан','Дія'],files.map(x=>[x.format==='text'?'Текст':'CSL JSON',publicExportDownload(st,actor,x.id)?'Готово':'Доступ змінився',btn('Завантажити','download-'+x.id,!!publicExportDownload(st,actor,x.id))]),'Підготовлених файлів ще немає.')));
 }
 return {'PG-48':home,'PG-49':catalog,'PG-50':material,'PG-51':viewer,'PG-52':context,'PG-53':collectionList,'PG-54':collection,'PG-55':exports};
}
