import {deliveryUI} from './delivery.mjs?v=20261002-wf19';
import {analysisUI,researchStates} from './analysis.mjs?v=20261002-wf19';
import {assertionEvidence} from '../data/analysis.mjs?v=20261002-wf19';
import {readerWorkspace} from './reader.mjs?v=20261002-wf19';
import {annotationView} from '../data/reader.mjs?v=20261002-wf19';
import {corpusWizard as editCorpus,corpusPreview} from './corpus.mjs?v=20261002-wf19';
import {corpusTarget,corpusAnchor,corpusKey,corpusKind} from '../data/corpus.mjs?v=20261002-wf19';
import {discoveryContext,discoverySearchPage,discoverySourcePanels} from './discovery.mjs?v=20261002-wf19';
import {researchEnabled,owns,sourceView,searchSources,corpusItems,researchVisible,exportDownload} from '../data/research.mjs?v=20261002-wf19';
import {wizard} from './wizard.mjs?v=20261002-wf19';
import {hint} from './help.mjs?v=20261002-wf19';

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
 const queryContext=()=>discoveryContext(p);
 const sourceOptions=()=>'<option value="">Оберіть джерело</option>'+sources().map(x=>`<option value="${x.id}">${esc(x.title)}</option>`).join('');

 function corpusWizard(selected=[],old=null){return editCorpus({...discoveryCtx(),sources,rev,dispatch,queryContext},selected,old);}
 const delivery=()=>deliveryUI({...discoveryCtx(),dispatch,rev,sources,s});
 const analysis=()=>analysisUI({...discoveryCtx(),dispatch,rev,sources});
 const discoveryCtx=()=>({st,actor,scope,p,esc,pg,show,heading,panel,body,table,input,details,btn,act,link,form,go,enabled,corpusWizard,dialog});
 function search(){return discoverySearchPage(discoveryCtx());}
 function queries(){
  show(heading('Дослідницька робота','Збережені пошуки','Повторіть пошук за збереженими умовами. Результати можуть змінитися після уточнення опису або зміни доступу.',button('Новий пошук',pg(41,{role:'R04'})))+
   panel('Мої пошуки',table(['Назва','Умови','Дія'],own('saved_query').map(x=>[esc(x.name),esc([x.query_spec.q||'Усі матеріали',kinds[x.query_spec.kind]||'Усі типи',x.query_spec.question||'',x.index_profile_version==='local-discovery-2'?'Збережено всі фільтри':''].filter(Boolean).join(' · ')),link(41,'Виконати пошук',{...x.query_spec,query:x.id})]),'Збережіть потрібні умови зі сторінки пошуку.')));
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
  const x=r.snapshot,items=corpusItems(st,r.id),current=r.id===rev(row.id),versions=t.entity_revision.filter(v=>v.entity_id===row.id),spec=x.selection_context?.query_spec||(x.saved_query_revision_id?by('entity_revision',x.saved_query_revision_id).snapshot.query_spec:null);
  if(p.get('view')==='analysis')return analysis().corpus({...row,title:x.title},r.id);
  act('export-corpus',()=>delivery().dataset(row.id,r.id));act('cite-corpus',()=>delivery().citations(row.id,r.id));
  const filterLabel=(key,id)=>sources().flatMap(v=>v[key]||[]).find(v=>v.id===id)?.label||'Збережений фільтр';
  act('edit',()=>corpusWizard([],row));act('freeze',()=>dialog('Зафіксувати склад',details([['Корпус',x.title],['Елементів',String(items.length)]])+'<p>Цей склад залишиться в історії. Подальший добір можна продовжити в новій версії.</p>',async()=>{await dispatch({type:'research.corpus.freeze',id:row.id,expected_revision_id:r.id});done('Склад корпусу зафіксовано.');},'Зафіксувати'));
  show(link(43,'← Мої корпуси')+heading('Корпус',x.title,'Відкрийте джерело для нотатки, твердження або цитування. Історія версій зберігає попередній склад; обмеження доступу до джерел продовжують діяти.',btn('Експортувати корпус','export-corpus')+btn('Цитувати матеріали','cite-corpus')+button('Аналіз корпусу',pg(44,{role:'R04',id:row.id,revision:r.id,view:'analysis'}))+(current?btn('Нова версія','edit')+(!x.frozen_at?btn('Зафіксувати склад','freeze'):''):''))+
   `<nav class="record-tabs" aria-label="Версії корпусу">${versions.map(v=>`<a href="${pg(44,{role:'R04',id:row.id,revision:v.id})}" ${r.id===v.id?'aria-current="page"':''}>Версія ${v.revision_no}${v.snapshot.frozen_at?' · зафіксована':''}</a>`).join('')}</nav>`+
   panel('Питання та добір',body(details([['Дослідницьке питання',x.research_question],['Критерії включення',x.inclusion_criteria],['Критерії виключення',x.exclusion_criteria],['Методичні нотатки',x.method_notes]])))+
   panel('Склад корпусу',table(['№','Елемент','Тип','Версія','Група','Підстава добору','Дії'],items.map(i=>{
    const v=corpusTarget(st,actor,i);if(!v)return [String(i.position),'Елемент недоступний','—','—','—','—','Доступ змінено; запис збережено в історії'];
    act('preview-'+i.position,()=>corpusPreview(discoveryCtx(),i));
    return [String(i.position),link(45,v.title,{id:v.source.id,revision:v.source.revision_id,corpus:row.id,corpus_revision:r.id,item:i.position}),esc(corpusKind[v.type]),String(v.revision_no)+(v.newer?' · є новіша':''),esc(i.group_label||'—'),esc(i.selection_reason||'—'),btn('Переглянути','preview-'+i.position)];
   })))+
   panel('Контекст добору',body('<details><summary>Коли і за якими умовами сформовано корпус</summary>'+details([['Дата початкового добору',x.selection_context?.selected_at||r.recorded_at],['Дата цієї версії',r.recorded_at],['Джерело добору',x.saved_query_revision_id?'Збережений пошук':'Ручний добір або результати пошуку'],...Object.entries(spec||{}).filter(([k,v])=>v&&k!=='question').map(([k,v])=>[{q:'Пошуковий запит',kind:'Вид джерела',archive_id:'Архів',person:'Особа',place:'Місце',institution:'Установа',term:'Поняття',language:'Мова',media:'Медіа',verified:'Перевірка',date_from:'Від дати',date_to:'До дати',mode:'Спосіб пошуку',bounds:'Область карти'}[k]||k,({person:'people',place:'places',institution:'institutions',term:'terms'}[k]?filterLabel({person:'people',place:'places',institution:'institutions',term:'terms'}[k],v):k==='archive_id'?by('archive',v)?.name||'Збережений архів':k==='kind'?kinds[v]||v:k==='verified'?v==='verified'?'Підтверджені':'Без підтвердження':k==='mode'?v==='context'?'За змістовими зв’язками':'За словами':v)])])+(spec?link(41,'Повторити пошук за цими умовами',{...spec,...(x.saved_query_revision_id?{query:by('entity_revision',x.saved_query_revision_id).entity_id}:{})}):'')+hint('Відтворюваність','Корпус зберігає точний склад, порядок і версії. Повторний пошук може дати інші результати. Зміна доступу приховує матеріал, але не вилучає його з історії.')+'</details>'))+
   (r.previous_revision_id?panel('Зміни складу',body((()=>{const before=corpusItems(st,r.previous_revision_id),a=new Map(before.map(i=>[corpusKey(i),i])),b=new Map(items.map(i=>[corpusKey(i),i]));return details([['Додано',String(items.filter(i=>!a.has(corpusKey(i))).length)],['Вилучено',String(before.filter(i=>!b.has(corpusKey(i))).length)],['Змінено порядок, групу або підставу',String(items.filter(i=>{const old=a.get(corpusKey(i));return old&&(old.position!==i.position||old.group_label!==i.group_label||old.selection_reason!==i.selection_reason);}).length)]]);})())):''));
 }
 function assertionWizard(src=null,corpusId=null,note=null){
  const pool=sources();if(src&&!pool.some(x=>x.id===src.id))pool.push(src);
  wizard({dialog,esc},{title:'Створити твердження',submit:'Зберегти твердження',steps:[
   {title:'Джерело і висновок',body:(src?details([['Джерело',src.title],['Версія',String(src.revision_no)]]):select('source','Джерело',sourceOptions()))+input('statement_text','Твердження','',true,true)},
   {title:'Доказ і підстава',body:input('locator','Де в джерелі',note?(annotationView(st,actor,note)?.target.label||'')+(note.range_start==null?'':' · символи '+note.range_start+'–'+note.range_end):'')+input('note','Як джерело підтверджує твердження',note?.body||'',true,true)+hint('Доказ','Опишіть, що саме обґрунтовує висновок, і зазначте сторінку або частину джерела. Твердження зберігається окремо від архівного опису.')}
  ],summary:v=>details([['Джерело',src?.title||pool.find(x=>x.id===v.source)?.title],['Твердження',v.statement_text],['Місце в джерелі',v.locator],['Обґрунтування',v.note]]),onSubmit:async v=>{const target=src||pool.find(x=>x.id===v.source);const row=await dispatch({type:'research.assertion',target_entity_id:target?.id,target_revision_id:target?.revision_id,corpus_id:corpusId,annotation_id:note?.id,annotation_revision_id:note?rev(note.id):null,...v});go(46,{id:row.id});}});
 }
 function cite(src){form('Підготувати цитування',details([['Джерело',src.title],['Версія',String(src.revision_no)]]),()=>({type:'research.citation',target_entity_id:src.id,target_revision_id:src.revision_id}),()=>go(55));}
 function source(){
  if(!p.has('id'))return search();const src=sourceView({...st,clock:new Date().toISOString()},actor,p.get('id'),p.get('revision'));if(!src)return denied();
  const corpusId=p.get('corpus'),cr=p.get('corpus_revision'),members=corpusId?corpusItems(st,cr||rev(corpusId)).filter(x=>by('entity_revision',x.corpus_revision_id)?.entity_id===corpusId&&corpusAnchor(x).id===src.id&&corpusAnchor(x).revision_id===src.revision_id&&corpusTarget(st,actor,x)):[],selectedItem=p.has('item')?members.find(x=>String(x.position)===p.get('item')):null;if(corpusId&&(!owns(st,actor,corpusId)||!members.length||p.has('item')&&!selectedItem))return denied();
  if(selectedItem)act('corpus-preview',()=>corpusPreview(discoveryCtx(),selectedItem));
  const reader=readerWorkspace({...discoveryCtx(),dispatch,rev,sources,assertionWizard},src,selectedItem,corpusId,corpusId?cr||rev(corpusId):null),view=p.get('view')||'workspace';
  act('note',reader.note);act('relation',reader.relation);
  const context=discoverySourcePanels(discoveryCtx(),src);
  act('assert',()=>assertionWizard(src,corpusId));act('cite',()=>cite(src));
  const notes=visible('annotation').filter(x=>x.target_entity_id===src.id&&x.target_revision_id===src.revision_id&&(!corpusId||x.corpus_id===corpusId));
  show((corpusId?link(44,'← До корпусу',{id:corpusId,revision:cr||rev(corpusId)}):link(41,'← До результатів пошуку',queryContext()))+
   heading('Джерело',src.title,'Нотатки й докази прив’язуються до відкритої версії. Дослідницька робота не змінює архівний опис.',btn('Додати нотатку','note',enabled)+btn('Запропонувати зв’язок','relation',enabled)+btn('Створити твердження','assert',enabled)+btn('Цитувати','cite',enabled&&!!sourceView(st,actor,src.id,src.revision_id,'cite')))+
   `<div class="media-status"><span>${kinds[src.type]}</span><span>Версія ${src.revision_no}</span>${src.revision_id!==rev(src.id)?'<span>У корпусі збережено попередню версію опису.</span>':''}</div>`+
   `<nav class="record-tabs" aria-label="Робота з джерелом">${Object.entries({workspace:'Робоче місце',context:'Походження',notes:'Нотатки та зв’язки'}).map(([key,label])=>`<a href="${pg(45,{...Object.fromEntries(p),role:'R04',view:key,resource:'',segment:''})}" ${view===key?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`+
   (view==='context'?panel('Опис джерела',body(`<p class="source-text">${esc(src.text||'Опис ще не заповнено.')}</p>`))+context:view==='notes'?reader.notesHtml:
   (selectedItem?body(btn('Відкрити збережену версію','corpus-preview')):'')+reader.workspace));reader.bind();
 }
 function propose(a){return delivery().propose(a);}
 function assertions(){
  const rows=visible('assertion');if(p.has('id')){
   const a=rows.find(x=>x.id===p.get('id'));if(!a)return denied();const ev=assertionEvidence(st,a),analysisView=analysis().assertion(a);
   const proposed=own('candidate').some(x=>x.kind==='change_proposal'&&x.state==='pending'&&t.candidate_source.some(y=>y.candidate_id===x.id&&y.source_entity_id===a.id));
   act('propose',()=>propose(a));show(link(46,'← Мої твердження')+heading('Дослідницька робота','Дослідницьке твердження','',analysisView.actions+(proposed?button('Переглянути пропозиції',pg(47,{role:'R04'})):btn('Подати пропозицію архіву','propose')))+
    panel('Твердження',body(`<p class="source-text">${esc(a.statement_text)}</p>`+(a.assertion_kind==='relation'?'<p>Запропонований дослідницький зв’язок. Архівом не прийнято.</p>':'')+(a.annotation_revision_id?'<p>Підстава — збережена версія нотатки: '+esc(by('entity_revision',a.annotation_revision_id).snapshot.body)+'</p>':'')))+
    analysisView.content);return;
  }
  act('new',()=>assertionWizard());show(heading('Дослідницька робота','Мої твердження','Кожне твердження має джерело й обґрунтування. Відкрийте запис, щоб переглянути докази або подати пропозицію архіву.',btn('Створити твердження','new',enabled))+
   panel('Твердження',table(['Висновок','Джерело','Стан'],rows.map(x=>[link(46,x.statement_text,{id:x.id}),esc(sourceView(st,actor,x.subject_entity_id,x.subject_revision_id).title),researchStates[x.research_status||'open']]),'Створіть твердження під час роботи з джерелом.')));
 }
 function proposals(){return delivery().proposals();}
 function exports(){return delivery().exports();}
 return {'PG-41':search,'PG-42':queries,'PG-43':corpora,'PG-44':corpus,'PG-45':source,'PG-46':assertions,'PG-47':proposals,'PG-55':exports};
}
