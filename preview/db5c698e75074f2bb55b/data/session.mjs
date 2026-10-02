import {persistParticipantCodes,nextParticipantCode,participantCodes,unitPeople} from './participants.mjs?v=20261002-feedback2';
import {fileBytes,mediaMime,MAX_MEDIA_BYTES} from './binary.mjs?v=20261002-feedback2';
import {rawHash} from './media.mjs?v=20261002-feedback2';
import {consentBasisValid,useNames} from './workbench.mjs?v=20261002-feedback2';
export const eventKinds=[['participant_joined','Приєднання учасника'],['participant_left','Вихід учасника'],['interruption','Перерва'],['technical_incident','Технічна проблема'],['other','Інша подія']];
export function recordingGaps(s,id,kind){
 const t=s.tables,use='record_'+kind,people=[...new Set(t.participation.filter(x=>x.session_id===id&&x.role_code==='performer').map(x=>x.person_id))];
 return people.filter(person=>!t.consent_record.some(c=>c.session_id===id&&c.person_id===person&&consentBasisValid(s,{consent_id:c.id,consent_revision_id:t.entity.find(e=>e.id===c.id).current_revision_id},id,'fieldwork',use)));
}
export function sessionRepresentations(s,id){const ids=s.tables.media_asset_subject.filter(x=>x.subject_entity_id===id).map(x=>x.asset_id);return s.tables.representation.filter(x=>ids.includes(x.asset_id));}
export function markerEntries(s,layer,rid=null){return (s.tables.timed_layer_entry||[]).filter(x=>x.layer_revision_id===(rid||s.tables.entity.find(e=>e.id===layer.id).current_revision_id)).sort((a,b)=>a.position-b.position);}
export function validateSession(s,ok,fk){
 const t=s.tables,by=(k,id)=>t[k]?.find(x=>x.id===id);
 for(const r of t.collecting_session){ok(!r.started_at||Number.isFinite(Date.parse(r.started_at)),'Час початку');ok(!r.ended_at||r.started_at&&Date.parse(r.ended_at)>=Date.parse(r.started_at),'Завершення перед початком');}
 for(const l of t.timed_layer||[]){ok(by('entity_revision',l.representation_revision_id)?.entity_id===l.representation_id,'Версія запису позначок');ok(['index','transcript','captions','translation'].includes(l.kind),'Тип часового шару');}
 const positions=new Set();for(const x of t.timed_layer_entry||[]){
  const l=by('entity_revision',x.layer_revision_id),seg=by('entity_revision',x.segment_revision_id);ok(by('entity',l?.entity_id)?.entity_type==='timed_layer'&&by('entity',seg?.entity_id)?.entity_type==='media_segment','Версії позначки');
  ok(l.snapshot.representation_revision_id===seg.snapshot.representation_revision_id,'Позначка іншого запису');ok(!!x.text_value?.trim(),'Текст позначки');
  const key=x.layer_revision_id+':'+x.position;ok(Number.isInteger(x.position)&&x.position>0&&!positions.has(key),'Порядок позначок');positions.add(key);
 }
 for(const v of t.entity_revision.filter(x=>by('entity',x.entity_id)?.entity_type==='timed_layer'))ok(JSON.stringify(v.snapshot._relations?.timed_layer_entry)===JSON.stringify((t.timed_layer_entry||[]).filter(x=>x.layer_revision_id===v.id)),'Змінено склад версії часових позначок');
}
export async function sessionCommand(s,actor,c,h){
 const {lookup,fresh,required,newEntity,revise,fail,reg,arch,need,hash}=h,t=s.tables,by=(k,id)=>t[k]?.find(x=>x.id===id),revision=id=>reg(id)?.current_revision_id;
 const r=lookup(c.id);if(reg(r.id).entity_type!=='collecting_session')fail('invalid','Оберіть сеанс.');fresh(r.id,c.expected_revision_id);
 const same=id=>{lookup(id);if(arch(id)!==arch(r.id))fail('invalid','Запис іншого архіву.');};
 const stamp=v=>{if(!v)return null;const n=Date.parse(v);if(!Number.isFinite(n))fail('invalid','Перевірте дату й час.');return new Date(n).toISOString();};
 if(c.type==='field.session.context'){
  for(const k of ['title','date_from','date_to','date_precision','date_label','recording_context','location_environment','location_description','context_notes'])if(k in c)r[k]=c[k]||null;
  required(r.title);if(!['indoor','outdoor','mixed','unknown'].includes(r.location_environment))fail('invalid','Оберіть середовище.');
  for(const k of ['date_from','date_to'])if(r[k]&&!/^\d{4}-\d{2}-\d{2}$/.test(r[k]))fail('invalid','Перевірте дату.');
  if('work_group_id'in c){const g=c.work_group_id&&by('work_group',c.work_group_id);if(g&&(g.research_id!==r.research_id||reg(g.id).retired_at))fail('invalid','Оберіть чинну групу дослідження.');if(c.work_group_id&&!g)fail('invalid','Групу не знайдено.');r.work_group_id=g?.id||null;}
  if('place_id'in c){if(c.place_id)same(c.place_id);if(c.place_id&&!by('place',c.place_id))fail('invalid','Оберіть місце.');const geo=t.geographic_context.find(x=>x.subject_entity_id===r.id&&x.role_code==='recording_place');
   if(geo){if(!c.place_id)fail('invalid','Оберіть місце або залиште попереднє.');geo.place_id=c.place_id;geo.source_label=by('place',c.place_id).name;await revise(geo,'Уточнено місце запису');}
   else if(c.place_id)await newEntity('geographic_context',{subject_entity_id:r.id,place_id:c.place_id,role_code:'recording_place',source_label:by('place',c.place_id).name,region_term_id:null,dialect_term_id:null,dialect_label_raw:null,evidence_id:null},arch(r.id));
  }
  await revise(r,'Уточнено обставини сеансу');return r;
 }
 if(c.type==='field.session.participant'){
  let p=c.participation_id&&by('participation',c.participation_id);if(c.participation_id&&p?.session_id!==r.id)fail('invalid','Учасник іншого сеансу.');
  let person=p?.person_id||c.person_id;if(!person){person=(await newEntity('person',{preferred_name:required(c.person_name),name_note:null},arch(r.id))).id;}
  same(person);if(!by('person',person))fail('invalid','Оберіть особу.');if(!['performer','collector','observer'].includes(c.role_code))fail('invalid','Оберіть функцію.');
  if(t.participation.some(x=>x.session_id===r.id&&x.person_id===person&&x.role_code===c.role_code&&x.id!==p?.id))fail('invalid','Ця участь уже є.');
  await persistParticipantCodes(t,r.id,revise);if(p&&p.role_code!==c.role_code){p.previous_codes=[...(p.previous_codes||[]),p.participant_code];p.participant_code=nextParticipantCode(t,r.id,c.role_code);}
  const values={role_code:c.role_code,function_text:c.function_text?.trim()||null,local_label:c.local_label?.trim()||null};
  if(p){Object.assign(p,values);await revise(p,'Уточнено участь у сеансі');}else p=await newEntity('participation',{person_id:person,session_id:r.id,research_id:null,work_group_id:r.work_group_id,...values,position:t.participation.filter(x=>x.session_id===r.id).length+1},arch(r.id));
  await revise(r,'Оновлено учасників сеансу');return p;
 }
 if(c.type==='field.session.event'){
  const rows=t.session_event.filter(x=>x.session_id===r.id).sort((a,b)=>a.position-b.position),old=c.position?rows.find(x=>x.position===Number(c.position)):null;
  if(c.position&&!old)fail('stale','Подію змінено.');
  if(c.remove){t.session_event=t.session_event.filter(x=>x!==old);rows.filter(x=>x!==old).forEach((x,i)=>x.position=i+1);}
  else {if(!eventKinds.some(x=>x[0]===c.kind))fail('invalid','Оберіть тип події.');if(c.participation_id&&by('participation',c.participation_id)?.session_id!==r.id)fail('invalid','Учасник іншого сеансу.');
   const values={kind:c.kind,note:required(c.note),occurred_at:stamp(c.occurred_at),participation_id:c.participation_id||null};if(old)Object.assign(old,values);else t.session_event.push({session_id:r.id,position:rows.length+1,...values});}
  await revise(r,'Уточнено перебіг сеансу');return r;
 }
 if(c.type==='field.session.timing'){
  r.started_at=stamp(c.started_at);r.ended_at=stamp(c.ended_at);if(r.ended_at&&!r.started_at)fail('invalid','Вкажіть час початку.');await revise(r,r.ended_at?'Завершено польовий сеанс':'Зафіксовано початок сеансу');return r;
 }
 if(c.type==='field.session.media'){
  need('capture.field',arch(r.id));if(!mediaMime(c.mime_type))fail('invalid','Підтримуються WAV, MP3, OGG, WebM, MP4, PNG, JPEG, WebP.');
  const bytes=fileBytes(c.content);if(c.content?.encoding!=='base64'||!bytes.length||bytes.length>MAX_MEDIA_BYTES)fail('invalid','Оберіть непорожній файл до 2 МіБ.');
  const kind=c.mime_type.startsWith('image/')?'photo':c.mime_type.split('/')[0];if(c.live&&recordingGaps(s,r.id,kind).length)fail('invalid','Спочатку задокументуйте дозвіл учасників на цей вид запису.');
  const origin=required(c.origin_note);if(c.duration_ms!=null&&(!Number.isInteger(c.duration_ms)||c.duration_ms<=0))fail('invalid','Перевірте тривалість.');
  const run={id:crypto.randomUUID(),workflow_code:'WF-03',primary_entity_id:r.id,started_by:actor,started_at:s.clock,finished_at:s.clock,state:'completed',notes:origin};t.workflow_run.push(run);
  const capture=await newEntity('capture_event',{session_id:r.id,digitization_job_id:null,operator_person_id:by('account',actor).person_id,occurred_at:stamp(c.occurred_at)||s.clock,recording_form:kind,recorder_type_term_id:null,device_make:null,device_model:c.device_model||null,device_serial:null,device_year:null,software_name:c.live?'Browser MediaRecorder':'File import',software_version:null,settings:{origin_note:origin,live:!!c.live},technical_incidents:c.technical_incidents||null},arch(r.id));
  const f=await newEntity('file_object',{sha256:await rawHash(c.content),byte_size:bytes.length,mime_type:c.mime_type,pronom_id:null,original_filename:required(c.filename),received_at:s.clock,technical_metadata:{local_browser:true}},arch(r.id));s.demo.file_contents[f.id]=structuredClone(c.content);
  t.file_ingest_occurrence.push({file_id:f.id,workflow_run_id:run.id,received_filename:f.original_filename,source_path:c.source_path?.trim()||null,received_at:s.clock,capture_event_id:capture.id});t.capture_output.push({capture_event_id:capture.id,file_id:f.id,plan_item_id:null,position:1,notes:origin});await revise(capture,'Додано первинний файл');
  const asset=await newEntity('media_asset',{title:c.title?.trim()||f.original_filename,media_kind:kind,description:origin},arch(r.id));t.media_asset_subject.push({asset_id:asset.id,subject_entity_id:r.id,relation_role:'capture',evidence_id:null});await revise(asset,'Пов’язано із сеансом');
  const rep=await newEntity('representation',{asset_id:asset.id,role:'received_original',representation_version:1,duration_ms:kind==='photo'?null:c.duration_ms??null,technical_metadata:{capture_event_id:capture.id}},arch(r.id));t.representation_file.push({representation_id:rep.id,file_id:f.id,position:1,component_label:f.original_filename,component_role:'primary',timeline_offset_ms:0});await revise(rep,'Додано первинний файл');
  await revise(r,'Додано медіазапис сеансу');return {id:rep.id,file_id:f.id};
 }
 if(c.type==='field.session.marker'){
  const rep=sessionRepresentations(s,r.id).find(x=>x.id===c.representation_id);if(!rep)fail('invalid','Оберіть запис цього сеансу.');fresh(rep.id,c.representation_revision_id);
  t.timed_layer??=[];t.timed_layer_entry??=[];let layer=t.timed_layer.find(x=>x.representation_revision_id===revision(rep.id)&&x.kind==='index');
  if(layer)fresh(layer.id,c.layer_revision_id);else if(c.layer_revision_id)fail('stale','Шар позначок змінено.');
  let entries=layer?structuredClone(markerEntries(s,layer)):[];const old=c.position?entries.find(x=>x.position===Number(c.position)):null;if(c.position&&!old)fail('stale','Позначку змінено.');
  if(c.remove)entries=entries.filter(x=>x!==old);
  else {const text=required(c.text_value),start=Number(c.start_ms),end=Number(c.end_ms);if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||rep.duration_ms!=null&&end>rep.duration_ms)fail('invalid','Кінець має бути після початку й у межах запису.');
   const seg=await newEntity('media_segment',{representation_id:rep.id,representation_revision_id:revision(rep.id),start_ms:start,end_ms:end,channel:null},arch(r.id));const entry={segment_revision_id:revision(seg.id),text_part_id:null,text_value:text,position:old?.position||entries.length+1};if(old)Object.assign(old,entry);else entries.push(entry);}
  if(layer)await revise(layer,'Уточнено первинні часові позначки');else layer=await newEntity('timed_layer',{representation_id:rep.id,representation_revision_id:revision(rep.id),kind:'index',language_tag:'uk',text_revision_id:null},arch(r.id));
  entries.sort((a,b)=>by('entity_revision',a.segment_revision_id).snapshot.start_ms-by('entity_revision',b.segment_revision_id).snapshot.start_ms).forEach((x,i)=>t.timed_layer_entry.push({...x,layer_revision_id:revision(layer.id),position:i+1}));
  const created=by('entity_revision',revision(layer.id));created.snapshot._relations={timed_layer_entry:structuredClone(markerEntries(s,layer))};created.snapshot_hash=await hash(created.snapshot);
  await revise(r,'Уточнено часові позначки сеансу');return layer;
 }
 if(c.type==='field.session.form'){
  const people=t.participation.filter(x=>x.session_id===r.id),events=t.session_event.filter(x=>x.session_id===r.id).sort((a,b)=>a.position-b.position),reps=sessionRepresentations(s,r.id),geos=t.geographic_context.filter(x=>x.subject_entity_id===r.id);
  const text=['БЛАНК СЕАНСУ',r.title,'Дата: '+(r.date_label||r.date_from||'Не встановлена'),'Група: '+(r.work_group_id?by('work_group',r.work_group_id).name:'Не зазначено'),'Середовище: '+({indoor:'У приміщенні',outdoor:'Надворі',mixed:'Змішане',unknown:'Невідомо'}[r.location_environment]),'Програма: '+(r.programme_revision_id?by('entity_revision',r.programme_revision_id).snapshot.body_text:'Не зазначено'),'Початок: '+(r.started_at||'Не зазначено'),'Завершення: '+(r.ended_at||'Не зазначено'),'Місце: '+geos.map(x=>by('place',x.place_id).name).join(', '),r.location_description||'',r.recording_context||'',r.context_notes||'','УЧАСНИКИ',...people.map(p=>participantCodes(t,r.id).get(p.id)+' · '+by('person',p.person_id).preferred_name+' — '+({performer:'Виконавець / оповідач',collector:'Збирач',observer:'Присутній'}[p.role_code]||p.role_code)+'; '+(p.function_text||'')+'; '+(p.local_label||'')),'ПЕРЕБІГ',...events.map(x=>(x.occurred_at||'Час не зазначено')+' — '+x.note),'ЗАПИСИ',...t.information_unit.filter(x=>x.session_id===r.id).sort((a,b)=>a.position-b.position).map(x=>x.position+'. '+x.title+' — '+unitPeople(t,x,id=>by('person',id)?.preferred_name||'Особа')+'\n'+(x.summary||'Текст ще не додано')),'МЕДІА І ПОЗНАЧКИ',...reps.flatMap(x=>[by('media_asset',x.asset_id).title,...(t.timed_layer||[]).filter(l=>l.representation_id===x.id).flatMap(l=>markerEntries(s,l).map(e=>{const seg=by('entity_revision',e.segment_revision_id).snapshot;return (seg.start_ms/1000)+'–'+(seg.end_ms/1000)+' с: '+e.text_value;}))]),'ЗГОДИ',...t.consent_record.filter(x=>x.session_id===r.id).map(x=>by('person',x.person_id).preferred_name+': '+({active:'задокументована',partially_withdrawn:'частково відкликана',withdrawn:'відкликана'}[x.state]||x.state)+'; '+t.consent_scope.filter(v=>v.consent_id===x.id&&v.permission==='allowed').map(v=>useNames[v.use_code]).join(', '))].join('\n');
  const notebooks=t.document.filter(d=>d.kind==='field_notebook'&&t.document_context.some(x=>x.document_id===d.id&&x.target_entity_id===r.id));
  const d=await newEntity('document',{kind:'session_form',title:'Бланк: '+r.title,body_text:text+'\nПОЛЬОВІ НОТАТКИ\n'+notebooks.map(n=>n.title+'\n'+(n.body_text||'')).join('\n'),language_tag:'uk',media_asset_id:null,physical_object_id:null},arch(r.id));t.document_context.push({document_id:d.id,target_entity_id:r.id,target_revision_id:revision(r.id),context_role:'session_form'});
  const sources=[...reps,...(t.timed_layer||[]).filter(l=>reps.some(x=>x.id===l.representation_id)),...t.consent_record.filter(x=>x.session_id===r.id),...notebooks];
  for(const source of sources)t.document_context.push({document_id:d.id,target_entity_id:source.id,target_revision_id:revision(source.id),context_role:'form_source'});
  await revise(d,'Зафіксовано бланк поточної версії сеансу');return d;
 }
 fail('invalid','Невідома дія сеансу.');
}
