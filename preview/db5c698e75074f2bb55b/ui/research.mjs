import {researchEnabled,owns,sourceView,searchSources,corpusItems,researchVisible,exportDownload} from '../data/research.mjs?v=20261001-wf10';
import {wizard} from './wizard.mjs?v=20261001-wf10';
import {hint} from './help.mjs?v=20261001-wf10';

export function researchPages(ctx){
 const {s,actor,scope,esc,pg,button,panel,heading,shell,dialog,render,flash,dispatch,denied}=ctx,st=s(),t=st.tables,p=new URLSearchParams(location.search);
 const by=(type,id)=>t[type].find(x=>x.id===id),reg=id=>by('entity',id),rev=id=>reg(id)?.current_revision_id;
 const own=type=>t[type].filter(x=>owns(st,actor,x.id)),visible=type=>own(type).filter(x=>researchVisible(st,actor,x,type));
 const link=(n,text,query={})=>`<a href="${pg(n,{role:'R04',...query})}">${esc(text)}</a>`;
 const go=(n,query={})=>location.assign(pg(n,{role:'R04',...query}));
 const body=html=>`<div class="panel-body">${html}</div>`;
 const table=(heads,rows,empty='Записів ще немає.')=>rows.length?`<div class="table-wrap media-table"><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>`<td data-label="${esc(heads[i])}">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:body(`<p class="muted">${esc(empty)}</p>`);
 const details=rows=>`<dl class="detail-list">${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v||'Не зазначено')}</dd></div>`).join('')}</dl>`;
 const input=(name,label,value='',multiline=false,required=false)=>`<label>${esc(label)}${multiline?`<textarea name="${name}" ${required?'required':''}>${esc(value)}</textarea>`:`<input name="${name}" value="${esc(value)}" ${required?'required':''}>`}</label>`;
 const select=(name,label,options)=>`<label>${esc(label)}<select name="${name}" required>${options}</select></label>`;
 const check=(name,id,title,checked=false)=>`<label class="check-label"><input type="checkbox" name="${name}" value="${id}" ${checked?'checked':''}>${esc(title)}</label>`;
 const kinds={information_unit:'Запис',document:'Документ',physical_object:'Носій'};
 const actions={},btn=(label,key,enabled=true)=>`<button type="button" class="button secondary small" data-research-action="${key}" ${enabled?'':'disabled'}>${esc(label)}</button>`;
 const act=(key,fn)=>actions[key]=fn;
 const show=html=>{shell(html);document.querySelectorAll('[data-research-action]').forEach(el=>el.onclick=async()=>{try{await actions[el.dataset.researchAction]?.();}catch(e){flash(e.message,'error');render();}});};
 const enabled=researchEnabled(st,actor),done=message=>{flash(message);render();};
 const form=(title,html,command,after)=>dialog(title,html,async fd=>{const result=await dispatch(command(Object.fromEntries(fd)));if(after)after(result);else done('Збережено.');});
 const sources=()=>searchSources(st,actor,{archive_id:scope});
 const sourceLink=(src,extra={})=>link(45,src.title,{id:src.id,revision:src.revision_id,...extra});
 const queryContext=()=>({q:p.get('q')||'',kind:p.get('kind')||'',query:p.get('query')||'',archive:p.get('archive')||''});
 const sourceOptions=()=>'<option value="">Оберіть джерело</option>'+sources().map(x=>`<option value="${x.id}">${esc(x.title)}</option>`).join('');

 function corpusWizard(selected=[],old=null){
  const existing=old?corpusItems(st,rev(old.id)):[],current=sources(),pool=new Map(current.map(x=>[x.id,x]));
  existing.forEach(x=>{const src=sourceView(st,actor,x.target_entity_id,x.target_revision_id);if(src)pool.set(src.id,src);});
  selected.forEach(x=>pool.set(x.id,x));const candidates=[...pool.values()],chosen=new Set(old?existing.map(x=>x.target_entity_id):selected.map(x=>x.id));
  wizard({dialog,esc},{title:old?'Нова версія корпусу':'Створити корпус',submit:old?'Зберегти версію':'Створити корпус',steps:[
   {title:'Питання та критерії',body:input('title','Назва корпусу',old?.title||'',false,true)+input('research_question','Дослідницьке питання',old?.research_question||'',true)+input('inclusion_criteria','Критерії включення',old?.inclusion_criteria||'',true,true)+input('exclusion_criteria','Критерії виключення',old?.exclusion_criteria||'',true)},
   {title:'Оберіть джерела',body:`<fieldset><legend>Склад корпусу</legend>${candidates.map(x=>check('items',x.id,x.title+' · версія '+x.revision_no,chosen.has(x.id))).join('')||'<p>Доступних джерел немає.</p>'}</fieldset>`+hint('Склад корпусу','Зберігаються саме показані версії. Зміни архівного опису не замінять їх. Попередні версії корпусу залишаються в історії.')},
   {title:'Підстава добору',body:input('selection_reason','Чому ці джерела включено',existing[0]?.selection_reason||'',true,true)+input('group_label','Група джерел',existing[0]?.group_label||'')+input('method_notes','Методичні нотатки',old?.method_notes||'',true)}
  ],summary:v=>details([['Назва',v.title],['Питання',v.research_question],['Критерії включення',v.inclusion_criteria],['Критерії виключення',v.exclusion_criteria],['Джерела',(v.items||[]).map(id=>pool.get(id)?.title).join('\n')||'Нічого не обрано'],['Підстава добору',v.selection_reason],['Група',v.group_label]])+(old?'<p>Попередня версія залишиться незмінною.</p>':''),onSubmit:async v=>{
   const row=await dispatch({type:old?'research.corpus.revise':'research.corpus.create',id:old?.id,expected_revision_id:old?rev(old.id):null,...v,saved_query_id:!old&&p.get('query')||null,items:(v.items||[]).map(id=>({target_entity_id:id,target_revision_id:pool.get(id).revision_id,selection_reason:v.selection_reason,group_label:v.group_label}))});go(44,{id:row.id});
  }});
 }
 function search(){
  const q=queryContext(),rows=searchSources(st,actor,{q:q.q,kind:q.kind,archive_id:q.archive||scope});
  act('save-query',()=>form('Зберегти пошук',input('name','Назва пошуку','',false,true)+details([['Текст',q.q||'Усі матеріали'],['Тип',kinds[q.kind]||'Усі типи']]),v=>({type:'research.query',...v,q:q.q,kind:q.kind,archive_id:q.archive||scope}),()=>go(42)));
  act('create-corpus',()=>{const ids=[...document.querySelectorAll('[name="source-selection"]:checked')].map(x=>x.value);if(!ids.length){done('Оберіть джерела у списку.');return;}corpusWizard(rows.filter(x=>ids.includes(x.id)));});
  show(heading('Дослідницька робота','Пошук джерел','Знайдіть матеріали, відкрийте опис і позначте потрібні рядки. Збережіть критерії пошуку або створіть корпус із вибраних джерел.')+
   `<form class="filters"><input type="hidden" name="role" value="R04"><input type="hidden" name="query" value="${esc(q.query)}"><input type="hidden" name="archive" value="${esc(q.archive)}">${input('q','Знайти джерело',q.q)}<label>Тип джерела<select name="kind"><option value="">Усі типи</option>${Object.entries(kinds).map(([key,title])=>`<option value="${key}" ${q.kind===key?'selected':''}>${title}</option>`).join('')}</select></label><button class="button">Знайти</button></form>`+
   `<div class="research-toolbar">${btn('Створити корпус із вибраного','create-corpus',enabled&&rows.length>0)}${btn('Зберегти пошук','save-query',enabled)}</div>`+
   panel('Результати пошуку',table(['Обрати','Джерело','Тип','Версія'],rows.map(x=>[`<input type="checkbox" name="source-selection" value="${x.id}" aria-label="${esc('Обрати: '+x.title)}">`,sourceLink(x,{...q,from:'search'}),kinds[x.type],String(x.revision_no)]),'За цими умовами доступних джерел немає. Змініть пошуковий запит.')));
 }
 function queries(){
  show(heading('Дослідницька робота','Збережені пошуки','Повторіть пошук за збереженими умовами. Результати можуть змінитися після уточнення опису або зміни доступу.',button('Новий пошук',pg(41,{role:'R04'})))+
   panel('Мої пошуки',table(['Назва','Умови','Дія'],own('saved_query').map(x=>[esc(x.name),esc([x.query_spec.q||'Усі матеріали',kinds[x.query_spec.kind]||'Усі типи'].join(' · ')),link(41,'Виконати пошук',{query:x.id,q:x.query_spec.q,kind:x.query_spec.kind,archive:x.query_spec.archive_id||''})]),'Збережіть потрібні умови зі сторінки пошуку.')));
 }
 function corpora(){
  act('new',()=>corpusWizard());const state=p.get('state')||'',q=p.get('q')||'',rows=own('research_corpus').filter(x=>(!state||(state==='frozen'?!!x.frozen_at:!x.frozen_at))&&x.title.toLocaleLowerCase('uk').includes(q.toLocaleLowerCase('uk')));
  show(heading('Дослідницька робота','Мої корпуси','Відкрийте корпус, щоб переглянути склад, перейти до джерела або зафіксувати добір. Зміна складу створює нову версію.',btn('Створити корпус','new',enabled))+
   `<nav class="journey-filters" aria-label="Стан корпусів">${Object.entries({'':'Усі',draft:'У роботі',frozen:'Зафіксовані'}).map(([key,title])=>`<a href="${pg(43,{role:'R04',state:key,q})}" ${state===key?'aria-current="page"':''}>${title}</a>`).join('')}</nav>`+
   `<form class="filters"><input type="hidden" name="role" value="R04"><input type="hidden" name="state" value="${esc(state)}">${input('q','Знайти корпус',q)}<button class="button">Знайти</button></form>`+
   panel('Корпуси',table(['Назва','Питання','Стан','Версія'],rows.map(x=>[link(44,x.title,{id:x.id}),esc(x.research_question||'—'),x.frozen_at?'Зафіксовано':'У роботі',String(by('entity_revision',rev(x.id)).revision_no)]),'Корпусів за цими умовами немає. Створіть корпус із джерел пошуку.')));
 }
 function corpus(){
  if(!p.has('id'))return corpora();const row=own('research_corpus').find(x=>x.id===p.get('id'));if(!row)return denied();
  const r=by('entity_revision',p.get('revision')||rev(row.id));if(!r||r.entity_id!==row.id)return denied();
  const x=r.snapshot,items=corpusItems(st,r.id),current=r.id===rev(row.id),versions=t.entity_revision.filter(v=>v.entity_id===row.id);
  act('edit',()=>corpusWizard([],row));act('freeze',()=>dialog('Зафіксувати склад',details([['Корпус',x.title],['Джерел',String(items.length)]])+'<p>Цей склад залишиться в історії. Подальший добір можна продовжити в новій версії.</p>',async()=>{await dispatch({type:'research.corpus.freeze',id:row.id,expected_revision_id:r.id});done('Склад корпусу зафіксовано.');},'Зафіксувати'));
  show(link(43,'← Мої корпуси')+heading('Корпус',x.title,'Відкрийте джерело для нотатки, твердження або цитування. Історія версій зберігає попередній склад; обмеження доступу до джерел продовжують діяти.',current?btn('Нова версія','edit')+(!x.frozen_at?btn('Зафіксувати склад','freeze'):''):'')+
   `<nav class="record-tabs" aria-label="Версії корпусу">${versions.map(v=>`<a href="${pg(44,{role:'R04',id:row.id,revision:v.id})}" ${r.id===v.id?'aria-current="page"':''}>Версія ${v.revision_no}${v.snapshot.frozen_at?' · зафіксована':''}</a>`).join('')}</nav>`+
   panel('Питання та добір',body(details([['Дослідницьке питання',x.research_question],['Критерії включення',x.inclusion_criteria],['Критерії виключення',x.exclusion_criteria],['Методичні нотатки',x.method_notes]])))+
   panel('Джерела',table(['Джерело','Версія','Група','Підстава добору'],items.map(i=>{const src=sourceView(st,actor,i.target_entity_id,i.target_revision_id);return src?[sourceLink(src,{corpus:row.id,corpus_revision:r.id}),String(src.revision_no),esc(i.group_label||'—'),esc(i.selection_reason)]:['Джерело недоступне','—','—','—'];}))));
 }
 function assertionWizard(src=null,corpusId=null){
  const pool=sources();if(src&&!pool.some(x=>x.id===src.id))pool.push(src);
  wizard({dialog,esc},{title:'Створити твердження',submit:'Зберегти твердження',steps:[
   {title:'Джерело і висновок',body:(src?details([['Джерело',src.title],['Версія',String(src.revision_no)]]):select('source','Джерело',sourceOptions()))+input('statement_text','Твердження','',true,true)},
   {title:'Доказ і підстава',body:input('locator','Де в джерелі')+input('note','Як джерело підтверджує твердження','',true,true)+hint('Доказ','Опишіть, що саме обґрунтовує висновок, і зазначте сторінку або частину джерела. Твердження зберігається окремо від архівного опису.')}
  ],summary:v=>details([['Джерело',src?.title||pool.find(x=>x.id===v.source)?.title],['Твердження',v.statement_text],['Місце в джерелі',v.locator],['Обґрунтування',v.note]]),onSubmit:async v=>{const target=src||pool.find(x=>x.id===v.source);const row=await dispatch({type:'research.assertion',target_entity_id:target?.id,target_revision_id:target?.revision_id,corpus_id:corpusId,...v});go(46,{id:row.id});}});
 }
 function cite(src){form('Підготувати цитування',details([['Джерело',src.title],['Версія',String(src.revision_no)]]),()=>({type:'research.citation',target_entity_id:src.id,target_revision_id:src.revision_id}),()=>go(55));}
 function source(){
  if(!p.has('id'))return search();const src=sourceView(st,actor,p.get('id'),p.get('revision'));if(!src)return denied();
  const corpusId=p.get('corpus'),cr=p.get('corpus_revision');if(corpusId&&(!owns(st,actor,corpusId)||!corpusItems(st,cr||rev(corpusId)).some(x=>by('entity_revision',x.corpus_revision_id)?.entity_id===corpusId&&x.target_entity_id===src.id&&x.target_revision_id===src.revision_id)))return denied();
  act('note',()=>form('Додати нотатку',input('body','Нотатка','',true,true),v=>({type:'research.annotation',target_entity_id:src.id,target_revision_id:src.revision_id,corpus_id:corpusId,...v})));
  act('assert',()=>assertionWizard(src,corpusId));act('cite',()=>cite(src));
  const notes=visible('annotation').filter(x=>x.target_entity_id===src.id&&x.target_revision_id===src.revision_id&&(!corpusId||x.corpus_id===corpusId));
  show((corpusId?link(44,'← До корпусу',{id:corpusId,revision:cr||rev(corpusId)}):link(41,'← До результатів пошуку',queryContext()))+
   heading('Джерело',src.title,'Нотатки й докази прив’язуються до відкритої версії. Дослідницька робота не змінює архівний опис.',btn('Додати нотатку','note',enabled)+btn('Створити твердження','assert',enabled)+btn('Цитувати','cite',enabled&&!!sourceView(st,actor,src.id,src.revision_id,'cite')))+
   `<div class="media-status"><span>${kinds[src.type]}</span><span>Версія ${src.revision_no}</span>${src.revision_id!==rev(src.id)?'<span>У корпусі збережено попередню версію опису.</span>':''}</div>`+
   panel('Опис джерела',body(`<p class="source-text">${esc(src.text||'Опис ще не заповнено.')}</p>`))+
   panel('Мої нотатки до цієї версії',table(['Нотатка'],notes.map(x=>[esc(x.body)]),'Нотаток ще немає. Додайте спостереження або питання до джерела.')));
 }
 function propose(a){
  const evidence=t.evidence_link.filter(x=>x.subject_entity_id===a.id).map(x=>by('evidence',x.evidence_id));
  wizard({dialog,esc},{title:'Подати пропозицію архіву',submit:'Подати пропозицію',steps:[
   {title:'Твердження та докази',body:details([['Твердження',a.statement_text],['Обґрунтування',evidence.map(x=>x.note).join('\n')]])},
   {title:'Пропоноване уточнення',body:input('description','Що пропонуєте змінити','',true,true)}
  ],summary:v=>details([['Уточнення',v.description],['Підстава',a.statement_text]])+'<p>Пропозиція очікуватиме рішення архівіста. Архівний опис змінюється лише після окремого розгляду.</p>',onSubmit:async v=>{await dispatch({type:'research.proposal',id:a.id,expected_revision_id:rev(a.id),...v});go(47);}});
 }
 function assertions(){
  const rows=visible('assertion');if(p.has('id')){
   const a=rows.find(x=>x.id===p.get('id'));if(!a)return denied();const ev=t.evidence_link.filter(x=>x.subject_entity_id===a.id).map(x=>by('evidence',x.evidence_id));
   const proposed=own('candidate').some(x=>x.kind==='change_proposal'&&x.state==='pending'&&t.candidate_source.some(y=>y.candidate_id===x.id&&y.source_entity_id===a.id));
   act('propose',()=>propose(a));show(link(46,'← Мої твердження')+heading('Дослідницька робота','Дослідницьке твердження','Порівняйте висновок із доказом. Подайте обґрунтовану пропозицію, якщо в архівному описі потрібне уточнення.',proposed?button('Переглянути пропозиції',pg(47,{role:'R04'})):btn('Подати пропозицію архіву','propose'))+
    panel('Твердження',body(`<p class="source-text">${esc(a.statement_text)}</p>`))+
    panel('Докази',table(['Джерело','Місце','Обґрунтування'],ev.map(x=>{const item=a.corpus_id&&t.corpus_item.find(i=>by('entity_revision',i.corpus_revision_id)?.entity_id===a.corpus_id&&i.target_entity_id===x.source_entity_id&&i.target_revision_id===x.source_revision_id);return [sourceLink(sourceView(st,actor,x.source_entity_id,x.source_revision_id),item?{corpus:a.corpus_id,corpus_revision:item.corpus_revision_id}:{}),esc(x.locator||'—'),esc(x.note)];}))));return;
  }
  act('new',()=>assertionWizard());show(heading('Дослідницька робота','Мої твердження','Кожне твердження має джерело й обґрунтування. Відкрийте запис, щоб переглянути докази або подати пропозицію архіву.',btn('Створити твердження','new',enabled))+
   panel('Твердження',table(['Висновок','Джерело','Стан'],rows.map(x=>[link(46,x.statement_text,{id:x.id}),esc(sourceView(st,actor,x.subject_entity_id).title),'Дослідницький висновок']),'Створіть твердження під час роботи з джерелом.')));
 }
 function proposals(){
  const states={pending:'Очікує розгляду',accepted:'Прийнято',rejected:'Відхилено',corrected:'Уточнено',deferred:'Відкладено',superseded:'Замінено'},rows=visible('candidate').filter(x=>x.kind==='change_proposal');
  rows.forEach(x=>act(x.id,()=>dialog('Пропозиція архіву',details([['Джерело',sourceView(st,actor,x.target_entity_id,x.base_revision_id).title],['Уточнення',x.proposed_payload.description],['Стан',states[x.state]]])+table(['Рішення'],t.review_decision.filter(d=>d.target_entity_id===x.id).map(d=>[esc(d.rationale||d.decision)]),'Відповіді архівіста ще немає.'),()=>{},'Закрити')));
  show(heading('Дослідницька робота','Мої пропозиції','Пропозиція містить дослідницьке твердження й докази. Подання не означає прийняття зміни до архівного опису.',button('До тверджень',pg(46,{role:'R04'})))+
   panel('Пропозиції архіву',table(['Уточнення','Джерело','Стан','Дія'],rows.map(x=>[esc(x.proposed_payload.description),esc(sourceView(st,actor,x.target_entity_id,x.base_revision_id).title),states[x.state],btn('Переглянути',x.id)]),'Поданих пропозицій ще немає. Відкрийте твердження, яке обґрунтовує уточнення.')));
 }
 function exports(){
  const rows=visible('citation');
  rows.forEach(x=>act('copy-'+x.id,()=>dialog('Цитування',`<label>Текст цитування<textarea readonly rows="6">${esc(x.rendered_text)}</textarea></label>`,async()=>{const fresh=by('citation',x.id);if(!researchVisible(s(),actor,fresh,'citation'))throw new Error('Цитування недоступне.');await navigator.clipboard.writeText(x.rendered_text);done('Цитування скопійовано.');},'Скопіювати')));
  act('export',()=>wizard({dialog,esc},{title:'Експортувати бібліографію',submit:'Підготувати файл',steps:[
   {title:'Склад бібліографії',body:`<fieldset><legend>Цитування</legend>${rows.map(x=>check('citations',x.id,sourceView(st,actor,x.target_entity_id,x.target_revision_id).title,true)).join('')}</fieldset>`},
   {title:'Формат файла',body:select('format','Формат','<option value="text">Текст (.txt)</option><option value="csl_json">CSL JSON (.json)</option>')}
  ],summary:v=>details([['Цитувань',String(v.citations?.length||0)],['Формат',v.format==='text'?'Текст':'CSL JSON']]),onSubmit:async v=>{await dispatch({type:'research.export',citation_ids:v.citations||[],format:v.format});done('Файл підготовлено. Завантажте його зі списку експорту.');}}));
  own('bibliographic_export').forEach(x=>act('download-'+x.id,()=>{const file=exportDownload(s(),actor,x.id);if(!file)throw new Error('Файл недоступний через зміну доступу до джерел.');const url=URL.createObjectURL(new Blob([file.content],{type:file.mime})),a=document.createElement('a');a.href=url;a.download=file.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}));
  show(heading('Дослідницька робота','Цитування та експорт','Підготуйте цитування зі сторінки джерела, скопіюйте його або зберіть бібліографію. Перед завантаженням доступ перевіряється повторно.',btn('Експортувати бібліографію','export',rows.length>0))+
   panel('Мої цитування',table(['Джерело','Версія','Дія'],rows.map(x=>{const src=sourceView(st,actor,x.target_entity_id,x.target_revision_id);return [sourceLink(src),String(src.revision_no),btn('Скопіювати','copy-'+x.id)];}),'Цитувань ще немає. Відкрийте джерело й натисніть «Цитувати».'))+
   panel('Підготовлені файли',table(['Формат','Стан','Дія'],own('bibliographic_export').map(x=>{const allowed=researchVisible(st,actor,x,'bibliographic_export');return [x.format==='text'?'Текст':'CSL JSON',allowed?'Готово':'Джерело недоступне',btn('Завантажити','download-'+x.id,allowed)];}))));
 }
 return {'PG-41':search,'PG-42':queries,'PG-43':corpora,'PG-44':corpus,'PG-45':source,'PG-46':assertions,'PG-47':proposals,'PG-55':exports};
}
