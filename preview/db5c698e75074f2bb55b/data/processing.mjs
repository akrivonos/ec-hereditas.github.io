import {can,hash} from './model.mjs?v=20261002-wf17';
import {rawHash} from './media.mjs?v=20261002-wf17';
import {fileBytes,MAX_MEDIA_BYTES} from './binary.mjs?v=20261002-wf17';
import {useDecision} from './workbench.mjs?v=20261002-wf17';
const by=(s,k,id)=>s.tables[k]?.find(x=>x.id===id),reg=(s,id)=>by(s,'entity',id),rev=(s,id)=>reg(s,id)?.current_revision_id;
export const processingOperations={ocr:'Друкований текст',htr:'Рукопис',stt:'Мовлення',analyze:'Мова й метадані тексту'};
export function processingDecision(s,id){
 const d=useDecision({...s,clock:new Date().toISOString()},id,'processing','machine_process');if(!d)return null;
 const inputs=processingInputs(s,id),ids=new Set([id,...inputs.map(x=>x.id)]),rules=s.tables.access_decision_resource.filter(x=>x.decision_id===d.id&&ids.has(x.resource_entity_id));
 if(rules.some(x=>x.effect==='deny'))return null;
 const allowed=x=>rules.some(r=>r.effect==='allow'&&r.resource_entity_id===x&&r.resource_revision_id===rev(s,x));
 if(reg(s,id)?.entity_type==='document')return s.tables.access_decision_field.some(x=>x.decision_id===d.id&&x.field_path==='summary'&&x.effect==='allow')?d:null;
 return allowed(id)||inputs.length&&inputs.every(x=>allowed(x.id))?d:null;
}
export function processingSource(s,id){const e=reg(s,id),row=e&&by(s,e.entity_type,id);return row?.title||row?.original_filename||(row?.asset_id?by(s,'media_asset',row.asset_id)?.title:null)||'Текст';}
export function processingInputs(s,id){
 const e=reg(s,id),row=e&&by(s,e.entity_type,id);if(!row)return [];
 if(e.entity_type==='representation')return s.tables.representation_file.filter(x=>x.representation_id===id).sort((a,b)=>a.position-b.position).map(x=>{const f=by(s,'file_object',x.file_id);return {id:f.id,revision_id:rev(s,f.id),filename:f.original_filename,mime_type:f.mime_type,sha256:f.sha256,byte_size:f.byte_size,position:x.position,offset_ms:x.timeline_offset_ms??(x.position===1?0:null),duration_ms:row.duration_ms??null};});
 if(['document','textual_representation'].includes(e.entity_type)&&row.body_text?.trim())return [{id,revision_id:rev(s,id),filename:'source.txt',mime_type:'text/plain',sha256:null,byte_size:new TextEncoder().encode(row.body_text).length,position:1,offset_ms:null,duration_ms:null}];
 return [];
}
export function processingProblem(s,run){
 if(!run?.job)return 'Це попередній навчальний запуск.';
 const id=run.job.source_id;if(rev(s,id)!==run.job.source_revision_id)return 'Джерело змінилося. Підготуйте новий запуск.';
 if(run.job.inputs.some(x=>rev(s,x.id)!==x.revision_id))return 'Вхідний файл змінився. Підготуйте новий запуск.';
 const d=processingDecision(s,id);if(!d||d.id!==run.processing_basis?.id||rev(s,d.id)!==run.processing_basis.revision_id)return 'Дозвіл змінився або відкликаний. Підготуйте новий запуск.';
 return null;
}
export async function processingJob(s,actor,id){
 const run=by(s,'process_run',id),source=run?.job?.source_id;if(!source||!can(s,actor,'processing.run',reg(s,source)?.archive_id))throw Error('Запуск недоступний.');const problem=processingProblem(s,run);if(problem)throw Error(problem);if(run.state!=='running')throw Error('Запуск уже завершено.');
 if(!can(s,actor,'domain.read',reg(s,source)?.archive_id))throw Error('Джерело недоступне.');const files=[];for(const x of run.job.inputs){if(!can(s,actor,'domain.read',reg(s,x.id)?.archive_id))throw Error('Файл недоступний.');const content=reg(s,x.id)?.entity_type==='file_object'?s.demo.file_contents[x.id]:by(s,'entity_revision',x.revision_id).snapshot.body_text;if(await rawHash(content)!==x.sha256)throw Error('Байти джерела змінилися.');files.push({id:x.id,content});}
 return {format:'hereditas-processing-job/1',job:structuredClone(run.job),job_digest:run.job_digest,files};
}
export function validateProcessing(s,ok,fk){
 for(const r of s.tables.process_run.filter(x=>x.job)){ok(r.job.id===r.id&&r.job.format==='processing/1','Некоректне завдання обробки');fk('entity',r.job.source_id);fk('entity_revision',r.job.source_revision_id);ok(reg(s,r.job.source_id)?.id===by(s,'entity_revision',r.job.source_revision_id)?.entity_id,'Версія джерела обробки');ok(['running','succeeded','failed'].includes(r.state),'Стан обробки');if(r.state==='succeeded')ok(!!r.result_digest&&!!r.result_payload,'Немає машинного результату');}
 for(const c of s.tables.candidate.filter(x=>x.payload_schema_version==='processing/1')){fk('process_run',c.process_run_id);ok(by(s,'process_run',c.process_run_id)?.state==='succeeded','Кандидат без успішного запуску');ok(c.confidence==null||Number.isFinite(c.confidence)&&c.confidence>=0&&c.confidence<=1,'Впевненість: 0–1');}
}
export async function verifyProcessingHashes(s){for(const r of s.tables.process_run.filter(x=>x.job)){if(await hash(r.job)!==r.job_digest)throw Error('Змінено завдання обробки');if(r.result_payload&&await hash(r.result_payload)!==r.result_digest)throw Error('Змінено машинний результат');}}

export async function processingCommand(s,actor,c,h){
 const {access,fresh,add,revise,fail,task}=h,t=s.tables,required=x=>{if(typeof x!=='string'||!x.trim())fail('invalid','Заповніть обов’язкове поле.');return x.trim();},now=new Date().toISOString(),archive=id=>reg(s,id)?.archive_id;
 if(c.type==='workbench.processing.start'){
  access(c.source_id,'processing.run');access(c.source_id,'domain.read');fresh(c.source_id,c.expected_revision_id);const decision=processingDecision(s,c.source_id);if(!decision)fail('forbidden','Оформіть чинний дозвіл на машинне опрацювання цього матеріалу.');
  const inputs=processingInputs(s,c.source_id);if(!inputs.length||inputs.length>20||inputs.reduce((n,x)=>n+x.byte_size,0)>MAX_MEDIA_BYTES)fail('invalid','Оберіть джерело з файлами до 2 МБ.');
  if(!processingOperations[c.operation]||inputs.some(x=>c.operation==='stt'?!/^(audio|video)\//.test(x.mime_type):['ocr','htr'].includes(c.operation)?!/^image\/(png|jpeg|webp|tiff)$/.test(x.mime_type):x.mime_type!=='text/plain'))fail('invalid','Операція не відповідає виду джерела.');
  if(c.confirm!==true)fail('invalid','Підтвердьте склад і спосіб опрацювання.');if(c.retry_of){const old=by(s,'process_run',c.retry_of);if(!old?.job||old.job.source_id!==c.source_id)fail('invalid','Повтор має стосуватися цього джерела.');}
  for(const x of inputs){access(x.id,'domain.read');if(!x.sha256)x.sha256=await rawHash(by(s,'entity_revision',x.revision_id).snapshot.body_text);}
  const id=crypto.randomUUID(),job={format:'processing/1',id,source_id:c.source_id,source_revision_id:rev(s,c.source_id),operation:c.operation,inputs,parameters:{language_hint:c.language_hint?.trim()||null,context:c.context?.trim()||null,speakers_requested:c.speakers_requested===true},retry_of:c.retry_of||null};
  const row={id,operation:c.operation,producer_kind:'ai',provider:null,tool_name:null,tool_version:null,model_name:null,model_version:null,parameters:job.parameters,started_at:now,finished_at:null,state:'running',initiated_by:actor,job,job_digest:await hash(job),processing_basis:{id:decision.id,revision_id:rev(s,decision.id)}};t.process_run.push(row);for(const x of [{id:c.source_id,revision_id:rev(s,c.source_id)},...inputs])if(!t.process_input.some(v=>v.process_run_id===id&&v.revision_id===x.revision_id))t.process_input.push({process_run_id:id,entity_id:x.id,revision_id:x.revision_id,input_role:x.id===c.source_id?'source':'file'});return row;
 }
 if(c.type==='workbench.processing.review'){
  const candidate=by(s,'candidate',c.id);if(candidate?.payload_schema_version!=='processing/1')fail('invalid','Оберіть машинну пропозицію.');access(c.id,'text.review');fresh(c.id,c.expected_revision_id);access(candidate.target_entity_id,'domain.read');const run=by(s,'process_run',candidate.process_run_id),problem=processingProblem(s,run);if(problem)fail('stale',problem);if(!['pending','deferred'].includes(candidate.state))fail('invalid','Пропозицію вже розглянуто.');
  if(c.confirm!==true||!['accept','correct','reject','defer'].includes(c.decision))fail('invalid','Підтвердьте рішення щодо пропозиції.');required(c.reason);const payload=candidate.proposed_payload,source=candidate.target_entity_id,a=archive(source);
  const d=await add('review_decision',{target_entity_id:candidate.id,target_revision_id:rev(s,candidate.id),decision:c.decision,reviewer_account_id:actor,decided_at:now,reason:c.reason,supersedes_decision_id:t.review_decision.filter(x=>x.target_entity_id===candidate.id).at(-1)?.id||null},a);let result;
  if(['accept','correct'].includes(c.decision)){
   if(payload.type==='text'){
    const body=c.decision==='correct'?required(c.body_text):payload.text,language=(c.decision==='correct'?c.language_tag:null)||payload.language_tag||'und';if(!/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(language)||body.length>100000)fail('invalid','Перевірте мову та довжину тексту.');
    const term=t.vocabulary_term.find(x=>x.code==='diplomatic'&&t.vocabulary_scheme.some(v=>v.id===x.scheme_id&&v.d_code==='D21'));
    const subject=reg(s,source).entity_type==='textual_representation'?by(s,'textual_representation',source).subject_entity_id:source;
    result=await add('textual_representation',{subject_entity_id:subject,subject_revision_id:source===subject?candidate.base_revision_id:by(s,'textual_representation',source).subject_revision_id,kind_term_id:term.id,language_tag:language,is_dialectal:false,dialect_term_id:null,dialect_label_raw:null,derived_from_revision_id:source===subject?null:candidate.base_revision_id,process_run_id:run.id,body_text:body},a);
    for(const [i,line]of body.split('\n').entries())t.text_part.push({id:crypto.randomUUID(),text_revision_id:rev(s,result.id),position:i+1,kind:'utterance',local_key:String(i+1),text:line,speaker_participation_id:null});
   }else if(payload.type==='segmentation'){
    if(reg(s,source).entity_type!=='representation')fail('invalid','Часові межі потребують медіапредставлення.');const textCandidate=t.candidate.find(x=>x.process_run_id===run.id&&x.proposed_payload?.type==='text'&&x.proposed_payload.file_id===payload.file_id&&['accepted','corrected'].includes(x.state));if(!textCandidate)fail('blocked','Спочатку перевірте текст цього файла.');
    const segments=c.decision==='correct'?c.segments:payload.segments;checkSegments(segments,payload.duration_ms,fail);const input=run.job.inputs.find(x=>x.id===payload.file_id);if(input.offset_ms==null)fail('blocked','Спочатку задайте часовий зсув файла в представленні та створіть новий запуск.');
    t.timed_layer??=[];t.timed_layer_entry??=[];result=await add('timed_layer',{representation_id:source,representation_revision_id:candidate.base_revision_id,kind:'transcript',language_tag:payload.language_tag||'und',text_revision_id:rev(s,textCandidate.proposed_entity_id)},a);
    for(const [i,seg]of segments.entries()){const segment=await add('media_segment',{representation_id:source,representation_revision_id:candidate.base_revision_id,start_ms:seg.start_ms+input.offset_ms,end_ms:seg.end_ms+input.offset_ms,channel:null},a);t.timed_layer_entry.push({layer_revision_id:rev(s,result.id),segment_revision_id:rev(s,segment.id),text_part_id:null,text_value:seg.text,position:i+1,speaker_label:seg.speaker_label||null});}
    const snapshot=by(s,'entity_revision',rev(s,result.id));snapshot.snapshot._relations={timed_layer_entry:structuredClone(t.timed_layer_entry.filter(x=>x.layer_revision_id===snapshot.id))};snapshot.snapshot_hash=await hash(snapshot.snapshot);
   }else{
    access(source,'review.write');result=await add('assertion',{subject_entity_id:source,subject_revision_id:candidate.base_revision_id,object_revision_id:null,assertion_kind:'generic',scope:'archival',corpus_id:null,statement_text:({language:'Мова',person:'Особа',place:'Місце',date:'Дата',topic:'Тема'}[payload.metadata_kind])+': '+(c.decision==='correct'?required(c.value):payload.value),acceptance_state:'accepted',author_person_id:by(s,'account',actor).person_id,review_decision_id:d.id,processing_candidate_id:candidate.id},a);
   }
   t.review_application.push({review_decision_id:d.id,result_entity_id:result.id,result_revision_id:rev(s,result.id),applied_at:now});candidate.proposed_entity_id=result.id;
   for(const link of t.evidence_link.filter(x=>x.subject_entity_id===candidate.id))t.evidence_link.push({...link,subject_entity_id:result.id,subject_revision_id:rev(s,result.id)});
  }
  candidate.state={accept:'accepted',correct:'corrected',reject:'rejected',defer:'deferred'}[c.decision];await revise(candidate,c.reason);
  if(c.decision==='defer')await task(candidate.id,'processing_review','Перевірити машинну пропозицію');else for(const w of t.work_item.filter(x=>x.kind==='processing_review'&&!['done','cancelled'].includes(x.state)&&t.work_item_target.some(v=>v.work_item_id===x.id&&v.entity_id===candidate.id))){w.state='done';w.resolution=c.reason;await revise(w,c.reason);}
  return {id:candidate.id,result_id:result?.id||null};
 }
 const run=by(s,'process_run',c.id);if(!run?.job)fail('invalid','Оберіть поточне завдання.');access(run.job.source_id,'processing.run');
 if(c.type==='workbench.processing.cancel'){if(run.state!=='running')fail('invalid','Запуск уже завершено.');run.state='failed';run.finished_at=now;run.error=required(c.reason);run.cancelled=true;return run;}
 const problem=processingProblem(s,run);if(problem)fail('stale',problem);if(c.type!=='workbench.processing.finish')fail('invalid','Невідома дія.');const p=c.result;
 if(!p||JSON.stringify(p).length>2000000||p.format!=='hereditas-processing-result/1'||p.job_id!==run.id||p.job_digest!==run.job_digest)fail('invalid','Результат належить іншому завданню або має завеликий розмір.');
 const digest=await hash(p);if(run.result_digest===digest)return run;if(run.state!=='running')fail('stale','Запуск уже завершено; створіть повтор.');
 if(!['succeeded','failed'].includes(p.state)||!p.provenance)fail('invalid','Результат не містить стану й походження.');const provenance=p.provenance;for(const key of ['provider','tool_name','tool_version'])required(provenance[key]);if(!provenance.parameters||typeof provenance.parameters!=='object'||Array.isArray(provenance.parameters))fail('invalid','Збережіть параметри обробки.');if(!Number.isFinite(Date.parse(p.started_at))||!Number.isFinite(Date.parse(p.finished_at))||Date.parse(p.finished_at)<Date.parse(p.started_at))fail('invalid','Некоректний час обробки.');
 if(p.state==='succeeded'){
  if(!Array.isArray(p.outputs)||p.outputs.length!==run.job.inputs.length||new Set(p.outputs.map(x=>x.file_id)).size!==p.outputs.length)fail('invalid','Потрібен результат кожного вхідного файла.');
  for(const o of p.outputs){if(!run.job.inputs.some(x=>x.id===o.file_id))fail('invalid','Невідомий вхідний файл.');if(typeof o.text!=='string'||o.text.length>100000||!Array.isArray(o.segments)||!Array.isArray(o.metadata)||o.metadata.length>100)fail('invalid','Некоректний текст або пропозиції.');if(o.confidence!=null&&(!Number.isFinite(o.confidence)||o.confidence<0||o.confidence>1))fail('invalid','Впевненість: 0–1');if(o.language_tag&&!/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(o.language_tag))fail('invalid','Некоректна мова результату.');if(o.segments.length)checkSegments(o.segments,o.duration_ms,fail);
   for(const m of o.metadata)if(!m||!['person','place','date','topic'].includes(m.kind)||typeof m.value!=='string'||!m.value.trim()||typeof m.evidence!=='string'||!m.evidence.trim()||!o.text.includes(m.evidence)||m.confidence!=null&&(!Number.isFinite(m.confidence)||m.confidence<0||m.confidence>1))fail('invalid','Пропозиція метаданих потребує дослівного доказу й коректної впевненості.');
  }
 }else required(p.error);
 Object.assign(run,{state:p.state,finished_at:now,provider:provenance.provider,tool_name:provenance.tool_name,tool_version:provenance.tool_version,model_name:provenance.model_name||null,model_version:provenance.model_version||null,parameters:provenance.parameters,result_payload:structuredClone(p),result_digest:digest,error:p.error||null});
 if(p.state==='failed'){await task(run.job.source_id,'technical_issue','Помилка обробки: '+p.error);return run;}
 const propose=async(kind,payload,confidence=null)=>{const candidate=await add('candidate',{kind,target_entity_id:run.job.source_id,base_revision_id:run.job.source_revision_id,proposed_payload:payload,payload_schema_version:'processing/1',proposed_entity_id:null,process_run_id:run.id,proposed_by:null,confidence,state:'pending'},archive(run.job.source_id));for(const x of t.process_input.filter(x=>x.process_run_id===run.id))t.candidate_source.push({candidate_id:candidate.id,source_entity_id:x.entity_id,source_revision_id:x.revision_id,source_role:x.input_role});const evidence=await add('evidence',{source_entity_id:payload.file_id,source_revision_id:rev(s,payload.file_id),external_uri:null,locator:'Обробка '+run.id,quote_text:payload.evidence||payload.text?.slice(0,500)||null,note:'Неперевірений машинний результат; '+provenance.tool_name+' '+provenance.tool_version,captured_at:now},archive(run.job.source_id));t.evidence_link.push({subject_entity_id:candidate.id,subject_revision_id:rev(s,candidate.id),evidence_id:evidence.id,evidence_role:'machine_output'});await task(candidate.id,'processing_review','Перевірити машинну пропозицію');};
 for(const o of p.outputs){if(o.text.trim())await propose('text',{type:'text',file_id:o.file_id,text:o.text,language_tag:o.language_tag||'und'},o.confidence??null);if(o.segments.length)await propose('segmentation',{type:'segmentation',file_id:o.file_id,segments:o.segments,duration_ms:o.duration_ms,language_tag:o.language_tag||'und'});if(o.language_tag)await propose('description',{type:'metadata',file_id:o.file_id,metadata_kind:'language',value:o.language_tag,evidence:o.text.slice(0,500)});for(const m of o.metadata)await propose('description',{type:'metadata',file_id:o.file_id,metadata_kind:m.kind,value:m.value,evidence:m.evidence},m.confidence??null);}
 return run;
}
function checkSegments(segments,duration,fail){if(!Array.isArray(segments)||!segments.length||segments.length>1000||!Number.isInteger(duration)||duration<=0)fail('invalid','Часові межі потребують фактичної тривалості.');let last=-1;for(const x of segments){if(!Number.isInteger(x.start_ms)||!Number.isInteger(x.end_ms)||x.start_ms<0||x.end_ms<=x.start_ms||x.end_ms>duration||x.start_ms<last||!x.text?.trim()||x.speaker_label!=null&&(typeof x.speaker_label!=='string'||x.speaker_label.length>80))fail('invalid','Некоректні межі, порядок або текст фрагмента.');last=x.start_ms;}}
