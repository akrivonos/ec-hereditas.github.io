import {catalogPage} from './catalog.mjs?v=20261002-wf16';
import {mediaPreview} from './session-media.mjs?v=20261002-wf16';
import {sessionPage} from './session.mjs?v=20261002-wf16';
import {contactsPage} from './contacts.mjs?v=20261002-wf16';
import {preparationPage} from './preparation.mjs?v=20261002-wf16';
import {preparationStatus} from '../data/preparation.mjs?v=20261002-wf16';
import {can,hash} from '../data/model.mjs?v=20261002-wf16';
import {hint} from './help.mjs?v=20261002-wf16';
import {wizard} from './wizard.mjs?v=20261002-wf16';
import {mediaPages} from './media.mjs?v=20261002-wf16';

export function fieldPages(ctx){
 const {s,actor,scope,esc,pg,button,panel,heading,shell,dialog,render,flash,dispatch,denied,date}=ctx;
 const st=s(),t=st.tables,by=(table,id)=>t[table]?.find(x=>x.id===id),entity=id=>by('entity',id),rev=id=>entity(id)?.current_revision_id;
 const label=id=>{const e=entity(id),r=e&&by(e.entity_type,id);return r?.title||r?.preferred_name||r?.name||r?.display_hint||r?.original_filename||r?.external_key||'Без назви';};
 const params=new URLSearchParams(location.search),chosen=(rows)=>params.has('id')?rows.find(x=>x.id===params.get('id')):rows[0];
 const allowed=(id,p='domain.read')=>can(st,actor,p,entity(id)?.archive_id);
 const visible=table=>t[table].filter(x=>allowed(x.id)&&(!scope||entity(x.id).archive_id===scope));
 const archive=scope||st.tables.archive.find(x=>can(st,actor,'domain.read',x.id))?.id;
 const writable=(id,p='field.write')=>allowed(id,p);
 const activeArchive=p=>can(st,actor,p,archive);
 const curatorRole=(params.get('role')||sessionStorage.getItem('hereditas.preview.role')||st.demo.actors.find(x=>x.account_id===actor)?.professional_role)==='R02';
 const materialQuery=()=>({role:'R02',handover:params.get('handover')||'',q:params.get('q')||'',placement:params.get('placement')||''});
 const btn=(title,action,enabled=true,extra='')=>`<button type="button" class="button secondary small" data-action="${action}" ${enabled?'':'disabled'} ${extra}>${esc(title)}</button>`;
 const opts=(rows,value='',getLabel=x=>label(x.id))=>rows.map(x=>`<option value="${esc(x.id)}" ${x.id===value?'selected':''}>${esc(getLabel(x))}</option>`).join('');
 const input=(name,title,value='',type='text',required=false,tip='')=>`<div class="field-control"><label>${esc(title)}${type==='textarea'?`<textarea name="${name}" ${required?'required':''}>${esc(value)}</textarea>`:`<input name="${name}" type="${type}" step="any" value="${esc(value)}" ${required?'required':''}>`}</label>${tip?hint(title,tip):''}</div>`;
 const select=(name,title,options,tip='')=>`<div class="field-control"><label>${esc(title)}<select name="${name}">${options}</select></label>${tip?hint(title,tip):''}</div>`;
 const choices=(pairs,value)=>pairs.map(([key,title])=>`<option value="${key}" ${key===value?'selected':''}>${esc(title)}</option>`).join('');
 const link=(n,row,text=label(row.id))=>`<a href="${pg(n,{id:row.id})}">${esc(text)}</a>`;
 const details=rows=>`<dl class="detail-list">${rows.map(([name,value])=>`<div><dt>${esc(name)}</dt><dd>${esc(value||'Не зазначено')}</dd></div>`).join('')}</dl>`;
 const body=html=>`<div class="panel-body">${html}</div>`;
 const table=(heads,rows)=>rows.length?`<div class="table-wrap media-table"><table><thead><tr>${heads.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((cell,i)=>`<td data-label="${esc(heads[i])}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:body('<p class="muted">Записів ще немає.</p>');
 const actions={};
 const action=(key,fn)=>{actions[key]=fn;};
 const show=html=>{shell(html);document.querySelectorAll('[data-action]').forEach(b=>b.onclick=async()=>{try{await actions[b.dataset.action]?.(b);}catch(e){flash(e.message,'error');render();}});};
 const save=async c=>{const result=await dispatch(c);flash('Зміни збережено.');render();return result;};
 const form=(title,html,makeCommand,after)=>dialog(title,html,async fd=>{const result=await dispatch(makeCommand(fd));flash('Зміни збережено.');if(after)after(result);else render();});
 const revisionHistory=id=>`<details class="record-history"><summary>Історія змін</summary>${table(['Версія','Дата','Зміна'],t.entity_revision.filter(x=>x.entity_id===id).slice().reverse().map(r=>[String(r.revision_no),esc(date(r.recorded_at)),esc(r.change_reason)]))}</details>`;
 const tabs=r=>`<nav class="record-tabs" aria-label="Дослідження"><a href="${pg(5,{id:r.id})}">Підготовка</a><a href="${pg(6,{research:r.id})}">Контакти та зустрічі</a><a href="${pg(7,{research:r.id})}">Сеанси</a><a href="${pg(9,{research:r.id})}">Польовий зошит</a></nav>`;
 const research=()=>visible('field_research').find(x=>x.id===params.get('research'));
 const kinds=[['recorded_work','Твір'],['fei','Фольклорно-етнографічна інформація']];
 const participantRole=code=>({performer:'Виконавець / оповідач',collector:'Збирач',observer:'Присутній'})[code]||code;
 const listContext=()=>({role:params.get('role')||sessionStorage.getItem('hereditas.preview.role')||'R01',research:params.get('research')||'',q:params.get('q')||''});
 const primary=(title,key,enabled)=>btn(title,key,enabled).replace('button secondary small','button small');
 const done=message=>{flash(message);render();};
 function researchWizard(){
  wizard({dialog,esc},{title:'Нове дослідження',submit:'Створити дослідження',steps:[
   {title:'Назва і мета',body:input('title','Назва','','text',true)+input('purpose','Мета','','textarea',true)},
   {title:'Підготовка',body:input('programme','Теми та питання','','textarea',false,'Програму можна додати пізніше. Кожен сеанс збереже версію, з якою його створено.')+input('backup_plan','Резервне копіювання','','textarea')+input('date_from','Початок','','date')+input('date_to','Завершення','','date')}
  ],summary:v=>details([['Дослідження',v.title],['Мета',v.purpose],['Програма',v.programme||'Додати пізніше'],['Резервне копіювання',v.backup_plan]]),onSubmit:async v=>{await dispatch({type:'field.research.create',archive_id:archive,...v});done('Дослідження додано до списку.');}});
 }
 function programmeDialog(r){
  const programme=by('entity_revision',r.programme_revision_id);
  form('Програма дослідження',input('body_text','Теми та питання',programme?.snapshot.body_text||'','textarea',true,'Оновлення діятиме для нових сеансів. Проведені сеанси зберігають свою програму.'),fd=>({type:'field.programme',id:r.id,expected_revision_id:rev(r.id),document_revision_id:programme?rev(programme.entity_id):null,body_text:fd.get('body_text')}));
 }
 function sessionWizard(r=null,requirePrepared=false){
  const researchRows=visible('field_research').filter(x=>writable(x.id));
  wizard({dialog,esc},{title:'Новий сеанс',submit:'Створити сеанс',steps:[
   {title:'Дослідження і назва',body:(r?body(details([['Дослідження',r.title]])):select('research_id','Дослідження',opts(researchRows)))+input('title','Назва','','text',true)+(r?select('work_group_id','Робоча група','<option value="">Без групи</option>'+opts(t.work_group.filter(x=>x.research_id===r.id&&!entity(x.id)?.retired_at),'',x=>x.name)):'' )},
   {title:'Дата й обставини',body:select('date_precision','Точність дати',choices([['unknown','Невідомо'],['exact','Точна дата'],['approximate','Приблизно']],'unknown'))+input('date_from','Дата','','date',false,'Для приблизної або невідомої дати залиште поле порожнім і запишіть відому частину словами.')+input('date_label','Дата словами')+input('location_description','Місце та умови','','textarea')},
   {title:'Перший учасник',body:select('person_id','Особа','<option value="">Додати пізніше</option>'+opts(visible('person')))+select('role_code','Функція',choices([['performer','Виконавець / оповідач'],['collector','Збирач'],['observer','Присутній']],'performer'),'Контакт для домовленості не стає учасником автоматично. Згоду потрібно зафіксувати окремо.')}
  ],summary:v=>{const selected=r||by('field_research',v.research_id);return details([['Дослідження',selected?.title],['Сеанс',v.title],['Дата',v.date_label||v.date_from||'Невідомо'],['Місце та умови',v.location_description],['Учасник',v.person_id?label(v.person_id)+' · '+participantRole(v.role_code):'Додати пізніше'],['Програма',selected?.programme_revision_id?'Поточна програма дослідження':'Не додана']]);},onSubmit:async v=>{const id=r?.id||v.research_id;await dispatch({type:'field.session.create',...v,require_prepared:requirePrepared,research_id:id,expected_revision_id:rev(id),date_to:v.date_precision==='exact'?v.date_from:null});done('Сеанс створено. У списку сеансів можна додати записи.');}});
 }
 function unitDialog(session){
  form('Додати запис',body(details([['Сеанс',session.title]]))+select('unit_kind','Тип запису',choices(kinds,'recorded_work'))+input('title','Назва','','text',true)+input('summary','Зміст','','textarea'),fd=>({type:'field.unit.create',id:session.id,expected_revision_id:rev(session.id),...Object.fromEntries(fd)}));
 }
 function participantDialog(session){
  form('Додати учасника',select('person_id','Особа',opts(visible('person')))+select('role_code','Функція',choices([['performer','Виконавець / оповідач'],['collector','Збирач'],['observer','Присутній']],'performer')),fd=>({type:'field.participant',id:session.id,expected_revision_id:rev(session.id),...Object.fromEntries(fd)}));
 }
 const transferFor=session=>{const h=t.handover.filter(h=>t.handover_item.some(i=>i.handover_id===h.id&&i.entity_id===session.id)).at(-1);return h?{h,current:t.handover_item.filter(i=>i.handover_id===h.id).every(i=>i.revision_id===rev(i.entity_id))}:null;};
 function researchPicker(number,title,permission=null){
  const rows=visible('field_research').filter(r=>!permission||can(st,actor,permission,r.id));
  show(heading('Польова робота',title,'Оберіть дослідження зі списку. Для приватних контактів потрібен окремо наданий доступ.')+panel('Оберіть дослідження',table(['Дослідження',''],rows.map(r=>[esc(r.title),button('Відкрити',pg(number,{research:r.id,role:'R01'}),true)]))));
 }
 function notebookEditor(r,doc=null){
  const sessions=visible('collecting_session').filter(x=>x.research_id===r?.id),linked=t.document_context.filter(x=>x.document_id===doc?.id).map(x=>x.target_entity_id);
  wizard({dialog,esc},{title:doc?'Редагувати зошит':'Новий польовий зошит',submit:'Зберегти зошит',steps:[
   {title:'Дослідження та сеанси',body:(r?body(details([['Дослідження',r.title]])):select('research_id','Дослідження',opts(visible('field_research').filter(x=>writable(x.id)))))+input('title','Назва',doc?.title||'Польовий зошит','text',true)+(sessions.length?`<fieldset><legend>Пов’язані сеанси</legend>${sessions.map(x=>`<label class="check-label"><input type="checkbox" name="session_ids" value="${x.id}" ${linked.includes(x.id)||params.get('session')===x.id?'checked':''}>${esc(x.title)}</label>`).join('')}</fieldset>`:'')},
   {title:'Польові нотатки',body:input('body_text','Нотатки',doc?.body_text||'','textarea')}
  ],summary:v=>details([['Назва',v.title],['Дослідження',r?.title||label(v.research_id)],['Пов’язані сеанси',(v.session_ids||[]).map(label).join(', ')||'Без прив’язки до сеансу'],['Нотатки',v.body_text]]),onSubmit:async v=>{await dispatch({type:'field.notebook',...v,id:doc?.id,expected_revision_id:doc?rev(doc.id):undefined,research_id:r?.id||v.research_id,session_ids:v.session_ids||[]});done('Польові нотатки збережено.');}});
 }
 function notebookList(){
  const r=research();if(params.get('research')&&!r){denied();return;}
  if(params.get('session')&&!visible('collecting_session').some(x=>x.id===params.get('session')&&(!r||x.research_id===r.id))){denied();return;}
  const q=(params.get('q')||'').toLocaleLowerCase('uk'),docs=visible('document').filter(x=>x.kind==='field_notebook'&&x.title.toLocaleLowerCase('uk').includes(q)&&(!r||t.document_context.some(c=>c.document_id===x.id&&c.target_entity_id===r.id))&&(!params.get('session')||t.document_context.some(c=>c.document_id===x.id&&c.target_entity_id===params.get('session'))));
  action('add',()=>notebookEditor(r));docs.forEach(doc=>action('notebook-'+doc.id,()=>notebookEditor(by('field_research',t.document_context.find(c=>c.document_id===doc.id&&c.context_role==='research')?.target_entity_id),doc)));
  show(heading(r?.title||'Польова робота','Польові зошити','Зошити можуть об’єднувати кілька сеансів. Для прив’язки нового зошита до сеансів спочатку оберіть дослідження у списку.',primary('Новий зошит','add',r?writable(r.id):activeArchive('field.write')))+
   `<form class="filters"><input type="hidden" name="role" value="${esc(listContext().role)}">${select('research','Дослідження','<option value="">Усі дослідження</option>'+opts(visible('field_research'),r?.id))}${input('q','Знайти зошит',params.get('q')||'')}<button class="button">Знайти</button></form>`+
   panel('Зошити',table(['Зошит','Дослідження','Дія'],docs.map(doc=>[`<a href="${pg(9,{...listContext(),id:doc.id,session:params.get('session')})}">${esc(doc.title)}</a>`,esc(label(t.document_context.find(c=>c.document_id===doc.id&&c.context_role==='research')?.target_entity_id)),btn('Редагувати','notebook-'+doc.id,writable(doc.id))]))));
 }
 function edit(row,definitions,title='Редагувати опис'){
  const html=definitions.map(([key,name,type='text',tip=''])=>input(key,name,row[key]??'',type,['title','name','preferred_name'].includes(key),tip)).join('');
  form(title,html,fd=>({type:'field.save',id:row.id,expected_revision_id:rev(row.id),session_revision_id:row.session_id?rev(row.session_id):undefined,values:Object.fromEntries(definitions.map(([key,,type])=>[key,type==='number'?(fd.get(key)===''?null:Number(fd.get(key))):fd.get(key)]))}));
 }
 function researches(){
  const q=(params.get('q')||'').toLocaleLowerCase('uk'),rows=visible('field_research').filter(r=>(r.title+' '+(r.purpose||'')).toLocaleLowerCase('uk').includes(q));
  action('create',researchWizard);rows.forEach(r=>action('next-'+r.id,()=>r.programme_revision_id?sessionWizard(r):programmeDialog(r)));
  show(heading('Робочий список','Дослідження','Почніть із назви, мети та програми. Створюйте сеанси з відповідного дослідження; маршрут і підготовка доступні в його картці.',primary('Нове дослідження','create',activeArchive('field.write')))+
   `<form class="filters"><input type="hidden" name="role" value="${esc(listContext().role)}">${input('q','Знайти дослідження',params.get('q')||'')}<button class="button">Знайти</button></form>`+
   panel('Польові дослідження',table(['Дослідження','Підготовка','Сеанси','Наступна дія'],rows.map(r=>{const count=t.collecting_session.filter(x=>x.research_id===r.id).length;return [`<a href="${pg(5,{...listContext(),id:r.id})}">${esc(r.title)}</a><span class="sub">${esc(r.purpose||'')}</span>`,`<a href="${pg(5,{id:r.id,role:listContext().role})}">${preparationStatus(st,r.id).confirmed?'Готовність підтверджено':'Завершити підготовку'}</a>`,`<a href="${pg(7,{research:r.id,role:listContext().role})}">${count?count+' · Відкрити сеанси':'Перейти до сеансів'}</a>`,primary(r.programme_revision_id?'Новий сеанс':'Додати програму','next-'+r.id,writable(r.id))];}))));
 }
 function researchDetail(){
  if(!params.has('id')){researches();return;}
  const r=chosen(visible('field_research'));if(!r){denied();return;}
  preparationPage({st,t,by,rev,label,visible,writable,params,pg,button,panel,heading,esc,body,table,details,input,select,choices,opts,btn,form,action,save,show,edit,tabs,revisionHistory,programmeDialog,sessionWizard,dialog},r);
 }

 function contacts(){
  if(!params.get('research')){researchPicker(6,'Контакти та зустрічі','contacts.read');return;}
  const r=research();if(!r||!can(st,actor,'contacts.read',r.id)){denied();return;}
  contactsPage({st,t,actor,can,by,rev,label,visible,params,pg,button,panel,heading,esc,body,table,details,input,select,choices,opts,btn,form,action,show,tabs,dispatch,render,flash,dialog},r);
 }

 function sessions(){
  const r=research();if(params.get('research')&&!r){denied();return;}
  const q=(params.get('q')||'').toLocaleLowerCase('uk'),rows=visible('collecting_session').filter(x=>(!r||x.research_id===r.id)&&x.title.toLocaleLowerCase('uk').includes(q));
  action('create',()=>sessionWizard(r));rows.forEach(x=>{action('unit-'+x.id,()=>unitDialog(x));action('participant-'+x.id,()=>participantDialog(x));action('handover-'+x.id,()=>mediaPages(ctx).prepareHandover(x));});
  show(heading(r?.title||'Робочий список','Сеанси','Додавайте записи з рядка сеансу. Аудіо, відео та фото додавайте до відповідного сеансу. У картці також є учасники, перебіг і нотатки.',primary('Новий сеанс','create',r?writable(r.id):visible('field_research').some(x=>writable(x.id))))+
   `<form class="filters"><input type="hidden" name="role" value="${esc(listContext().role)}">${select('research','Дослідження','<option value="">Усі дослідження</option>'+opts(visible('field_research'),r?.id))}${input('q','Знайти сеанс',params.get('q')||'')}<button class="button">Знайти</button></form>`+
   panel('Сеанси',table(['Сеанс','Учасники / записи','Передання','Наступна дія'],rows.map(x=>{const units=t.information_unit.filter(u=>u.session_id===x.id),people=t.participation.filter(p=>p.session_id===x.id).length,transfer=transferFor(x);return [`<a href="${pg(8,{...listContext(),id:x.id})}">${esc(x.title)}</a><span class="sub">${esc(label(x.research_id))} · ${esc(x.date_label||date(x.date_from))}</span>`,`Учасники: ${people} · Записи: ${units.length}<span class="sub">${button('Аудіо, відео та фото',pg(8,{...listContext(),id:x.id,section:'media'}),true)}</span>`,transfer?`<a href="${pg(11,{id:transfer.h.id,tab:'outgoing'})}">${esc(({prepared:'Пакет підготовлено',sent:'Надіслано',accepted:'Прийнято',returned:'Повернуто на уточнення'})[transfer.h.state])}</a>${!transfer.current?'<span class="sub">Матеріали змінено після підготовки пакета</span>':''}`:'Пакет ще не підготовлено',primary(people?'Додати запис':'Додати учасника',(people?'unit-':'participant-')+x.id,writable(x.id))+(units.length&&(!transfer||!transfer.current||transfer.h.state==='returned')?' '+btn('Підготувати передання','handover-'+x.id,writable(x.id,'intake.send')):'')];}))));

 }
 function sessionDetail(){
  if(!params.has('id')){sessions();return;}
  const r=chosen(visible('collecting_session'));if(!r){denied();return;}
  sessionPage({st,t,by,rev,label,visible,writable,params,pg,button,panel,heading,esc,body,table,details,input,select,choices,opts,btn,form,action,save,show,revisionHistory,dialog,unitDialog,dispatch,render,flash,prepareHandover:session=>mediaPages(ctx).prepareHandover(session)},r);
 }
 function notebook(){
  if(!params.has('id')){notebookList();return;}
  const doc=visible('document').find(x=>x.id===params.get('id')&&x.kind==='field_notebook'),researchId=doc&&t.document_context.find(c=>c.document_id===doc.id&&c.context_role==='research')?.target_entity_id,r=visible('field_research').find(x=>x.id===researchId);
  if(!doc||!r||(params.get('research')&&params.get('research')!==r.id)){denied();return;}
  const docs=visible('document').filter(x=>x.kind==='field_notebook'&&t.document_context.some(c=>c.document_id===x.id&&c.target_entity_id===r.id));
  const sessions=visible('collecting_session').filter(x=>x.research_id===r.id),linked=t.document_context.filter(x=>x.document_id===doc.id).map(x=>x.target_entity_id);
  action('edit',()=>notebookEditor(r,doc));action('add',()=>notebookEditor(r));
  show(heading(r.title,doc?.title||'Польовий зошит','Один зошит може об’єднувати нотатки кількох сеансів.',button('← Польові зошити',pg(9,{...listContext(),session:params.get('session')}),true))+tabs(r)+`<div class="two-col"><div>`+panel('Нотатки',body(`<div class="reading-text notebook-text">${esc(doc?.body_text||'Нотаток ще немає.')}</div>`),btn(doc?'Редагувати':'Додати нотатки','edit',writable(r.id)))+(doc?revisionHistory(doc.id):'')+`</div><aside>`+panel('Сеанси зошита',body(sessions.filter(x=>linked.includes(x.id)).map(x=>`<p>${link(8,x)}</p>`).join('')||'<p>Сеансів ще не пов’язано.</p>'))+panel('Зошити дослідження',body(docs.map(x=>`<p><a href="${pg(9,{id:x.id,research:r.id})}">${esc(x.title)}</a></p>`).join('')||'<p>Зошитів ще немає.</p>'))+'</aside></div>');
 }
 function materials(){
  if(params.has('intake')){
   const receipt=by('intake_record',params.get('intake'));if(!receipt||!allowed(receipt.id)||(scope&&receipt.archive_id!==scope)){denied();return;}
   const items=(t.intake_item||[]).filter(i=>i.intake_id===receipt.id&&i.local_entity_id),rows=items.filter(i=>allowed(i.local_entity_id)&&(i.source_type!=='consent_record'||can(st,actor,'consent.read',receipt.archive_id)));
   for(const i of rows){action('received-'+i.position,()=>{const e=entity(i.local_entity_id),row=by(e.entity_type,i.local_entity_id);dialog(label(i.local_entity_id),body(details([['Архівний шифр',i.archive_code],['Опис',row.body_text||row.summary||row.context_notes||'Опис у пакеті надходження'],['Обмеження',i.decision==='restricted'?i.reason:'Окремі права ще не визначено']]))+(e.entity_type==='file_object'?mediaPreview(st.demo.file_contents[row.id],row.mime_type,esc):''),null,'Закрити');});
    action('received-place-'+i.position,()=>form('Розмістити в архіві',select('node_id','Розділ архіву',opts(visible('archive_node').filter(n=>n.archive_id===receipt.archive_id))),fd=>({type:'field.placement',id:i.local_entity_id,node_id:fd.get('node_id')})));
   }
   show(heading('Прийняте надходження',receipt.title,'',button('← Надходження',pg(11,{role:'R02',intake:receipt.id}),true))+panel('Прийняті матеріали',table(['Матеріал','Архівний шифр','Обмеження','Дії'],rows.map(i=>[esc(label(i.local_entity_id)),esc(i.archive_code),esc(i.decision==='restricted'?i.reason:'Публікація не дозволена автоматично'),button('Опрацювати опис',pg(17,{role:'R02',material:i.local_entity_id}),true)+' '+btn('Переглянути','received-'+i.position)+(writable(i.local_entity_id,'catalog.write')?' '+btn('Розмістити','received-place-'+i.position):'')]))));return;
  }
  const h=params.get('handover')&&by('handover',params.get('handover')),origin=h&&by('workflow_run',h.from_workflow_run_id),owner=origin&&entity(origin.primary_entity_id);
  if(params.has('handover')&&(!h||!allowed(origin?.primary_entity_id)||(scope&&owner?.archive_id!==scope))){denied();return;}
  if(h&&h.state!=='accepted'){show(heading('Архівна робота','Матеріали','Опрацювання прийнятого пакета починається після рішення отримувача.',button('← Надходження',pg(10,{role:'R02'}),true))+body('<p>Пакет ще не прийнято. Завершіть його звірку у надходженнях.</p>'));return;}
  const types={field_research:'Дослідження',source_record:'Джерельний запис',media_asset:'Медіаресурс',collecting_session:'Сеанс',information_unit:'Інформаційний запис',physical_object:'Фізичний носій',file_object:'Цифровий файл',document:'Польовий документ'},items=h?t.handover_item.filter(x=>x.handover_id===h.id):[],q=(params.get('q')||'').toLocaleLowerCase('uk'),mode=params.get('placement')||'';
  const placement=id=>t.archival_placement.find(x=>x.entity_id===id&&x.placement_role==='primary');
  const rows=Object.keys(types).flatMap(visible).filter(x=>!x.technical_metadata?.intake_package&&(entity(x.id).entity_type!=='document'||['field_notebook','session_form','received_description','source_document'].includes(x.kind))&&(!h||items.some(i=>i.entity_id===x.id))&&label(x.id).toLocaleLowerCase('uk').includes(q)&&(!mode||(mode==='placed')===!!placement(x.id)));
  for(const row of rows){
   const kind=entity(row.id).entity_type,item=items.find(i=>i.entity_id===row.id),snapshot=item?by('entity_revision',item.revision_id).snapshot:row;
   action('view-'+row.id,()=>dialog(label(row.id),body(details([['Тип',types[kind]],['Опис',snapshot.summary||snapshot.context_notes||snapshot.composition||snapshot.body_text||'Не зазначено'],...(item?[['Версія у прийнятому пакеті',String(by('entity_revision',item.revision_id).revision_no)]]:[])]))+(kind==='file_object'?mediaPreview(st.demo.file_contents[row.id],row.mime_type,esc):''),null,'Закрити'));

   action('place-'+row.id,()=>{
    const nodes=visible('archive_node').filter(n=>n.archive_id===entity(row.id).archive_id),expected=hash(t.archival_placement.filter(x=>x.entity_id===row.id&&x.placement_role==='primary'));
    const path=node=>node.parent_id?path(by('archive_node',node.parent_id))+' / '+node.title:node.title;
    wizard({dialog,esc},{title:'Розмістити в архіві',submit:'Зберегти розміщення',steps:[{title:'Матеріал і розділ',body:body(details([['Матеріал',label(row.id)],['Поточне місце',placement(row.id)?label(placement(row.id).archive_node_id):'Ще не розміщено']]))+select('node_id','Розділ архіву',opts(nodes,placement(row.id)?.archive_node_id,path))}],summary:v=>details([['Матеріал',label(row.id)],['Розмістити в',v.node_id?path(by('archive_node',v.node_id)):'Спочатку створіть розділ архіву']]),onSubmit:async v=>{await dispatch({type:'field.placement',id:row.id,node_id:v.node_id,expected_placement_hash:await expected});done('Матеріал розміщено в архіві.');}});
   });
  }
  show(heading(h?'Прийняте надходження':'Архівна робота','Матеріали','Переглядайте матеріали, уточнюйте описи й обирайте основний розділ архіву. Розміщення не змінює зафіксовані версії у прийнятому пакеті.',h?button('← Надходження',pg(10,{role:'R02',state:'accepted'}),true):button('Структура архіву',pg(16,{role:'R02'}),true))+
   `<form class="filters"><input type="hidden" name="role" value="R02">${h?`<input type="hidden" name="handover" value="${h.id}">`:''}${input('q','Знайти матеріал',params.get('q')||'')}${select('placement','Розміщення',choices([['','Усі матеріали'],['unplaced','Без розділу'],['placed','Розміщені']],mode))}<button class="button">Знайти</button></form>`+
   panel('Матеріали',table(['Матеріал','Тип','В архіві','Дії'],rows.map(row=>{const kind=entity(row.id).entity_type,p=placement(row.id),item=items.find(i=>i.entity_id===row.id),nodes=visible('archive_node').filter(n=>n.archive_id===entity(row.id).archive_id);return [`<button class="link-button" data-action="view-${row.id}">${esc(label(row.id))}</button>${item&&item.revision_id!==rev(row.id)?'<span class="sub">Опис оновлено після приймання</span>':''}`,types[kind],p?link(16,by('archive_node',p.archive_node_id)):'Не розміщено',button('Опрацювати опис',pg(17,{role:'R02',material:row.id}),true)+' '+btn(p?'Змінити розділ':'Розмістити','place-'+row.id,writable(row.id,'catalog.write')&&nodes.length>0)+(!nodes.length?' <span class="sub">Спочатку створіть розділ архіву.</span>':'')];}))));
 }
 function archiveTree(){
  const nodes=visible('archive_node'),selected=params.has('id')?nodes.find(x=>x.id===params.get('id')):null;if(params.has('id')&&!selected){denied();return;}
  const nodeArchive=selected?.archive_id||archive,terms=t.vocabulary_term.filter(x=>x.status==='active'&&t.archive_vocabulary_binding.some(b=>b.archive_id===nodeArchive&&b.scheme_id===x.scheme_id)),termLabel=id=>t.term_label.find(x=>x.term_id===id&&x.kind==='preferred')?.label||'Без назви';
  action('add',()=>form('Новий розділ архіву',input('title','Назва','','text',true)+input('reference_code','Шифр')+select('parent_id','Розмістити в','<option value="">Корінь архіву</option>'+opts(nodes.filter(x=>x.archive_id===nodeArchive),selected?.id))+select('node_type_term_id','Тип розділу',opts(terms,'',x=>termLabel(x.id))),fd=>({type:'field.node.create',archive_id:nodeArchive,...Object.fromEntries(fd)}),r=>location.href=pg(16,{id:r.id})));
  if(selected)action('edit',()=>edit(selected,[['title','Назва'],['reference_code','Шифр']]));
  const branch=parent=>`<ul>${nodes.filter(x=>x.parent_id===parent).sort((a,b)=>a.position-b.position).map(x=>`<li><a href="${pg(16,{id:x.id})}" ${selected?.id===x.id?'aria-current="page"':''}>${esc(x.title)}<small>${esc(x.reference_code||termLabel(x.node_type_term_id))}</small></a>${branch(x.id)}</li>`).join('')}</ul>`;
  const materials=selected?t.archival_placement.filter(x=>x.archive_node_id===selected.id&&allowed(x.entity_id)):[];
  const targetPage=id=>({field_research:5,collecting_session:8,information_unit:17})[entity(id)?.entity_type]||17;
  show(heading('Архів','Структура архіву','Розділи та матеріали зберігаються окремо: матеріал можна розмістити в потрібному розділі.',btn('Новий розділ','add',can(st,actor,'catalog.write',nodeArchive)))+`<div class="archive-layout"><nav class="archive-tree" aria-label="Дерево архіву">${branch(null)}</nav><div>`+(selected?panel(selected.title,(nodes.some(x=>x.parent_id===selected.id)?body('<div class="sub-sections">'+nodes.filter(x=>x.parent_id===selected.id).map(x=>'<p>'+link(16,x)+' <small>('+t.archival_placement.filter(p=>p.archive_node_id===x.id&&allowed(p.entity_id)).length+')</small></p>').join('')+'</div>'):'')+table(['Матеріал','Розміщення'],materials.map(x=>[`<a href="${pg(targetPage(x.entity_id),{id:x.entity_id})}">${esc(label(x.entity_id))}</a>`,x.placement_role==='primary'?'Основне':'Посилання'])),btn('Редагувати розділ','edit',writable(selected.id,'catalog.write'))):panel('Розділи архіву',body(nodes.length?'<p>Оберіть розділ у дереві, щоб переглянути його матеріали.</p>':'<p>Розділів ще немає. Створіть перший розділ.</p>')))+`</div></div>`);
 }
 function unitDetail(){
  if(!params.has('id')&&!params.has('material')){if(curatorRole)materials();else sessions();return;}
  catalogPage({st,t,actor,scope,params,by,entity,rev,label,allowed,visible,writable,action,show,heading,panel,body,table,details,btn,button,pg,esc,input,select,opts,choices,dialog,form,dispatch,render,denied});
 }
 function authorities(){
  const kind=params.get('kind')||'person',types=[['person','Особи'],['place','Місця'],['institution','Установи']];
  if(!types.some(x=>x[0]===kind)){denied();return;}
  const q=(params.get('q')||'').toLocaleLowerCase('uk'),rows=visible(kind).filter(x=>label(x.id).toLocaleLowerCase('uk').includes(q));
  action('add',()=>form('Новий авторитетний запис',select('kind','Тип',choices([['person','Особа'],['place','Місце'],['institution','Установа']],kind))+input('name','Назва / ім’я','','text',true),fd=>({type:'field.authority.create',archive_id:archive,...Object.fromEntries(fd)}),r=>location.href=pg(19,{id:r.id})));
  show(heading('Архівний опис','Особи, місця, установи','Спільні записи для посилань із різних досліджень і сеансів.',btn('Додати запис','add',activeArchive('catalog.write')))+`<nav class="record-tabs" aria-label="Тип запису">${types.map(([k,title])=>`<a href="${pg(18,{kind:k})}" ${kind===k?'aria-current="page"':''}>${title}</a>`).join('')}</nav><form class="filters"><input type="hidden" name="kind" value="${kind}"><label>Пошук<input name="q" value="${esc(params.get('q')||'')}"></label><button class="button">Знайти</button></form>`+panel(types.find(x=>x[0]===kind)[1],table(['Назва','Додаткові відомості'],rows.map(x=>[link(19,x),esc(x.name_note||x.coordinate_note||x.short_name||'—')]))));
 }
 function authorityDetail(){
  if(!params.has('id')){authorities();return;}
  const row=chosen(['person','place','institution'].flatMap(visible));if(!row){denied();return;}
  const kind=entity(row.id).entity_type,defs={person:[['preferred_name','Основне ім’я'],['name_note','Примітка до імені','textarea']],place:[['name','Назва'],['latitude','Широта','number'],['longitude','Довгота','number'],['coordinate_note','Примітка до координат','textarea']],institution:[['name','Назва'],['short_name','Скорочення'],['institution_type','Тип установи'],['website_uri','Вебсайт']]};
  action('edit',()=>edit(row,defs[kind]));
  const related=kind==='person'?t.participation.filter(x=>x.person_id===row.id&&x.session_id).map(x=>x.session_id):kind==='place'?t.geographic_context.filter(x=>x.place_id===row.id).map(x=>x.subject_entity_id):t.institution_context.filter(x=>x.institution_id===row.id).map(x=>x.subject_entity_id);
  const names=kind==='person'?t.person_name.filter(x=>x.person_id===row.id):kind==='place'?t.place_name.filter(x=>x.place_id===row.id):[];
  show(heading(({person:'Особа',place:'Місце',institution:'Установа'})[kind],label(row.id),'Уточнюйте основний опис, зберігаючи попередні версії.',btn('Редагувати','edit',writable(row.id,'catalog.write')))+`<div class="record-tabs">${button('← Особи, місця, установи',pg(18,{kind}),true)}</div><div class="two-col"><div>`+
   panel('Відомості',body(details(defs[kind].map(([key,title])=>[title,row[key]]))))+(names.length?panel('Варіанти назви',table(['Назва','Контекст'],names.map(x=>[esc(x.name),x.kind==='source'?'У джерелі':x.kind==='preferred'?'Основна':'Варіант']))):'')+revisionHistory(row.id)+`</div><aside>`+
   panel('Пов’язані матеріали',body([...new Set(related)].filter(id=>allowed(id)).map(id=>`<p><a href="${pg(entity(id).entity_type==='collecting_session'?8:5,{id})}">${esc(label(id))}</a></p>`).join('')||'<p>Пов’язаних матеріалів ще немає.</p>'))+'</aside></div>');
 }
 function vocabularies(){
  if(!archive){denied();return;}
  const schemes=t.vocabulary_scheme.filter(x=>!x.owner_archive_id||can(st,actor,'domain.read',x.owner_archive_id)),scheme=params.has('scheme')?schemes.find(x=>x.id===params.get('scheme')):schemes.find(x=>x.governance_mode==='domain'&&t.vocabulary_term.some(v=>v.scheme_id===x.id))||schemes[0];if(!scheme){denied();return;}
  const rows=t.vocabulary_term.filter(x=>x.scheme_id===scheme.id),write=scheme.governance_mode!=='system'&&activeArchive('vocabulary.write'),termLabel=x=>t.term_label.find(l=>l.term_id===x.id&&l.kind==='preferred')?.label||x.source_label||'Без назви';
  const editor=row=>form(row?'Редагувати термін':'Новий термін',input('label','Назва',row?termLabel(row):'','text',true)+input('definition','Визначення',row?.definition||'','textarea')+select('parent_id','Ширший термін','<option value="">Без ширшого терміна</option>'+opts(rows.filter(x=>x.id!==row?.id&&x.status==='active'),row?.parent_id,termLabel))+select('status','Використання',choices([['active','Чинний'],['deprecated','Застарілий']],row?.status||'active'),'Застарілий термін залишається в наявних описах. Для нових записів обирайте чинний термін.'),fd=>({type:'field.term',id:row?.id,scheme_id:scheme.id,archive_id:archive,...Object.fromEntries(fd)}));
  action('add',()=>editor(null));rows.forEach(x=>action('term-'+x.id,()=>editor(x)));
  const branch=parent=>`<ul class="term-list">${rows.filter(x=>x.parent_id===parent).map(x=>`<li><div><span><strong>${esc(termLabel(x))}</strong>${x.status==='deprecated'?'<small>Застарілий</small>':''}${x.definition?`<p>${esc(x.definition)}</p>`:''}</span>${btn('Редагувати','term-'+x.id,write)}</div>${branch(x.id)}</li>`).join('')}</ul>`;
  show(heading('Архівний опис','Довідники та терміни','Оберіть довідник для перегляду або уточнення термінів.',btn('Новий термін','add',write))+`<div class="archive-layout"><nav class="scheme-list" aria-label="Довідники">${schemes.map(x=>`<a href="${pg(20,{scheme:x.id})}" ${x.id===scheme.id?'aria-current="page"':''}>${esc(x.name)}<small>${({system:'Системний',local:'Локальний',domain:'Предметний'})[x.governance_mode]}</small></a>`).join('')}</nav><div>`+panel(scheme.name,body((scheme.governance_mode==='system'?'<p class="muted">Лише перегляд</p>':'')+(rows.length?branch(null):'<p>Термінів ще немає.</p>')))+`</div></div>`);
 }
 return {'PG-04':researches,'PG-05':researchDetail,'PG-06':contacts,'PG-07':sessions,'PG-08':sessionDetail,'PG-09':notebook,'PG-16':archiveTree,'PG-17':unitDetail,'PG-18':authorities,'PG-19':authorityDetail,'PG-20':vocabularies};
}
