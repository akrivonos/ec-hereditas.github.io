import {consentMedia} from '../data/consent-media.mjs?v=20261002-feedback2';
import {preservationUI} from './preservation.mjs?v=20261002-feedback2';
import {preservationStatus} from '../data/preservation.mjs?v=20261002-feedback2';
import {qualityDialog,qualityHistory} from './quality.mjs?v=20261002-feedback2';
import {digitizationDialog} from './digitization.mjs?v=20261002-feedback2';
import {preparationUI} from './capture-preparation.mjs?v=20261002-feedback2';
import {preparationFacts,plannedOutputs} from '../data/capture-preparation.mjs?v=20261002-feedback2';
import {legacyPages} from './legacy.mjs?v=20261002-feedback2';
import {intakePages} from './intake.mjs?v=20261002-feedback2';
import {transferPreflight,inspectTransfer} from './handover.mjs?v=20261002-feedback2';
import {mediaPreview,download} from './session-media.mjs?v=20261002-feedback2';
import {can,hash} from '../data/model.mjs?v=20261002-feedback2';
import {currentCustody,latestCondition,independentCopies,capturePlan,qcFacts,handoverState} from '../data/media.mjs?v=20261002-feedback2';
import {hint} from './help.mjs?v=20261002-feedback2';
import {wizard} from './wizard.mjs?v=20261002-feedback2';

export function mediaPages(ctx){
 const {s,actor,scope,esc,pg,button,panel,heading,shell,dialog,render,flash,dispatch,denied,date}=ctx,st=s(),t=st.tables;
 const by=(table,id)=>t[table]?.find(x=>x.id===id),entity=id=>by('entity',id),rev=id=>entity(id)?.current_revision_id;
 const label=id=>{const e=entity(id),r=e&&by(e.entity_type,id);return r?.title||r?.label||r?.name||r?.preferred_name||r?.original_filename||r?.external_key||(e?.entity_type==='timed_layer'?'Часові позначки: '+label(by('representation',r.representation_id).asset_id):'Без назви');};
 const actorLabel=id=>st.demo.actors.find(x=>x.account_id===id)?.label||'Не призначено';
 const allowed=(id,p='domain.read')=>can(st,actor,p,entity(id)?.archive_id)&&(!consentMedia(st,id)||can(st,actor,'consent.read',entity(id)?.archive_id)),visible=table=>(t[table]||[]).filter(x=>allowed(x.id)&&(!scope||entity(x.id).archive_id===scope));
 const archive=scope||t.archive.find(x=>can(st,actor,'domain.read',x.id))?.id;
 const params=new URLSearchParams(location.search),chosen=rows=>params.has('id')?rows.find(x=>x.id===params.get('id')):rows[0];
 const body=html=>`<div class="panel-body">${html}</div>`,btn=(title,key,enable=true)=>`<button type="button" class="button secondary small" data-media-action="${key}" ${enable?'':'disabled'}>${esc(title)}</button>`;
 const input=(name,title,value='',type='text',required=false,tip='')=>`<div class="field-control"><label>${esc(title)}${type==='textarea'?`<textarea name="${name}" ${required?'required':''}>${esc(value)}</textarea>`:`<input name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''}>`}</label>${tip?hint(title,tip):''}</div>`;
 const select=(name,title,options,tip='')=>`<div class="field-control"><label>${esc(title)}<select name="${name}">${options}</select></label>${tip?hint(title,tip):''}</div>`;
 const options=(rows,value='',name=x=>label(x.id))=>rows.map(x=>`<option value="${x.id}" ${x.id===value?'selected':''}>${esc(name(x))}</option>`).join('');
 const choices=(values,current)=>Object.entries(values).map(([v,l])=>`<option value="${v}" ${v===current?'selected':''}>${esc(l)}</option>`).join('');
 const table=(heads,rows)=>rows.length?`<div class="table-wrap media-table"><table><thead><tr>${heads.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td data-label="${esc(heads[i])}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:body('<p class="muted">Записів ще немає.</p>');
 const details=values=>`<dl class="detail-list">${values.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v??'Не зазначено')}</dd></div>`).join('')}</dl>`;
 const labels={prepared:'Підготовлено',sent:'Надіслано',accepted:'Прийнято',returned:'Повернуто',present:'Звірено',missing:'Відсутнє',unresolved:'Потрібне уточнення',verified:'Перевірено',pending:'Очікує перевірки',corrupt:'Пошкоджено',retired:'Виведено з використання',stable:'Придатний до роботи',fragile:'Крихкий',unsafe:'Працювати небезпечно',unknown:'Стан невідомий',ready:'Готово до фіксації',postponed:'Відкладено',pass:'Пройдено',fail:'Не пройдено',pass_with_note:'Прийнято із зауваженням',recapture_required:'Потрібна повторна фіксація',incomplete:'Некомплектне',match:'Контрольна сума збігається',mismatch:'Контрольна сума не збігається',unreadable:'Не читається',deferred:'Відкладено',rejected:'Відхилено',received_original:'Отриманий оригінал',preservation_master:'Майстер для збереження',access_derivative:'Копія для перегляду',thumbnail:'Мініатюра',in_progress:'Триває',completed:'Завершено',failed:'Помилка'};
 const badge=value=>`<span class="badge ${['missing','corrupt','fail','recapture_required','unsafe','returned','failed'].includes(value)?'blocked':value==='verified'||value==='pass'?'done':''}">${esc(labels[value]||value)}</span>`;
 const targets={field_research:5,collecting_session:8,information_unit:17,person:19,place:19,institution:19,document:9,source_system:21,source_record:22,physical_object:32,storage_location:33,work_item:34,capture_event:35,media_asset:38,representation:36,file_object:39,storage_copy:39};
 const link=(n,id,title=label(id),query={})=>`<a href="${pg(n,{id,...query})}">${esc(title)}</a>`;
 const entityLink=id=>{const e=entity(id);if(e?.entity_type==='document'&&by('document',id).kind==='session_form'){const context=t.document_context.find(x=>x.document_id===id&&x.context_role==='session_form');return link(8,context.target_entity_id,label(id),{section:'forms'});}if(e?.entity_type==='timed_layer'){const layer=by('timed_layer',id),rep=by('representation',layer.representation_id),session=t.media_asset_subject.find(x=>x.asset_id===rep.asset_id&&entity(x.subject_entity_id)?.entity_type==='collecting_session');return session?link(8,session.subject_entity_id,label(id),{section:'media',media:rep.id}):esc(label(id));}return link(targets[e?.entity_type]||1,id);};
 const actions={},action=(name,fn)=>actions[name]=fn;
 const show=html=>{shell(html);document.querySelectorAll('[data-media-action]').forEach(el=>el.onclick=async()=>{try{await actions[el.dataset.mediaAction]?.();}catch(e){flash(e.message,'error');render();}});};
 const save=async cmd=>{const result=await dispatch(cmd);flash(result.ok===false?'Дію не виконано. Перегляньте причину та повторіть спробу.':'Зміни збережено.',result.ok===false?'warning':'info');render();return result;};
 const form=(title,html,command,after)=>dialog(title,html,async fd=>{const result=await dispatch(command(fd));flash(result.ok===false?'Не вдалося виконати дію. Спробу збережено в історії.':'Зміни збережено.',result.ok===false?'warning':'info');if(after)after(result);else render();});
 const history=id=>`<details class="record-history"><summary>Історія змін</summary>${table(['Версія','Зміна'],t.entity_revision.filter(x=>x.entity_id===id).slice().reverse().map(x=>[String(x.revision_no),esc(x.change_reason)]))}</details>`;
 const chain=(obj,job,cap,rep)=>`<nav class="record-tabs" aria-label="Пов’язані записи">${[job?link(34,job,'До роботи з носієм'):'',obj?link(32,obj,'Носій'):'',cap?link(35,cap,'Фіксація'):'',rep?link(36,rep,'Якість'):''].filter(Boolean).join('')}</nav>`;
 const jobFor=id=>t.digitization_job.find(x=>x.work_item_id===id),scopeForH=h=>{const r=by('workflow_run',h.from_workflow_run_id),e=entity(r.primary_entity_id);return e.archive_id||e.id;};
 const sourceRead=id=>allowed(id,'legacy.write');
 const fieldRole=(params.get('role')||sessionStorage.getItem('hereditas.preview.role')||st.demo.actors.find(x=>x.account_id===actor)?.professional_role)==='R01';
 const curatorRole=(params.get('role')||sessionStorage.getItem('hereditas.preview.role')||st.demo.actors.find(x=>x.account_id===actor)?.professional_role)==='R02';
 const inboxQuery=()=>({role:'R02',state:params.get('state')||'',q:params.get('q')||''});
 const intake=()=>intakePages({st,actor,archive,can,scope,params,by,rev,action,dialog,input,select,choices,options,dispatch,render,flash,panel,body,table,details,btn,button,pg,esc,show,heading,label});
 function reviewHandover(h){intake().receive(h);}
 function inbox(){
  const state=params.get('state')||'',q=(params.get('q')||'').toLocaleLowerCase('uk'),all=t.handover.filter(h=>h.profile!=='research-dataset/1').filter(h=>!h.intake_record_id).filter(h=>['sent','accepted','returned'].includes(h.state)&&can(st,actor,'domain.read',scopeForH(h))&&(!scope||scopeForH(h)===scope)&&by('workflow_run',h.to_workflow_run_id)?.started_by===actor),rows=all.filter(h=>(!state||h.state===state)&&label(by('workflow_run',h.from_workflow_run_id).primary_entity_id).toLocaleLowerCase('uk').includes(q));
  rows.forEach(h=>action('review-'+h.id,()=>reviewHandover(h)));
  show(heading('Робочий список','Надходження','Звірте склад конкретного пакета, зафіксуйте розбіжності та ухваліть рішення. Перевірки й рішення покрокової форми записуються разом після підтвердження.')+
   `<nav class="journey-filters" aria-label="Стан надходжень">${Object.entries({'':'Усі',sent:'Очікують звірки',returned:'На уточненні',accepted:'Прийняті',partial:'Прийняті частково'}).map(([key,title])=>`<a href="${pg(10,{...inboxQuery(),state:key})}" ${key===state?'aria-current="page"':''}>${title}<span>${all.filter(h=>!key||h.state===key).length+(t.intake_record||[]).filter(r=>can(st,actor,'domain.read',r.archive_id)&&(!scope||r.archive_id===scope)&&(!key||r.state===(key==='sent'?'reviewing':key))).length}</span></a>`).join('')}</nav>`+
   `<form class="filters"><input type="hidden" name="role" value="R02"><input type="hidden" name="state" value="${esc(state)}">${input('q','Знайти надходження',params.get('q')||'')}<button class="button">Знайти</button></form>`+
   intake().list()+body(btn('Перевірити отриманий пакет','inspect-transfer'))+panel('Пакети до реєстрації',table(['Матеріали','Відправник','Стан / звірено','Потребує уваги','Наступна дія'],rows.map(h=>{const items=t.handover_item.filter(i=>i.handover_id===h.id),issues=items.filter(i=>entity(i.entity_id).entity_type==='file_object'&&independentCopies(st,i.entity_id)<2);return [link(11,h.id,label(by('workflow_run',h.from_workflow_run_id).primary_entity_id),inboxQuery()),esc(actorLabel(by('workflow_run',h.from_workflow_run_id).started_by)),badge(h.state)+`<span class="sub">${items.filter(i=>i.item_state==='present').length} із ${items.length}</span>`,issues.length?`<span class="sub">Без незалежного резерву: ${issues.length}</span>${button('Перевірити копії',pg(39,{...inboxQuery(),handover:h.id}),true)}`:h.state==='returned'?esc(h.notes):'—',h.state==='sent'?btn('Звірити надходження','review-'+h.id,can(st,actor,'intake.receive',scopeForH(h))).replace('button secondary small','button small'):h.state==='accepted'?button('Опрацювати матеріали',pg(17,{role:'R02',handover:h.id}),true):link(11,h.id,'Переглянути зауваження',inboxQuery())];}))));
 }
 function prepareHandover(session){
  if(!allowed(session.id,'intake.send')){denied();return;}
  const a=entity(session.id).archive_id,captures=t.capture_event.filter(x=>x.session_id===session.id),fileIds=new Set(t.capture_output.filter(x=>captures.some(c=>c.id===x.capture_event_id)).map(x=>x.file_id));
  const assets=t.media_asset_subject.filter(x=>x.subject_entity_id===session.id).map(x=>x.asset_id),reps=t.representation.filter(x=>assets.includes(x.asset_id)).map(x=>x.id);
  t.representation_file.filter(x=>reps.includes(x.representation_id)).forEach(x=>fileIds.add(x.file_id));
  const candidates=[...visible('information_unit').filter(x=>x.session_id===session.id),...visible('document').filter(x=>['field_notebook','session_form'].includes(x.kind)&&t.document_context.some(c=>c.document_id===x.id&&c.target_entity_id===session.id)),...visible('file_object').filter(x=>fileIds.has(x.id)),...visible('timed_layer').filter(x=>reps.includes(x.representation_id))];
  const subjects=new Set([session.id,...candidates.map(x=>x.id),...reps]);
  candidates.push(...visible('textual_representation').filter(x=>subjects.has(x.subject_entity_id)));
  if(can(st,actor,'consent.read',a))candidates.push(...visible('consent_record').filter(x=>x.session_id===session.id));
  const receivers=t.account.filter(x=>can(st,x.id,'intake.receive',a));
  wizard({dialog,esc},{title:'Підготувати передання',submit:'Зберегти пакет',steps:[
   {title:'Сеанс і отримувач',body:body(details([['Сеанс',session.title]]))+select('receiver_id','Приймач',options(receivers,'',x=>actorLabel(x.id)))+input('notes','Примітка','','textarea')},
   {title:'Склад пакета',body:`<p>Опис сеансу входить до пакета. Оберіть пов’язані матеріали. Згоди додавайте окремо за потреби; приватні докази згоди не включаються.</p><fieldset><legend>Матеріали</legend>${candidates.map(x=>`<label class="check-label"><input type="checkbox" name="items" value="${x.id}" ${entity(x.id).entity_type==='consent_record'?'':'checked'}>${esc(entity(x.id).entity_type==='consent_record'?'Згода: '+label(x.person_id):entity(x.id).entity_type==='textual_representation'?'Текст: '+(x.body_text||'').slice(0,70):label(x.id))}${entity(x.id).entity_type==='file_object'?` · незалежних копій: ${independentCopies(st,x.id)}`:''}</label>`).join('')||'<p>Пов’язаних матеріалів ще немає.</p>'}</fieldset>`}
  ],summary:v=>details([['Приймач',actorLabel(v.receiver_id)],['Опис сеансу',session.title],['Матеріали',(v.items||[]).map(label).join('\n')||'Лише опис сеансу'],['Примітка',v.notes]])+`<p>Пакет буде підготовлено. Надсилання — окрема дія у списку передань.</p>`+((v.items||[]).some(id=>fileIds.has(id)&&independentCopies(st,id)<2)?'<p>Перед відправленням перевірте копії відповідно до плану резервування.</p>':''),onSubmit:async v=>{
   const ids=[session.id,...(v.items||[])];await dispatch({type:'media.handover.create',archive_id:a,receiver_id:v.receiver_id,notes:v.notes,field_preflight:true,entity_ids:ids,expected_revision_ids:Object.fromEntries(ids.map(id=>[id,rev(id)]))});
   flash('Пакет підготовлено. Перейдіть до звірки у списку передань.');render();
  }});
 }

 const preparation=preparationUI({st,t,by,entity,rev,label,visible,allowed,esc,pg,dialog,dispatch,render,flash,body,details,input,select,options,choices,panel,btn,action,table,history});
 const jobsVisible=()=>t.digitization_job.filter(j=>allowed(j.work_item_id)&&(!scope||entity(j.work_item_id).archive_id===scope));
 const jobProgress=job=>{
  const cap=t.capture_event.filter(x=>x.digitization_job_id===job.work_item_id).at(-1),rep=cap&&t.representation.find(x=>x.technical_metadata?.capture_event_id===cap.id);
  const qc=rep&&t.qc_record.filter(x=>x.representation_revision_id===rev(rep.id)).at(-1),facts=rep&&qcFacts(st,rep);
  const ready=preparationFacts(st,job).ready;
  const planChanged=cap&&cap.settings.capture_plan_revision_id!==job.capture_plan_revision_id;
  const stage=planChanged?(ready?'capture':'prepare'):qc&&['pass','pass_with_note'].includes(qc.outcome)?'accepted':!ready?'prepare':!rep?'capture':qc&&['recapture_required','incomplete'].includes(qc.outcome)?'repeat':'review';
  return {cap,rep,qc,facts,stage};
 };
 const stageNames={prepare:'Підготовка',capture:'Готово до фіксації',review:'Очікує перевірки',repeat:'Повторна фіксація',accepted:'Технічно прийнято'};
 const listQuery=()=>({role:'R03',q:params.get('q')||'',stage:params.get('stage')||''});
 const workLink=job=>pg(34,{...listQuery(),id:job.work_item_id});
 const done=message=>{flash(message);render();};
 const planWizard=(job=null,physical=null)=>preparation.planWizard(job,physical);
 function qcDialog(rep){return qualityDialog({st,t,esc,dialog,input,select,choices,details,table,dispatch,done,rev,label},rep);}
 function nextAction(job,p){
  const key='next-'+job.work_item_id;
  if(p.stage==='prepare')return button('Підготувати носій',workLink(job)+'#preparation',true);
  if(p.stage==='accepted')return button('Переглянути результат',pg(38,{id:p.rep.asset_id,representation:p.rep.id}),true);
  const title={prepare:'Підготувати план',capture:p.cap?'Повторити фіксацію':'Зафіксувати матеріал',review:'Перевірити результат',repeat:'Повторити фіксацію'}[p.stage];
  action(key,()=>p.stage==='prepare'?planWizard(job):p.stage==='review'?qcDialog(p.rep):captureDialog(job,p.cap));
  return btn(title,key,allowed(job.work_item_id,p.stage==='prepare'?'physical.write':'media.write')).replace('button secondary small','button small');
 }
 function jobList(){
  const all=jobsVisible(),q=(params.get('q')||'').toLocaleLowerCase('uk'),stage=params.get('stage')||'',rows=all.filter(j=>(label(j.physical_object_id)+' '+by('physical_object',j.physical_object_id).reference_code).toLocaleLowerCase('uk').includes(q)&&(!stage||jobProgress(j).stage===stage));
  action('new-job',()=>planWizard());
  show(heading('Робочий список','Оцифрування','Оберіть носій у списку та виконайте наступну дію. План і фіксація мають покрокові форми; перевірка результату відкривається в діалозі.',btn('Нове оцифрування','new-job',can(st,actor,'physical.write',archive)&&visible('physical_object').some(x=>allowed(x.id,'physical.write'))))+
   `<nav class="journey-filters" aria-label="Етапи оцифрування">${[['','Усі роботи'],...Object.entries(stageNames)].map(([key,name])=>`<a href="${pg(34,{role:'R03',q:params.get('q'),stage:key})}" ${key===stage?'aria-current="page"':''}>${esc(name)} <span>${key?all.filter(j=>jobProgress(j).stage===key).length:all.length}</span></a>`).join('')}</nav>`+
   `<form class="filters"><input type="hidden" name="role" value="R03"><input type="hidden" name="stage" value="${esc(stage)}">${input('q','Знайти носій',params.get('q')||'')}<button class="button">Знайти</button></form>`+
   (rows.length?panel('Роботи',table(['Носій','Етап','Результат','Наступна дія'],rows.map(job=>{const p=jobProgress(job),obj=by('physical_object',job.physical_object_id);return [`<a href="${workLink(job)}">${esc(obj.title)}</a><span class="sub">${esc(obj.reference_code||'Без шифру')}</span>`,badge(stageNames[p.stage]),p.rep?`${p.facts.files.length} із ${p.facts.expected??'?'} частин`:'Ще немає',nextAction(job,p)];}))):body(`<p>${all.length?'Немає робіт за цими умовами. Змініть пошук або етап.':'Робіт ще немає. Додайте носій, а потім створіть оцифрування.'}</p>${button('Фізичні носії',pg(31),true)}`)));
 }

 function transfers(){
  action('inspect-transfer',()=>inspectTransfer({dialog,esc,table,body}));
  if(curatorRole&&!params.has('tab')){inbox();return;}
  const tab=params.get('tab')||(fieldRole?'outgoing':'incoming'),q=(params.get('q')||'').toLocaleLowerCase('uk');
  const rows=t.handover.filter(h=>h.profile!=='research-dataset/1').filter(h=>can(st,actor,'domain.read',scopeForH(h))&&(!scope||scopeForH(h)===scope)).filter(h=>tab==='all'||by('workflow_run',tab==='incoming'?h.to_workflow_run_id:h.from_workflow_run_id)?.started_by===actor).filter(h=>!q||label(by('workflow_run',h.from_workflow_run_id).primary_entity_id).toLocaleLowerCase('uk').includes(q));
  action('create',()=>form('Підготувати передання',select('receiver','Приймач',options(t.account.filter(a=>can(st,a.id,'intake.receive',archive)),'',a=>actorLabel(a.id)))+`<fieldset><legend>Матеріали пакета</legend>${['collecting_session','physical_object','file_object'].flatMap(visible).map(x=>`<label class="check-label"><input type="checkbox" name="items" value="${x.id}">${esc(label(x.id))}</label>`).join('')}</fieldset>`+input('notes','Примітка','','textarea'),fd=>({type:'media.handover.create',archive_id:archive,receiver_id:fd.get('receiver'),entity_ids:fd.getAll('items'),notes:fd.get('notes')}),r=>location.href=pg(11,{id:r.id})));
  rows.forEach(h=>action('send-'+h.id,()=>dialog('Надіслати пакет',`<p>Передати підготовлений пакет «${esc(label(by('workflow_run',h.from_workflow_run_id).primary_entity_id))}» отримувачу ${esc(actorLabel(by('workflow_run',h.to_workflow_run_id).started_by))}?</p>`,async()=>{await dispatch({type:'media.handover',id:h.id,expected_hash:await hash(handoverState(st,h)),action:'send'});done('Пакет надіслано. Очікуємо звірки та рішення отримувача.');},'Надіслати')));
  show(heading('Робочий список','Передання та надходження','Підготуйте пакет із конкретного сеансу. Збережіть файл пакета, передайте отримувачу й зафіксуйте передання. Рішення про приймання видно в цьому списку.',fieldRole?button('Обрати сеанс',pg(7,{role:'R01'})):btn('Підготувати передання','create',can(st,actor,'intake.send',archive)))+`<nav class="record-tabs" aria-label="Напрям передання">${Object.entries({incoming:'Вхідні',outgoing:'Вихідні',all:'Усі доступні'}).map(([v,l])=>`<a href="${pg(10,{tab:v})}" ${tab===v?'aria-current="page"':''}>${l}</a>`).join('')}</nav><form class="filters"><input type="hidden" name="tab" value="${esc(tab)}"><label>Пошук<input name="q" value="${esc(params.get('q')||'')}"></label><button class="button">Знайти</button></form>`+body(btn('Перевірити отриманий пакет','inspect-transfer'))+panel('Пакети',table(['Матеріали','Відправник → приймач','Стан','Звірено','Дія'],rows.map(h=>{const items=t.handover_item.filter(i=>i.handover_id===h.id);return [link(11,h.id,label(by('workflow_run',h.from_workflow_run_id).primary_entity_id),{tab,q:params.get('q')}),esc(actorLabel(by('workflow_run',h.from_workflow_run_id).started_by))+' → '+esc(actorLabel(by('workflow_run',h.to_workflow_run_id)?.started_by)),badge(h.state),`${items.filter(i=>i.item_state==='present').length} / ${items.length}`,['prepared','returned'].includes(h.state)?(h.preflight?link(11,h.id,'Звірити та передати',{role:'R01'}):btn('Надіслати','send-'+h.id,can(st,actor,'intake.send',scopeForH(h)))):link(11,h.id,'Переглянути',{tab,q:params.get('q')})];}))));

 }
 function transferDetail(){
  if(params.has('intake')){intake().detail();return;}
  if(!params.has('id')){transfers();return;}
  const h=chosen(t.handover.filter(h=>h.profile!=='research-dataset/1').filter(h=>can(st,actor,'domain.read',scopeForH(h))&&(!scope||scopeForH(h)===scope)));if(!h){denied();return;}
  const a=scopeForH(h),items=t.handover_item.filter(x=>x.handover_id===h.id),receive=can(st,actor,'intake.receive',a),send=can(st,actor,'intake.send',a),primary=by('workflow_run',h.from_workflow_run_id).primary_entity_id;
  const cmd=async(values)=>save({type:'media.handover',id:h.id,expected_hash:await hash(handoverState(st,h)),...values});
  action('send',()=>h.preflight?dialog('Зафіксувати передання','<p>Спочатку збережіть файл пакета та передайте його отримувачу обраним способом.</p><label class="check-label"><input type="checkbox" name="delivered" required>Файл пакета передано отримувачу</label>',fd=>cmd({action:'send',delivery_confirmed:fd.has('delivered')}),'Підтвердити передання'):cmd({action:'send'}));action('accept',()=>h.intake_record_id?location.href=pg(11,{role:'R02',intake:h.intake_record_id}):intake().receive(h));
  action('return',()=>{const expected=hash(handoverState(st,h));dialog('Повернути на уточнення',input('reason','Зауваження','','textarea',true),async fd=>save({type:'media.handover',id:h.id,expected_hash:await expected,action:'return',reason:fd.get('reason')}),'Повернути');});
  items.forEach(item=>action('item-'+item.position,()=>{const expected=hash(handoverState(st,h));dialog('Звірити елемент',select('state','Результат звірки',choices({present:'Наявний і звірений',missing:'Відсутній',unresolved:'Потребує уточнення'},item.item_state))+input('reason','Зауваження','','textarea'),async fd=>save({type:'media.handover',id:h.id,expected_hash:await expected,action:'check',position:item.position,item_state:fd.get('state'),reason:fd.get('reason')}));}));
  const preflight=transferPreflight({st,actor,can,archive:a,action,dialog,input,select,choices,dispatch,flash,render,panel,body,table,details,btn,button,pg,esc},h);
  show(heading('Передання',label(primary),'Приймання пакета не є дозволом публікації. Для цифрових файлів потрібні перевірені незалежні копії.',button('← Усі передання',pg(10,curatorRole?inboxQuery():{tab:params.get('tab')||(fieldRole?'outgoing':'all'),q:params.get('q')}),true))+`<div class="media-status">${badge(h.state)}<span>${esc(actorLabel(by('workflow_run',h.from_workflow_run_id).started_by))} → ${esc(actorLabel(by('workflow_run',h.to_workflow_run_id)?.started_by))}</span></div>`+
   preflight+panel('Склад пакета',table(['Матеріал','Версія','Копії / контрольна сума','Звірка',''],items.map(i=>{const r=by('entity_revision',i.revision_id),f=by('file_object',i.entity_id);return [f?link(39,f.id,f.original_filename):entityLink(i.entity_id),String(r.revision_no),f?`${h.preflight?'Копії перевіряються для всього пакета':'Незалежних сховищ: '+independentCopies(st,f.id)}<small class="hash-value">${esc(i.item_checksum)}</small>`:'—',badge(i.item_state),btn('Звірити','item-'+i.position,receive&&h.state==='sent')];})))+
   panel('Рішення',body(`<p>${esc(h.notes||'Зауважень немає.')}</p>${h.accepted_at?`<p>Прийняла / прийняв: ${esc(actorLabel(h.accepted_by))} · ${esc(date(h.accepted_at))}</p>`:''}<div class="actions">${btn(h.preflight?'Зафіксувати передання':'Надіслати','send',send&&['prepared','returned'].includes(h.state))}${btn('Розглянути надходження','accept',receive&&h.state==='sent')}${btn('Повернути на уточнення','return',receive&&h.state==='sent')}${button('Збереження копій',pg(39),true)}</div>`)));
 }
 const legacyUI=()=>legacyPages({st,actor,archive,scope,params,t,by,rev,can,visible,allowed,label,action,dialog,input,select,options,choices,dispatch,render,flash,panel,body,table,details,btn,button,pg,esc,show,heading,form});
 function legacy(){legacyUI().list();}
 function sourceDetail(){
  if(!params.has('id')){legacy();return;}
  const row=chosen(visible('source_record'));if(!row){denied();return;}
  const matches=t.candidate.filter(x=>x.target_entity_id===row.id),links=t.source_record_link.filter(x=>x.source_record_id===row.id);
  action('match',()=>form('Запропонувати відповідність',select('entity_id','Матеріал або особа',options(['person','place','physical_object','information_unit'].flatMap(visible)))+input('reason','Підстава','','textarea',true),fd=>({type:'media.match',id:row.id,expected_revision_id:rev(row.id),...Object.fromEntries(fd)})));
  matches.forEach(x=>action('review-'+x.id,()=>form('Звірити відповідність',select('decision','Рішення',choices({accept:'Підтвердити',reject:'Відхилити',defer:'Відкласти'},'defer'))+input('reason','Обґрунтування','','textarea',true),fd=>({type:'media.match.review',id:x.id,expected_revision_id:rev(x.id),...Object.fromEntries(fd)}))));
  show(heading(label(row.source_system_id),row.source_locator||'Джерельний запис','Оригінал незмінний. Нова відповідність проходить окреме людське рішення.',button('← Джерело',pg(21,{id:row.source_system_id,role:'R02'}),true))+legacyUI().record(row)+`<div class="two-col"><div>`+panel('Оригінал',row.raw_payload?.columns&&row.raw_payload?.cells?table(['Поле джерела','Значення'],row.raw_payload.columns.map((name,i)=>[esc(name),esc(row.raw_payload.cells[i])])):body(`<pre class="source-text">${esc(row.raw_text||JSON.stringify(row.raw_payload,null,2))}</pre>`))+panel('Походження',body(details([['Позначення',row.external_key],['Місце в джерелі',row.source_locator],['Порядок',row.source_position],['Батьківський запис',row.parent_record_id?label(row.parent_record_id):'Не зазначено']])) )+`</div><aside>`+panel('Пов’язані об’єкти',body(links.map(x=>`<p>${entityLink(x.entity_id)}</p>`).join('')||'<p>Відповідностей ще немає.</p>'))+'</aside></div>'+
   panel('Пропозиції',table(['Можлива відповідність','Підстава','Стан',''],matches.map(x=>[entityLink(x.proposed_entity_id),esc(x.proposed_payload.reason),badge(x.state),button('Перевірити',pg(24,{role:'R02',id:x.id}),true)])),btn('Запропонувати відповідність','match',sourceRead(row.id)))+
   panel('Рішення',table(['Результат','Обґрунтування','Хто перевірив'],t.review_decision.filter(x=>matches.some(m=>m.id===x.target_entity_id)).map(x=>[esc({accept:'Підтверджено',reject:'Відхилено',defer:'Відкладено'}[x.decision]),esc(x.reason),esc(actorLabel(x.reviewer_account_id))]))));
 }
 function physicalList(){
  const q=(params.get('q')||'').toLocaleLowerCase('uk'),condition=params.get('condition')||'',rows=visible('physical_object').filter(x=>(x.title+' '+x.reference_code).toLocaleLowerCase('uk').includes(q)&&(!condition||(latestCondition(st,x.id)?.condition_code||'unknown')===condition));
  action('new',()=>form('Новий фізичний носій',input('title','Назва','','text',true)+input('reference_code','Шифр')+select('carrier_type_term_id','Тип носія',options(t.vocabulary_term.filter(x=>x.status==='active'&&by('vocabulary_scheme',x.scheme_id)?.d_code==='D12'),'',x=>t.term_label.find(l=>l.term_id===x.id)?.label||x.code))+input('inscriptions','Написи на носії','','textarea')+input('composition','Частини та склад','','textarea'),fd=>({type:'media.physical.create',archive_id:archive,...Object.fromEntries(fd)}),r=>location.href=pg(32,{id:r.id})));
  show(heading('Фізичні матеріали','Фізичні джерела','Стан носія визначає остання оцінка. Відсутність оцінки не означає придатність до роботи.',btn('Новий носій','new',can(st,actor,'physical.write',archive)))+`<form class="filters"><label>Пошук<input name="q" value="${esc(params.get('q')||'')}"></label>${select('condition','Стан',choices({'':'Усі',stable:'Придатний',fragile:'Крихкий',unsafe:'Небезпечний',unknown:'Невідомий'},condition))}<button class="button">Знайти</button></form>`+panel('Носії',table(['Носій','Стан','Місце зберігання'],rows.map(x=>[link(32,x.id)+`<span class="sub">${esc(x.reference_code||'Без шифру')}</span>`,badge(latestCondition(st,x.id)?.condition_code||'unknown'),currentCustody(st,x.id)?.to_location_id?link(33,currentCustody(st,x.id).to_location_id):'Невідоме']))));
 }
 const moveDialog=row=>{const custody=currentCustody(st,row.id);form('Перемістити носій',select('to_location_id','Нове місце',options(visible('storage_location'),custody?.to_location_id))+input('reason','Підстава переміщення','','textarea',true),fd=>({type:'media.move',id:row.id,expected_custody_id:custody?.id||null,...Object.fromEntries(fd)}));};
 function physicalDetail(){
  if(!params.has('id')){physicalList();return;}
  const row=chosen(visible('physical_object'));if(!row){denied();return;}const write=allowed(row.id,'physical.write'),custody=currentCustody(st,row.id),condition=latestCondition(st,row.id),jobs=t.digitization_job.filter(x=>x.physical_object_id===row.id);
  action('edit',()=>form('Опис носія',input('title','Назва',row.title,'text',true)+input('reference_code','Шифр',row.reference_code)+input('inscriptions','Написи',row.inscriptions,'textarea')+input('composition','Частини та склад',row.composition,'textarea')+input('provenance_note','Походження',row.provenance_note,'textarea'),fd=>({type:'media.physical.save',id:row.id,expected_revision_id:rev(row.id),values:Object.fromEntries(fd)})));
  action('assess',()=>form('Нова оцінка стану',select('condition_code','Стан',choices({stable:'Придатний до роботи',fragile:'Крихкий',unsafe:'Працювати небезпечно',unknown:'Стан невідомий'},'unknown'))+input('risk_notes','Ризики','','textarea')+input('handling_instructions','Правила поводження','','textarea')+input('evidence_note','Що спостерігали під час огляду','','textarea',true),fd=>({type:'media.condition',id:row.id,expected_revision_id:rev(row.id),...Object.fromEntries(fd)})));
  action('move',()=>moveDialog(row));action('job',()=>planWizard(null,row));
  show(heading(row.reference_code||'Фізичний носій',row.title,'Оцінки та переміщення зберігаються в історії. Переміщення носія не змінює цифрові копії.',button('← Фізичні джерела',pg(31),true))+chain(row.id,jobs[0]?.work_item_id)+`<div class="two-col"><div>`+
   panel('Опис',body(details([['Написи',row.inscriptions],['Склад',row.composition],['Походження',row.provenance_note]])),btn('Редагувати','edit',write))+
   panel('Оцінки стану',table(['Стан','Ризики та поводження','Дата'],t.condition_assessment.filter(x=>x.physical_object_id===row.id).slice().reverse().map(x=>[badge(x.condition_code),esc(x.risk_notes||'—')+`<span class="sub">${esc(x.handling_instructions||'')}</span>`,esc(date(x.assessed_at))])),btn('Оцінити стан','assess',write))+
   panel('Історія переміщень',table(['Звідки → куди','Підстава'],t.custody_event.filter(x=>x.physical_object_id===row.id).slice().reverse().map(x=>[esc(x.from_location_id?label(x.from_location_id):'Невідоме місце')+' → '+esc(x.to_location_id?label(x.to_location_id):'Відповідальному'),esc(x.reason)])))+history(row.id)+`</div><aside>`+
   panel('Зараз',body(`${badge(condition?.condition_code||'unknown')}<p class="section-space">${custody?.to_location_id?link(33,custody.to_location_id):'Місце зберігання невідоме'}</p>`),btn('Перемістити','move',write))+
   panel('Оцифрування',body(jobs.map(x=>`<p>${link(34,x.work_item_id)}</p>`).join('')||'<p>Завдань ще немає.</p>'),btn('Підготувати план','job',write))+'</aside></div>');
 }
 function locations(){
  const rows=visible('storage_location'),row=chosen(rows);if(params.has('id')&&!row){denied();return;}
  const editor=record=>form(record?'Редагувати місце':'Нове місце зберігання',input('label','Назва',record?.label||'','text',true)+input('code','Позначення',record?.code||'','text',true)+select('parent_id','У складі','<option value="">Окреме місце</option>'+options(rows.filter(x=>x.id!==record?.id),record?.parent_id||row?.id))+select('institution_id','Відповідальна установа',options(visible('institution'),record?.institution_id)),fd=>({type:'media.location',id:record?.id,expected_revision_id:record?rev(record.id):undefined,archive_id:archive,...Object.fromEntries(fd)}),r=>location.href=pg(33,{id:r.id}));
  action('new',()=>editor(null));action('edit',()=>editor(row));
  const branch=parent=>`<ul>${rows.filter(x=>x.parent_id===parent).map(x=>`<li><a href="${pg(33,{id:x.id})}" ${row?.id===x.id?'aria-current="page"':''}>${esc(x.label)}<small>${esc(x.code)}</small></a>${branch(x.id)}</li>`).join('')}</ul>`;
  const objects=row?visible('physical_object').filter(x=>currentCustody(st,x.id)?.to_location_id===row.id):[];objects.forEach(x=>action('move-'+x.id,()=>moveDialog(x)));
  show(heading('Фізичне зберігання','Місця зберігання','Вміст місця визначається останніми подіями переміщення носіїв.',btn('Нове місце','new',can(st,actor,'physical.write',archive)))+`<div class="archive-layout"><nav class="archive-tree" aria-label="Фізичні місця">${branch(null)}</nav><div>`+(row?panel(row.label,body(`<p>${esc(label(row.institution_id))} · ${esc(row.code)}</p>${rows.filter(x=>x.parent_id===row.id).map(x=>`<p>${link(33,x.id)}</p>`).join('')}`)+table(['Носій',''],objects.map(x=>[link(32,x.id),btn('Перемістити','move-'+x.id,allowed(x.id,'physical.write'))])),btn('Редагувати місце','edit',allowed(row.id,'physical.write'))):panel('Носії',body('<p>Місць ще немає.</p>')))+`</div></div>`);
 }
 function plan(){
  if(!params.has('id')){jobList();return;}
  const job=jobsVisible().find(j=>j.work_item_id===params.get('id'));if(!job){denied();return;}
  const obj=by('physical_object',job.physical_object_id),p=jobProgress(job),parts=t.capture_plan_item.filter(x=>x.plan_revision_id===job.capture_plan_revision_id),caps=t.capture_event.filter(x=>x.digitization_job_id===job.work_item_id);
  action('plan',()=>planWizard(job));
  show(heading('Оцифрування',obj.title,'Основна дія залежить від останнього результату перевірки. Попередні фіксації та їхні плани зберігаються в історії.',button('← До списку оцифрування',pg(34,listQuery()),true))+
   `<div class="job-current"><div><span class="eyebrow">Поточний етап</span><h2>${esc(stageNames[p.stage])}</h2>${p.rep?`<p>${p.facts.files.length} із ${p.facts.expected??'?'} частин · ${p.qc?esc(p.qc.notes||'Перевірено'):'Результат ще не перевірено'}</p>`:''}</div>${nextAction(job,p)}</div>`+
   '<div id="preparation">'+preparation.preparationPanel(job)+'</div>'+panel('План роботи',table(['Порядок','Частина','Вид','Кількість'],parts.map(x=>[String(x.position),esc(x.part_label),esc(({image:'Зображення',audio:'Аудіо',video:'Відео'})[x.expected_kind]||x.expected_kind),x.expected_count])),btn('Редагувати план','plan',allowed(job.work_item_id,'physical.write')))+
   panel('Результати фіксацій',table(['Дата','Частини','Висновок',''],caps.slice().reverse().map(cap=>{const rep=t.representation.find(r=>r.technical_metadata?.capture_event_id===cap.id),qc=rep&&t.qc_record.filter(r=>r.representation_revision_id===rev(rep.id)).at(-1);return [esc(date(cap.occurred_at)),String(t.capture_output.filter(x=>x.capture_event_id===cap.id).length),qc?badge(qc.outcome):'Ще не перевірено',link(35,cap.id,'Обставини фіксації')+' · '+link(38,rep.asset_id,'Переглянути файли',{representation:rep.id})];})))+
   `<details class="record-history"><summary>Носій та умови роботи</summary>${body(`<p>${link(32,obj.id)}</p>`+details([['Стан носія',labels[latestCondition(st,obj.id)?.condition_code||'unknown']],['Профіль',job.specification.profile],['Коли зупинити роботу',job.specification.stop_conditions||'Не зазначено']]))}</details>`+history(job.work_item_id));
 }
 function captureDialog(job,previous,session=null){
  if(job)return digitizationDialog({st,t,rev,label,esc,dialog,input,select,options,choices,details,dispatch,done},job,previous);
  const parts=job?plannedOutputs(st,job.capture_plan_revision_id).map(x=>({part_label:x.label})):[{part_label:'Польовий запис'}],asset=previous?t.representation.find(x=>x.technical_metadata?.capture_event_id===previous.id)?.asset_id:null;
  wizard({dialog,esc},{title:previous?'Повторити фіксацію':'Зафіксувати матеріал',submit:'Зберегти фіксацію',steps:[
   {title:'Обсяг і пристрій',body:body(details([['Матеріал',label(job?.physical_object_id||session?.id)]]))+input('device_model','Пристрій',previous?.device_model||'')+select('count','Скільки частин зафіксовано',parts.map((x,i)=>`<option value="${i+1}" ${i===parts.length-1?'selected':''}>${i+1} із ${parts.length}</option>`).join(''))},
   {title:'Результат фіксації',body:input('content','Вміст файла прикладу','Навчальний результат.','textarea',true,'У цьому макеті створюються текстові файли прикладу. Сканер або рекордер не запускається.')+input('notes','Зауваження','','textarea')}
  ],summary:v=>details([['Матеріал',label(job?.physical_object_id||session?.id)],['Пристрій',v.device_model||'Не зазначено'],['Частини',parts.slice(0,Number(v.count)).map(x=>x.part_label).join(', ')],['Зауваження',v.notes||'Немає']]),onSubmit:async v=>{await dispatch({type:'media.capture',job_id:job?.work_item_id,session_id:session?.id,asset_id:asset,expected_revision_id:rev(job?.work_item_id||session.id),...v});done('Фіксацію збережено. Результат очікує перевірки.');}});
 }
 function capture(){
  if(!params.has('id')&&!params.has('session')){jobList();return;}
  if(params.has('session')&&!params.has('id')){
   const session=visible('collecting_session').find(x=>x.id===params.get('session'));if(!session){denied();return;}
   const caps=visible('capture_event').filter(x=>x.session_id===session.id);action('new',()=>captureDialog(null,null,session));
   show(heading(session.title,'Польова цифрова фіксація','Первісно цифровий запис пов’язується із сеансом; фізичний носій не потрібен.',btn('Імітувати фіксацію','new',allowed(session.id,'capture.field')))+panel('Події',table(['Подія','Пристрій'],caps.map((x,i)=>[link(35,x.id,'Фіксація '+(i+1)),esc(x.device_model||'Не зазначено')]))));return;
  }
  const row=chosen(visible('capture_event'));if(!row){denied();return;}
  const job=jobFor(row.digitization_job_id),rep=t.representation.find(x=>x.technical_metadata?.capture_event_id===row.id),outputs=t.capture_output.filter(x=>x.capture_event_id===row.id),parts=capturePlan(st,row),planrev=by('entity_revision',row.settings?.capture_plan_revision_id);
  action('repeat',()=>captureDialog(job,row,by('collecting_session',row.session_id)));
  action('capture-manifest',()=>download(JSON.stringify({capture:row,outputs:outputs.map(x=>({...x,file:by('file_object',x.file_id),origin:t.file_ingest_occurrence.find(o=>o.capture_event_id===row.id&&o.file_id===x.file_id)}))},null,2),'application/json','capture-manifest.json'));
  const previous=row.settings?.previous_capture_revision_id&&by('entity_revision',row.settings.previous_capture_revision_id);
  show(heading('Подія фіксації',job?label(job.physical_object_id):label(row.session_id),'Повторна фіксація створює нові подію, представлення й файли. Оригінали залишаються в історії.',btn('Повторити фіксацію','repeat',allowed(row.id,job?'media.write':'capture.field')))+chain(job?.physical_object_id,job?.work_item_id,row.id,rep?.id)+(previous?body(link(35,previous.entity_id,'Попередня фіксація')):'')+body(btn('Завантажити маніфест','capture-manifest'))+
   `<div class="two-col"><div>`+panel('Отримані файли',table(['Порядок','Частина','Файл','Розмір'],outputs.map(x=>[String(x.position),esc(x.notes),link(38,rep.asset_id,by('file_object',x.file_id).original_filename,{representation:rep.id}),`${by('file_object',x.file_id).byte_size} байт`])))+
   panel('Маніфест фіксації',table(['Частина','Файл','Контрольна сума'],t.manifest_entry.filter(x=>x.capture_event_id===row.id).map(x=>[esc(x.part_label),esc(by('file_object',x.file_id).original_filename),`<small class="hash-value">${esc(x.checksum)}</small>`])))+
   (row.session_id?body(link(8,row.session_id,'До сеансу')):'')+`</div><aside>`+
   panel('Обставини фіксації',body(details([['Оператор',label(row.operator_person_id)],['Пристрій',row.device_model],['Виробник',row.device_make],['Серійний номер',row.device_serial],['Програма',row.software_name],['Версія програми',row.software_version],['Дата',date(row.occurred_at)],['Фактичні параметри',row.settings?.actual_settings],['Відхилення',row.settings?.deviation_reason],['Причина повтору',row.settings?.recapture_reason],['Зауваження',row.technical_incidents]])))+
   panel('Використаний план',body(planrev?`<p>Версія ${planrev.revision_no}</p><ol>${parts.map(x=>`<li>${esc(x.part_label)}</li>`).join('')}</ol>`:'<p>Первісно цифровий запис сеансу.</p>'))+'</aside></div>');
 }
 function qc(){
  if(!params.has('id')){
   const rows=visible('representation').filter(r=>t.capture_event.some(c=>c.id===r.technical_metadata?.capture_event_id&&c.digitization_job_id));
   show(heading('Контроль якості','Результати на перевірку','Відкрийте конкретний результат, звірте його з планом і зафіксуйте висновок.')+panel('Результати',table(['Матеріал','Версія','Висновок',''],rows.slice().reverse().map(r=>{const q=t.qc_record.filter(x=>x.representation_revision_id===rev(r.id)).at(-1);return [esc(label(r.asset_id)),String(r.representation_version),q?badge(q.outcome):'Очікує перевірки',link(36,r.id,'Перевірити')];}))));return;
  }
  const rep=chosen(visible('representation'));if(!rep){denied();return;}
  const facts=qcFacts(st,rep),job=jobFor(facts.capture?.digitization_job_id),records=t.qc_record.filter(x=>x.representation_revision_id===rev(rep.id));
  action('check',()=>qcDialog(rep));
  show(heading('Контроль якості',label(rep.asset_id),'Рішення стосується конкретної версії представлення. Комплектність і контрольні суми перевіряються за даними файлів.',btn('Записати перевірку','check',allowed(rep.id,'media.write')))+chain(job?.physical_object_id,job?.work_item_id,facts.capture?.id,rep.id)+
   `<div class="media-status">${badge(rep.role)}<span>Версія ${rep.representation_version}</span>${button('Переглянути файли',pg(38,{id:rep.asset_id,representation:rep.id}),true)}</div>`+
   panel('Звірка з планом',table(['Перевірка','Очікуване / наявне','Результат'],[['Комплектність',`${facts.expected??'Не визначено'} / ${facts.files.length}`,badge(facts.complete?'pass':'fail')],['Порядок частин','За планом використаної фіксації',badge(facts.order?'pass':'unknown')],['Контрольні суми','Повторний розрахунок під час перевірки','Відкрийте перевірку']]))+
   panel('Рішення та докази',body(qualityHistory({st,esc,details,action,btn,table,label},records)))+(['pass','pass_with_note'].includes(records.at(-1)?.outcome)?body(button('До збереження файлів',pg(39,{role:'R03',id:facts.files[0]?.file_id}),true)+' '+button('До звірки опису',pg(23,{role:'R02'}),true)):''));
 }
 const preservationTools=()=>preservationUI({write:can(st,actor,'media.write',archive),st,t,esc,dialog,input,select,choices,options,details,table,dispatch,render,flash,rev,archive,pg,button,btn,action,allowed,visible,by,panel,body,heading,show,label,params,date,badge});
 function mediaList(){
  const q=(params.get('q')||'').toLocaleLowerCase('uk'),unlinked=params.get('unlinked')==='yes',rows=visible('media_asset').filter(x=>x.title.toLocaleLowerCase('uk').includes(q)&&(!unlinked||!t.media_asset_subject.some(l=>l.asset_id===x.id)));
  action('ingest',()=>preservationTools().ingest());
  show(heading('Цифрові матеріали','Цифрові ресурси','Ресурс об’єднує оригінал, майстер і копії для перегляду. Файли та місця їх збереження мають власну історію.',btn('Прийняти файли','ingest',can(st,actor,'media.write',archive)))+`<form class="filters"><label>Пошук<input name="q" value="${esc(params.get('q')||'')}"></label>${select('unlinked','Зв’язок із матеріалами',choices({'':'Усі',yes:'Ще не пов’язані'},params.get('unlinked')||''))}<button class="button">Знайти</button></form>`+panel('Ресурси',table(['Ресурс','Матеріали','Представлення'],rows.map(x=>[link(38,x.id),t.media_asset_subject.filter(l=>l.asset_id===x.id).map(l=>entityLink(l.subject_entity_id)).join('<br>')||'Ще не пов’язано',t.representation.filter(r=>r.asset_id===x.id).map(r=>badge(r.role)).join(' ')]))));
 }
 function mediaDetail(){
  if(!params.has('id')){mediaList();return;}
  const asset=chosen(visible('media_asset'));if(!asset){denied();return;}
  const reps=t.representation.filter(x=>x.asset_id===asset.id),rep=params.has('representation')?reps.find(x=>x.id===params.get('representation')):reps[0];if(!rep){denied();return;}
  const files=t.representation_file.filter(x=>x.representation_id===rep.id).sort((a,b)=>a.position-b.position),facts=qcFacts(st,rep),job=jobFor(facts.capture?.digitization_job_id),write=allowed(asset.id,'media.write');
  action('derivative',()=>preservationTools().ingest(rep));
  action('thumbnail',()=>preservationTools().thumbnail(rep));
  action('link',()=>form('Пов’язати з матеріалом',select('subject_id','Матеріал',options(['physical_object','collecting_session','information_unit'].flatMap(visible))),fd=>({type:'media.asset.link',id:asset.id,expected_revision_id:rev(asset.id),subject_id:fd.get('subject_id')})));
  files.forEach(x=>action('view-'+x.file_id,()=>{if(!allowed(x.file_id)){denied();return;}dialog('Вміст файла',mediaPreview(st.demo.file_contents[x.file_id],by('file_object',x.file_id).mime_type,esc),null,'Закрити');}));
  files.forEach(x=>action('download-'+x.file_id,()=>{if(allowed(x.file_id)){const f=by('file_object',x.file_id);download(st.demo.file_contents[f.id],f.mime_type,f.original_filename);}}));
  const source=t.representation_derivation.filter(x=>x.output_representation_id===rep.id);
  show(heading('Цифровий ресурс',asset.title,'Перемикання представлення не змінює оригінал. Перегляд доступний лише в межах наданих прав.',btn('Додати похідну копію','derivative',write)+' '+btn('Створити мініатюру','thumbnail',write&&files.some(x=>/^image\/(png|jpeg|webp)$/.test(by('file_object',x.file_id).mime_type))))+chain(job?.physical_object_id,job?.work_item_id,facts.capture?.id,rep.id)+
   `<nav class="record-tabs" aria-label="Представлення">${reps.map(x=>`<a href="${pg(38,{id:asset.id,representation:x.id})}" ${x.id===rep.id?'aria-current="page"':''}>${esc(labels[x.role])} · ${x.representation_version}</a>`).join('')}</nav>`+
   panel('Файли представлення',table(['№ / частина','Файл','Контрольна сума',''],files.map(x=>{const f=by('file_object',x.file_id);return [`${x.position} · ${esc(x.component_label)}`,esc(f.original_filename)+`<span class="sub">${f.byte_size} байт · ${esc(f.mime_type)}</span>`,`<small class="hash-value">${esc(f.sha256)}</small>`,btn('Переглянути','view-'+f.id,allowed(f.id))+' '+btn('Завантажити','download-'+f.id,allowed(f.id))];})))+
   body(button('Збереження файлів',pg(39,{id:files[0]?.file_id}),true)+' '+button('До архівного опису',pg(17,{role:'R02'}),true)+' '+button('Машинне опрацювання',pg(40,{role:'R03',source:rep.id}),true))+
   `<div class="two-col"><div>`+panel('Копії файлів',table(['Файл','Сховище','Стан','Незалежні сховища'],files.flatMap(x=>t.storage_copy.filter(c=>c.file_id===x.file_id).map(c=>[link(39,x.file_id,by('file_object',x.file_id).original_filename),esc(by('digital_storage_location',c.storage_location_id).name),badge(c.state),String(preservationStatus(st,x.file_id).independent)]))))+history(rep.id)+`</div><aside>`+
   panel('Пов’язані матеріали',body(t.media_asset_subject.filter(x=>x.asset_id===asset.id).map(x=>`<p>${entityLink(x.subject_entity_id)}</p>`).join('')||'<p>Ще не пов’язано.</p>'),btn('Пов’язати','link',write))+
   panel('Походження представлення',body(source.length?source.map(x=>{const r=by('entity_revision',x.input_representation_revision_id),inputRep=by('representation',r.entity_id);return `<p>${link(38,inputRep.asset_id,labels[inputRep.role]+' · '+inputRep.representation_version,{representation:inputRep.id})}</p><small>Версія опису ${r.revision_no}</small><p>${esc(x.operation)}</p>`;}).join(''):'<p>Отриманий результат фіксації або надходження.</p>'))+'</aside></div>');
 }
 function preservation(){
  const packageRow=params.get('handover')&&by('handover',params.get('handover'));
  if(params.has('handover')&&(!packageRow||!can(st,actor,'domain.read',scopeForH(packageRow))||(scope&&scopeForH(packageRow)!==scope))){denied();return;}
  const files=visible('file_object').filter(x=>!packageRow||t.handover_item.some(i=>i.handover_id===packageRow.id&&i.entity_id===x.id)),selected=params.has('id')?files.find(x=>x.id===params.get('id')):null;if(params.has('id')&&!selected){denied();return;}
  preservationTools().preservation(files,selected,packageRow);
 }
 return {prepareHandover,'PG-10':transfers,'PG-11':transferDetail,'PG-21':legacy,'PG-22':sourceDetail,'PG-31':physicalList,'PG-32':physicalDetail,'PG-33':locations,'PG-34':plan,'PG-35':capture,'PG-36':qc,'PG-37':mediaList,'PG-38':mediaDetail,'PG-39':preservation};
}
