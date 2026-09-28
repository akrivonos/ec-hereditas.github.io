import {fileBytes} from './binary.mjs?v=20260928-cultural-media';
// Internal, scoped prototype operations. Storage and capture actions explicitly simulate hardware.
export const mediaTypes=['source_system','source_record','physical_object','storage_location','condition_assessment','custody_event','media_asset','representation','file_object','storage_copy','capture_event','qc_record','candidate','review_decision','evidence'];
export const mediaRelations=(t,type,id)=>Object.fromEntries(({
 representation:[['representation_file','representation_id']],capture_event:[['capture_output','capture_event_id']],
 media_asset:[['media_asset_subject','asset_id']],qc_record:[['qc_check_item','qc_record_id']],
 work_item:(t.digitization_job||[]).some(x=>x.work_item_id===id)?[['digitization_job','work_item_id']]:[]
}[type]||[]).map(([table,key])=>[table,structuredClone((t[table]||[]).filter(x=>x[key]===id))]));
export const rawHash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',fileBytes(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export const currentCustody=(s,id)=>s.tables.custody_event.filter(x=>x.physical_object_id===id).at(-1)||null;
export const latestCondition=(s,id)=>s.tables.condition_assessment.filter(x=>x.physical_object_id===id).at(-1)||null;
export const manifestPayload=items=>items.slice().sort((a,b)=>a.position-b.position).map(({entity_id,revision_id,position,item_checksum})=>({entity_id,revision_id,position,item_checksum}));
export const handoverState=(s,h)=>({handover:h,items:s.tables.handover_item.filter(x=>x.handover_id===h.id)});
export function independentCopies(s,file){return new Set(s.tables.storage_copy.filter(x=>x.file_id===file&&x.state==='verified').map(x=>s.tables.digital_storage_location.find(l=>l.id===x.storage_location_id).failure_domain)).size;}
export function capturePlan(s,capture){return capture?.settings?.capture_plan_revision_id?s.tables.capture_plan_item.filter(x=>x.plan_revision_id===capture.settings.capture_plan_revision_id).sort((a,b)=>a.position-b.position):[];}
export function qcFacts(s,rep){
 const t=s.tables,capture=t.capture_event.find(x=>x.id===rep.technical_metadata?.capture_event_id),plan=capturePlan(s,capture),files=t.representation_file.filter(x=>x.representation_id===rep.id).sort((a,b)=>a.position-b.position);
 const expected=plan.length?plan.reduce((sum,p)=>sum+(p.expected_count??1),0):null;
 return {capture,plan,files,expected,complete:expected!==null&&files.length===expected,order:plan.length>0&&plan.every(p=>files.some(f=>f.position===p.position&&f.component_label===p.part_label)),checksums:files.length>0&&files.every(f=>t.storage_copy.some(c=>c.file_id===f.file_id&&c.state==='verified'))};
}
export function validateMedia(s,require,fk,canonical){
 const t=s.tables;if(!t.physical_object)return;
 const by=(table,id)=>t[table]?.find(x=>x.id===id),reg=id=>by('entity',id),same=(a,b)=>require(reg(a)?.archive_id===reg(b)?.archive_id,'Зв’язок поза архівом');
 const revision=(id,type)=>{const r=by('entity_revision',id);require(!!r&&reg(r.entity_id)?.entity_type===type,'Неправильний тип версії');return r;};
 const unique=(rows,key,message)=>require(new Set(rows.map(key)).size===rows.length,message);
 const positive=n=>require(Number.isInteger(n)&&n>0,'Некоректний порядок');
 for(const x of t.physical_object){fk('archive',x.archive_id);require(x.archive_id===reg(x.id).archive_id,'Архів носія');const term=by('vocabulary_term',x.carrier_type_term_id);require(by('vocabulary_scheme',term?.scheme_id)?.d_code==='D12','Оберіть тип фізичного носія');}
 for(const x of t.storage_location){require(!!x.institution_id||!!x.custodian_person_id,'Потрібен відповідальний за місце');if(x.institution_id)fk('institution',x.institution_id);if(x.custodian_person_id)fk('person',x.custodian_person_id);if(x.parent_id){const p=by('storage_location',x.parent_id);require(p&&p.institution_id===x.institution_id&&p.custodian_person_id===x.custodian_person_id,'Інший власник батьківського місця');same(x.id,p.id);}}
 for(const table of ['storage_location','source_record'])for(const x of t[table]){const seen=new Set([x.id]);let parent=x.parent_id||x.parent_record_id;while(parent){require(!seen.has(parent),'Цикл дерева');seen.add(parent);const p=by(table,parent);require(!!p,'Відсутній батьківський запис');if(table==='source_record')require(p.source_system_id===x.source_system_id,'Батьківський запис іншого джерела');parent=p.parent_id||p.parent_record_id;}}
 for(const x of t.condition_assessment){fk('physical_object',x.physical_object_id);fk('person',x.assessor_person_id);same(x.id,x.physical_object_id);require(['stable','fragile','unsafe','unknown'].includes(x.condition_code),'Стан носія');}
 for(const x of t.custody_event){fk('physical_object',x.physical_object_id);require(!!x.to_location_id||!!x.to_person_id||!!x.to_institution_id,'Потрібна сторона приймання');for(const key of ['from_location_id','to_location_id'])if(x[key]){fk('storage_location',x[key]);same(x.id,x[key]);}}
 for(const x of t.source_record){fk('source_system',x.source_system_id);same(x.id,x.source_system_id);fk('workflow_run',x.import_run_id);require(!!x.raw_text||!!x.raw_payload,'Порожній джерельний запис');require(/^[a-f0-9]{64}$/.test(x.source_hash),'Контрольна сума джерела');require(t.entity_revision.filter(r=>r.entity_id===x.id).length===1,'Джерельний запис незмінний');}
 for(const x of t.source_record_link){fk('source_record',x.source_record_id);fk('entity',x.entity_id);same(x.source_record_id,x.entity_id);if(x.review_decision_id)fk('review_decision',x.review_decision_id);}
 for(const x of t.media_asset_subject){fk('media_asset',x.asset_id);fk('entity',x.subject_entity_id);same(x.asset_id,x.subject_entity_id);}
 for(const x of t.representation){fk('media_asset',x.asset_id);same(x.id,x.asset_id);positive(x.representation_version);require(['received_original','preservation_master','access_derivative','thumbnail','mezzanine','other'].includes(x.role),'Роль представлення');}
 unique(t.representation,x=>[x.asset_id,x.role,x.representation_version].join(':'),'Повторена версія представлення');
 for(const x of t.representation_file){fk('representation',x.representation_id);fk('file_object',x.file_id);same(x.representation_id,x.file_id);positive(x.position);}
 unique(t.representation_file,x=>x.representation_id+':'+x.position,'Повторений порядок файлів');
 for(const x of t.representation_derivation){fk('representation',x.output_representation_id);const r=revision(x.input_representation_revision_id,'representation');same(x.output_representation_id,r.entity_id);require(x.output_representation_id!==r.entity_id,'Представлення не походить із себе');}
 const visit=(id,path=new Set())=>{require(!path.has(id),'Цикл похідних представлень');for(const d of t.representation_derivation.filter(x=>x.output_representation_id===id))visit(by('entity_revision',d.input_representation_revision_id).entity_id,new Set([...path,id]));};t.representation.forEach(x=>visit(x.id));
 for(const x of t.file_object){require(/^[a-f0-9]{64}$/.test(x.sha256)&&Number.isInteger(x.byte_size)&&x.byte_size>=0,'Контрольна сума або розмір файла');require(t.entity_revision.filter(r=>r.entity_id===x.id).length===1,'Файл незмінний');}
 for(const x of t.file_ingest_occurrence){fk('file_object',x.file_id);fk('workflow_run',x.workflow_run_id);if(x.capture_event_id)fk('capture_event',x.capture_event_id);}
 for(const x of t.storage_copy){fk('file_object',x.file_id);fk('digital_storage_location',x.storage_location_id);same(x.id,x.file_id);require(['pending','verified','missing','corrupt','retired'].includes(x.state),'Стан копії');if(x.state==='verified'){const check=t.fixity_check.filter(c=>c.copy_id===x.id).at(-1);require(check?.result==='match'&&check.observed_hash===by('file_object',x.file_id).sha256,'Перевірена копія без збігу контрольної суми');}}
 unique(t.storage_copy,x=>x.storage_location_id+':'+x.storage_key,'Повторений шлях копії');
 for(const table of ['fixity_check','storage_recovery_check'])for(const x of t[table])fk('storage_copy',x.copy_id);
 for(const x of t.digitization_job){fk('work_item',x.work_item_id);fk('physical_object',x.physical_object_id);same(x.work_item_id,x.physical_object_id);const p=revision(x.capture_plan_revision_id,'document');require(p.snapshot.kind==='capture_plan','Потрібен план оцифрування');if(x.condition_assessment_id)require(by('condition_assessment',x.condition_assessment_id)?.physical_object_id===x.physical_object_id,'Оцінка іншого носія');}
 for(const x of t.capture_plan_item){const r=revision(x.plan_revision_id,'document');require(r.snapshot.kind==='capture_plan','Потрібен план');positive(x.position);require(x.expected_count===null||Number.isInteger(x.expected_count)&&x.expected_count>0,'Кількість частин');}
 unique(t.capture_plan_item,x=>x.plan_revision_id+':'+x.position,'Повторений пункт плану');
 for(const x of t.capture_event){require(!!x.session_id!==!!x.digitization_job_id,'Фіксація потребує одного контексту');fk('person',x.operator_person_id);if(x.session_id){fk('collecting_session',x.session_id);same(x.id,x.session_id);}else{const j=t.digitization_job.find(j=>j.work_item_id===x.digitization_job_id);require(!!j,'Завдання оцифрування');same(x.id,j.work_item_id);const plan=revision(x.settings?.capture_plan_revision_id,'document');require(plan.snapshot.kind==='capture_plan','План події');}}
 for(const x of t.capture_output){fk('capture_event',x.capture_event_id);fk('file_object',x.file_id);same(x.capture_event_id,x.file_id);positive(x.position);}
 unique(t.capture_output,x=>x.capture_event_id+':'+x.position,'Повторений вихід фіксації');
 for(const x of t.manifest_entry){const d=revision(x.manifest_revision_id,'document');require(d.snapshot.kind==='digitization_manifest','Потрібен маніфест');const capture=by('capture_event',x.capture_event_id),job=t.digitization_job.find(j=>j.work_item_id===x.digitization_job_id);require(capture?.digitization_job_id===x.digitization_job_id&&job?.physical_object_id===x.physical_object_id,'Контекст маніфесту');require(by('file_object',x.file_id)?.sha256===x.checksum,'Контрольна сума маніфесту');}
 for(const x of t.qc_record){revision(x.representation_revision_id,'representation');fk('person',x.reviewer_person_id);require(['pass','pass_with_note','recapture_required','incomplete'].includes(x.outcome),'Висновок перевірки');}
 for(const x of t.qc_check_item){fk('qc_record',x.qc_record_id);require(['pass','fail','not_applicable','unknown'].includes(x.result),'Результат перевірки');}
 for(const x of t.handover){fk('workflow_run',x.from_workflow_run_id);if(x.to_workflow_run_id)fk('workflow_run',x.to_workflow_run_id);require(['prepared','sent','accepted','returned'].includes(x.state),'Стан передання');if(x.state==='accepted'){fk('account',x.accepted_by);require(!!x.accepted_at&&t.handover_item.filter(i=>i.handover_id===x.id).every(i=>i.item_state==='present'),'Приймання невирішеного пакета');}}
 for(const x of t.handover_item){fk('handover',x.handover_id);const r=by('entity_revision',x.revision_id);require(r?.entity_id===x.entity_id,'Чужа версія елемента');positive(x.position);require(['present','missing','unresolved'].includes(x.item_state),'Стан елемента');const h=by('handover',x.handover_id),run=by('workflow_run',h.from_workflow_run_id),primary=reg(run.primary_entity_id);require(reg(x.entity_id).archive_id===(primary.archive_id||primary.id),'Елемент з іншого архіву');}
 unique(t.handover_item,x=>x.handover_id+':'+x.position,'Порядок пакета');
 for(const x of t.candidate){fk('entity',x.target_entity_id);require(by('entity_revision',x.base_revision_id)?.entity_id===x.target_entity_id,'Основа кандидата');if(x.proposed_entity_id){fk('entity',x.proposed_entity_id);same(x.id,x.proposed_entity_id);}}
 for(const x of t.review_decision){require(by('entity_revision',x.target_revision_id)?.entity_id===x.target_entity_id,'Ціль рішення');fk('account',x.reviewer_account_id);}
 for(const x of t.evidence){if(x.source_entity_id)require(by('entity_revision',x.source_revision_id)?.entity_id===x.source_entity_id,'Джерело доказу');else require(!!x.note||!!x.external_uri,'Потрібне джерело доказу');}
 for(const x of t.evidence_link){fk('entity',x.subject_entity_id);fk('evidence',x.evidence_id);}
 for(const e of t.entity){const rel=by('entity_revision',e.current_revision_id).snapshot._relations;if(rel&&Object.keys(mediaRelations(t,e.entity_type,e.id)).length)require(canonical(rel)===canonical(mediaRelations(t,e.entity_type,e.id)),'Склад цифрової версії не збігається');}
}

export async function mediaCommand(s,actor,c,ctx){
 const {need,can,fail,revise,audit,hash,snapshot}=ctx,t=s.tables,by=(table,id)=>t[table]?.find(x=>x.id===id),reg=id=>by('entity',id),rev=id=>reg(id)?.current_revision_id,archive=id=>reg(id)?.archive_id;
 const text=v=>{if(typeof v!=='string'||!v.trim())fail('invalid','Заповніть обов’язкове поле.');return v.trim();};
 const get=(table,id,permission='media.write')=>{const row=by(table,id);if(!row)fail('forbidden','Запис недоступний.');need(permission,archive(id));return row;};
 const fresh=(id,expected)=>{if(rev(id)!==expected)fail('stale','Запис змінено. Оновіть сторінку перед збереженням.');};
 const newEntity=async(type,row,a)=>{const id=crypto.randomUUID(),rid=crypto.randomUUID();row={id,...row};t[type].push(row);t.entity.push({id,entity_type:type,owner_installation_id:s.demo.ids.installation,archive_id:a,owner_account_id:null,current_revision_id:rid,retired_at:null});const snap=snapshot(t,type,row);t.entity_revision.push({id:rid,entity_id:id,revision_no:1,previous_revision_id:null,snapshot:snap,snapshot_hash:await hash(snap),recorded_at:s.clock,actor_account_id:actor,process_run_id:null,change_reason:'Створено запис'});audit('media.create',id,null,rid,'Створено запис');return row;};
 const run=(code,id)=>{const row={id:crypto.randomUUID(),workflow_code:code,primary_entity_id:id,started_by:actor,started_at:s.clock,finished_at:null,state:'in_progress',notes:null};t.workflow_run.push(row);return row;};
 const person=()=>t.account.find(a=>a.id===actor).person_id;
 const task=async(title,target,workflow=null)=>{const row=await newEntity('work_item',{workflow_run_id:workflow,kind:'technical_issue',title,state:'open',assigned_account_id:actor,assigned_role_id:null,due_at:null,resolution:null},archive(target));t.work_item_target.push({work_item_id:row.id,entity_id:target,revision_id:rev(target)});t.work_item_event.push({work_item_id:row.id,from_state:null,to_state:'open',actor_account_id:actor,occurred_at:s.clock,reason:title});return row;};
 const file=async(name,content,a,workflow,capture=null)=>{text(name);if(!content||content.length>100000)fail('invalid','Додайте вміст прикладу до 100 000 символів.');const row=await newEntity('file_object',{sha256:await rawHash(content),byte_size:new TextEncoder().encode(content).length,mime_type:'text/plain',pronom_id:null,original_filename:name,received_at:s.clock,technical_metadata:{demo:true}},a);s.demo.file_contents[row.id]=content;t.file_ingest_occurrence.push({file_id:row.id,workflow_run_id:workflow,received_filename:name,source_path:null,received_at:s.clock,capture_event_id:capture});return row;};
 const copy=async(f,location)=>{if(!by('digital_storage_location',location))fail('invalid','Оберіть цифрове сховище.');const row=await newEntity('storage_copy',{file_id:f.id,storage_location_id:location,storage_key:f.id+'/'+f.original_filename,state:'pending',created_at:s.clock},archive(f.id));t.fixity_check.push({copy_id:row.id,checked_at:s.clock,algorithm:'SHA-256',observed_hash:await rawHash(s.demo.file_contents[f.id]),result:'match',process_run_id:null});row.state='verified';await revise(row,'Контрольна сума збігається');return row;};
 const manifest=async(capture,outputs)=>{if(!capture.digitization_job_id)return;const j=t.digitization_job.find(x=>x.work_item_id===capture.digitization_job_id);const doc=await newEntity('document',{kind:'digitization_manifest',title:'Опис отриманих файлів',body_text:outputs.map(o=>o.notes).join('\n'),language_tag:'uk',media_asset_id:null,physical_object_id:j.physical_object_id},archive(capture.id));for(const o of outputs)t.manifest_entry.push({manifest_revision_id:rev(doc.id),physical_object_id:j.physical_object_id,digitization_job_id:j.work_item_id,capture_event_id:capture.id,file_id:o.file_id,position:o.position,checksum:by('file_object',o.file_id).sha256,part_label:o.notes});};
 if(c.type==='media.physical.create'){
  need('physical.write',c.archive_id);const term=by('vocabulary_term',c.carrier_type_term_id);if(term?.status!=='active')fail('invalid','Оберіть чинний тип носія.');return newEntity('physical_object',{archive_id:c.archive_id,carrier_type_term_id:term.id,title:text(c.title),reference_code:c.reference_code||null,inscriptions:c.inscriptions||null,composition:c.composition||null,provenance_note:null,carrier_stage:'original'},c.archive_id);
 }
 if(c.type==='media.physical.save'){
  const row=get('physical_object',c.id,'physical.write');fresh(row.id,c.expected_revision_id);for(const key of ['title','reference_code','inscriptions','composition','provenance_note'])if(key in c.values)row[key]=c.values[key]||null;text(row.title);await revise(row,'Оновлено опис фізичного носія');return row;
 }
 if(c.type==='media.condition'){
  const row=get('physical_object',c.id,'physical.write');fresh(row.id,c.expected_revision_id);
  const result=await newEntity('condition_assessment',{physical_object_id:row.id,assessed_at:s.clock,assessor_person_id:person(),condition_code:c.condition_code,risk_notes:c.risk_notes||null,handling_instructions:c.handling_instructions||null},archive(row.id));
  const evidence=await newEntity('evidence',{source_entity_id:row.id,source_revision_id:rev(row.id),external_uri:null,locator:'Огляд фізичного носія',quote_text:null,note:text(c.evidence_note),captured_at:s.clock},archive(row.id));t.evidence_link.push({subject_entity_id:result.id,subject_revision_id:rev(result.id),evidence_id:evidence.id,evidence_role:'condition'});return result;
 }
 if(c.type==='media.move'){
  const row=get('physical_object',c.id,'physical.write'),last=currentCustody(s,row.id);if((last?.id||null)!==(c.expected_custody_id||null))fail('stale','Місце зберігання вже змінилося.');const location=get('storage_location',c.to_location_id,'physical.write');
  return newEntity('custody_event',{physical_object_id:row.id,from_location_id:last?.to_location_id||null,to_location_id:location.id,from_person_id:last?.to_person_id||null,to_person_id:location.custodian_person_id,from_institution_id:last?.to_institution_id||null,to_institution_id:location.institution_id,occurred_at:s.clock,reason:text(c.reason),evidence_id:null},archive(row.id));
 }
 if(c.type==='media.location'){
  need('physical.write',c.archive_id);const parent=c.parent_id?get('storage_location',c.parent_id,'physical.write'):null;
  const values={institution_id:parent?.institution_id||c.institution_id||null,custodian_person_id:parent?.custodian_person_id||null,parent_id:parent?.id||null,kind:c.kind||'shelf',code:text(c.code),label:text(c.label)};
  if(c.id){const row=get('storage_location',c.id,'physical.write');fresh(row.id,c.expected_revision_id);Object.assign(row,values);await revise(row,'Оновлено місце зберігання');return row;}
  return newEntity('storage_location',values,c.archive_id);
 }
 if(c.type==='media.job.create'){
  const obj=get('physical_object',c.physical_object_id,'physical.write');
  if(c.readiness==='ready'&&latestCondition(s,obj.id)?.condition_code!=='stable')fail('blocked','Потрібна чинна оцінка придатності носія.');
  const plan=await newEntity('document',{kind:'capture_plan',title:'План: '+obj.title,body_text:text(c.parts),language_tag:'uk',media_asset_id:null,physical_object_id:obj.id},archive(obj.id));
  c.parts.split('\n').map(x=>x.trim()).filter(Boolean).forEach((part,i)=>t.capture_plan_item.push({plan_revision_id:rev(plan.id),position:i+1,part_label:part,expected_kind:'image',expected_count:1}));
  const w=run('WF-11',obj.id),job=await task('Оцифрувати: '+obj.title,obj.id,w.id);job.kind='digitization';t.digitization_job.push({work_item_id:job.id,physical_object_id:obj.id,source_part:null,condition_assessment_id:latestCondition(s,obj.id)?.id||null,capture_plan_revision_id:rev(plan.id),specification:{profile:c.profile||'Сканування сторінок',readiness:c.readiness==='ready'?'ready':'postponed',stop_conditions:c.stop_conditions||''}});await revise(job,'Створено план оцифрування');return job;
 }
 if(c.type==='media.plan'){
  const row=get('work_item',c.id,'physical.write'),job=t.digitization_job.find(x=>x.work_item_id===row.id);if(!job)fail('invalid','Потрібне завдання оцифрування.');fresh(row.id,c.expected_revision_id);
  const condition=latestCondition(s,job.physical_object_id);if(c.readiness==='ready'&&condition?.condition_code!=='stable')fail('blocked','Потрібна чинна оцінка придатності носія.');
  const old=by('entity_revision',job.capture_plan_revision_id),doc=by('document',old.entity_id);fresh(doc.id,c.plan_revision_id);doc.body_text=text(c.parts);await revise(doc,'Оновлено план оцифрування');job.capture_plan_revision_id=rev(doc.id);
  c.parts.split('\n').map(x=>x.trim()).filter(Boolean).forEach((part,i)=>t.capture_plan_item.push({plan_revision_id:rev(doc.id),position:i+1,part_label:part,expected_kind:'image',expected_count:1}));
  job.specification={...job.specification,profile:text(c.profile),stop_conditions:c.stop_conditions||'',readiness:c.readiness==='ready'?'ready':'postponed'};job.condition_assessment_id=condition?.id||null;await revise(row,'Оновлено готовність і план');return row;
 }
 if(c.type==='media.capture'){
  if(!!c.job_id===!!c.session_id)fail('invalid','Оберіть один контекст фіксації: сеанс або завдання.');
  let job,session,a,parts=[];
  if(c.job_id){get('work_item',c.job_id);job=t.digitization_job.find(x=>x.work_item_id===c.job_id);if(!job)fail('invalid','Оберіть завдання.');fresh(c.job_id,c.expected_revision_id);if(job.specification.readiness!=='ready'||latestCondition(s,job.physical_object_id)?.condition_code!=='stable')fail('blocked','Носій і план мають бути готові до фіксації.');a=archive(c.job_id);parts=t.capture_plan_item.filter(x=>x.plan_revision_id===job.capture_plan_revision_id).map(x=>x.part_label);}
  else{session=get('collecting_session',c.session_id,'capture.field');fresh(session.id,c.expected_revision_id);a=archive(session.id);parts=['Польовий запис'];}
  const count=Number(c.count);if(!Number.isInteger(count)||count<1||count>parts.length)fail('invalid','Оберіть кількість частин у межах плану.');
  const cap=await newEntity('capture_event',{session_id:session?.id||null,digitization_job_id:job?.work_item_id||null,operator_person_id:person(),occurred_at:s.clock,recording_form:session?'verbal':'graphic',recorder_type_term_id:null,device_make:null,device_model:c.device_model||null,device_serial:null,device_year:null,software_name:'Приклад фіксації',software_version:null,settings:{capture_plan_revision_id:job?.capture_plan_revision_id||null,profile:job?.specification.profile||null},technical_incidents:c.notes||null},a);
  const asset=c.asset_id?get('media_asset',c.asset_id,session?'capture.field':'media.write'):await newEntity('media_asset',{title:session?'Запис: '+session.title:'Цифрові сторінки: '+by('physical_object',job.physical_object_id).title,media_kind:'document',description:null},a);
  if(c.asset_id&&!t.media_asset_subject.some(x=>x.asset_id===asset.id&&x.subject_entity_id===(session?.id||job.physical_object_id)))fail('invalid','Ресурс належить іншому матеріалу.');
  if(!t.media_asset_subject.some(x=>x.asset_id===asset.id)){t.media_asset_subject.push({asset_id:asset.id,subject_entity_id:session?.id||job.physical_object_id,relation_role:'capture',evidence_id:null});await revise(asset,'Пов’язано з джерелом');}
  const version=Math.max(0,...t.representation.filter(r=>r.asset_id===asset.id&&r.role==='preservation_master').map(r=>r.representation_version))+1;
  const rep=await newEntity('representation',{asset_id:asset.id,role:'preservation_master',representation_version:version,duration_ms:null,technical_metadata:{capture_event_id:cap.id}},a);
  const w=job?by('workflow_run',by('work_item',job.work_item_id).workflow_run_id):run('WF-03',session.id);
  for(let i=0;i<count;i++){const f=await file('part-'+(i+1)+'.txt',`${parts[i]}\nНавчальний результат фіксації ${cap.id}.\n${c.content||''}`,a,w.id,cap.id);t.capture_output.push({capture_event_id:cap.id,file_id:f.id,plan_item_id:null,position:i+1,notes:parts[i]});t.representation_file.push({representation_id:rep.id,file_id:f.id,position:i+1,component_label:parts[i],component_role:'page',timeline_offset_ms:null});await copy(f,t.digital_storage_location[0].id);}
  await revise(cap,'Додано результати фіксації');await revise(rep,'Зафіксовано порядок файлів');await manifest(cap,t.capture_output.filter(x=>x.capture_event_id===cap.id));return {id:cap.id,asset_id:asset.id,representation_id:rep.id};
 }
 if(c.type==='media.ingest'||c.type==='media.derivative'){
  let asset,a,input;
  if(c.type==='media.derivative'){input=get('representation',c.representation_id);fresh(input.id,c.expected_revision_id);asset=by('media_asset',input.asset_id);a=archive(asset.id);}
  else{need('media.write',c.archive_id);a=c.archive_id;asset=await newEntity('media_asset',{title:text(c.title),media_kind:'document',description:c.description||null},a);if(c.subject_id){get(reg(c.subject_id)?.entity_type,c.subject_id,'domain.read');t.media_asset_subject.push({asset_id:asset.id,subject_entity_id:c.subject_id,relation_role:'documents',evidence_id:null});await revise(asset,'Пов’язано з матеріалом');}}
  const role=input?'access_derivative':'received_original',version=Math.max(0,...t.representation.filter(x=>x.asset_id===asset.id&&x.role===role).map(x=>x.representation_version))+1;
  const rep=await newEntity('representation',{asset_id:asset.id,role,representation_version:version,duration_ms:null,technical_metadata:null},a),w=run('WF-13',asset.id),f=await file(text(c.filename),text(c.content),a,w.id);
  t.representation_file.push({representation_id:rep.id,file_id:f.id,position:1,component_label:f.original_filename,component_role:'content',timeline_offset_ms:null});if(input)t.representation_derivation.push({output_representation_id:rep.id,input_representation_revision_id:rev(input.id),process_run_id:null,operation:'Приклад створення копії для перегляду'});
  await copy(f,t.digital_storage_location[0].id);await revise(rep,'Додано файл');return {id:asset.id,representation_id:rep.id};
 }
 if(c.type==='media.asset.link'){
  const asset=get('media_asset',c.id);fresh(asset.id,c.expected_revision_id);const e=reg(c.subject_id);if(!e||!['physical_object','collecting_session','information_unit','document'].includes(e.entity_type))fail('invalid','Оберіть матеріал.');get(e.entity_type,e.id,'domain.read');if(!t.media_asset_subject.some(x=>x.asset_id===asset.id&&x.subject_entity_id===e.id))t.media_asset_subject.push({asset_id:asset.id,subject_entity_id:e.id,relation_role:'documents',evidence_id:null});await revise(asset,'Уточнено зв’язок із матеріалом');return asset;
 }
 if(c.type==='media.copy'){
  const f=get('file_object',c.file_id);return copy(f,c.location_id);
 }
 if(c.type==='media.fixity'||c.type==='media.restore'){
  const row=get('storage_copy',c.id);fresh(row.id,c.expected_revision_id);const f=by('file_object',row.file_id),content=s.demo.file_contents[f.id];
  if(c.type==='media.restore'){
   const source=t.storage_copy.find(x=>x.file_id===f.id&&x.id!==row.id&&x.state==='verified'),ok=!!source&&await rawHash(content)===f.sha256;
   t.storage_recovery_check.push({copy_id:row.id,checked_at:s.clock,method:'Демонстраційне відновлення з перевіреної копії',result:ok?'pass':'fail',restored_hash:ok?f.sha256:null,notes:ok?'Відновлення перевірено':'Немає справної вихідної копії',process_run_id:null});
   if(ok){row.state='verified';t.fixity_check.push({copy_id:row.id,checked_at:s.clock,algorithm:'SHA-256',observed_hash:f.sha256,result:'match',process_run_id:null});await revise(row,'Відновлено копію');}
   else await task('Відновити недоступний файл',f.id);audit('storage.restore',row.id,null,null,ok?'Відновлення пройшло':'Відновлення не вдалося');return {ok};
  }
  const outcome=c.scenario||'actual';if(!['actual','mismatch','missing'].includes(outcome))fail('invalid','Невідомий сценарій перевірки.');
  const observed=outcome==='missing'||row.state==='missing'&&outcome==='actual'?null:await rawHash(content+(outcome==='mismatch'||row.state==='corrupt'?'пошкодження':''));
  const result=observed===null?'missing':observed===f.sha256?'match':'mismatch';row.state=result==='match'?'verified':result==='missing'?'missing':'corrupt';t.fixity_check.push({copy_id:row.id,checked_at:s.clock,algorithm:'SHA-256',observed_hash:observed,result,process_run_id:null});await revise(row,'Перевірено цілісність копії');if(result!=='match')await task('Перевірити пошкоджену або відсутню копію',f.id);return {result};
 }
 if(c.type==='media.qc'){
  const rep=get('representation',c.id);fresh(rep.id,c.expected_revision_id);const facts=qcFacts(s,rep);
  const checks=[['completeness',facts.complete?'pass':'fail'],['order',facts.order?'pass':'unknown'],['checksum',facts.checksums?'pass':'fail'],['readability',c.readability],['parameters',c.parameters]];
  if(['pass','pass_with_note'].includes(c.outcome)&&checks.some(([,v])=>v!=='pass'))fail('blocked','Потрібні всі частини, правильний порядок, контрольні суми та підтверджені читабельність і параметри.');
  if(c.outcome!=='pass')text(c.notes);
  const qc=await newEntity('qc_record',{representation_revision_id:rev(rep.id),digitization_job_id:facts.capture?.digitization_job_id||null,reviewer_person_id:person(),checked_at:s.clock,outcome:c.outcome,notes:c.notes||null},archive(rep.id));
  for(const [code,result]of checks)t.qc_check_item.push({qc_record_id:qc.id,check_code:code,result,measured_value:code==='completeness'?{expected:facts.expected,actual:facts.files.length}:null,note:null,evidence_id:null});await revise(qc,'Зафіксовано перевірки');
  const evidence=await newEntity('evidence',{source_entity_id:rep.id,source_revision_id:rev(rep.id),external_uri:null,locator:'Представлення та послідовність файлів',quote_text:null,note:c.notes||'Перевірки виконано',captured_at:s.clock},archive(rep.id));t.evidence_link.push({subject_entity_id:qc.id,subject_revision_id:rev(qc.id),evidence_id:evidence.id,evidence_role:'qc'});
  if(c.outcome==='recapture_required')await task('Повторити фіксацію: '+by('media_asset',rep.asset_id).title,rep.id);return qc;
 }
 if(c.type==='media.import'){
  const source=get('source_system',c.id,'legacy.write');const w=run('WF-06',source.id);
  if(c.simulate_failure){w.state='failed';w.finished_at=s.clock;w.notes='Не вдалося прочитати приклад';return {ok:false,id:w.id};}
  const raw=text(c.raw_text),source_hash=await rawHash(raw),external_key=text(c.external_key);
  const existing=t.source_record.find(r=>r.source_system_id===source.id&&r.external_key===external_key&&r.source_hash===source_hash);
  w.state='completed';w.finished_at=s.clock;w.notes=existing?'Повтор уже наявного запису':null;
  if(existing)return {id:existing.id,duplicate:true};
  return newEntity('source_record',{source_system_id:source.id,source_document_revision_id:null,external_key,parent_record_id:null,source_position:t.source_record.filter(x=>x.source_system_id===source.id).length+1,source_locator:c.locator||null,raw_payload:null,raw_text:raw,source_hash,import_run_id:w.id},archive(source.id));
 }
 if(c.type==='media.match'){
  const source=get('source_record',c.id,'legacy.write');fresh(source.id,c.expected_revision_id);const target=reg(c.entity_id);if(!target||!['person','place','physical_object','information_unit'].includes(target.entity_type))fail('invalid','Оберіть особу, місце, носій або запис.');get(target.entity_type,target.id,'domain.read');
  const candidate=await newEntity('candidate',{kind:'identity_match',target_entity_id:source.id,base_revision_id:rev(source.id),proposed_payload:{entity_id:target.id,entity_revision_id:rev(target.id),reason:text(c.reason)},payload_schema_version:'identity-match/1',proposed_entity_id:target.id,process_run_id:null,proposed_by:actor,confidence:null,state:'pending'},archive(source.id));t.candidate_source.push({candidate_id:candidate.id,source_entity_id:source.id,source_revision_id:rev(source.id),source_role:'source'});return candidate;
 }
 if(c.type==='media.match.review'){
  const candidate=get('candidate',c.id,'legacy.review');fresh(candidate.id,c.expected_revision_id);if(!['pending','deferred'].includes(candidate.state))fail('invalid','Рішення вже прийнято.');if(!['accept','reject','defer'].includes(c.decision))fail('invalid','Оберіть рішення.');
  if(candidate.base_revision_id!==rev(candidate.target_entity_id)||candidate.proposed_payload.entity_revision_id!==rev(candidate.proposed_entity_id))fail('stale','Відповідність потрібно звірити з актуальним описом.');
  const decision=await newEntity('review_decision',{target_entity_id:candidate.id,target_revision_id:rev(candidate.id),decision:c.decision,reviewer_account_id:actor,decided_at:s.clock,reason:text(c.reason),supersedes_decision_id:null},archive(candidate.id));candidate.state={accept:'accepted',reject:'rejected',defer:'deferred'}[c.decision];await revise(candidate,'Зафіксовано рішення про відповідність');
  if(c.decision==='accept'){if(!t.source_record_link.some(x=>x.source_record_id===candidate.target_entity_id&&x.entity_id===candidate.proposed_entity_id))t.source_record_link.push({source_record_id:candidate.target_entity_id,entity_id:candidate.proposed_entity_id,review_decision_id:decision.id,link_role:'describes'});t.review_application.push({review_decision_id:decision.id,result_entity_id:candidate.proposed_entity_id,result_revision_id:rev(candidate.proposed_entity_id),applied_at:s.clock});}
  if(c.decision==='defer')await task('Уточнити відповідність джерельного запису',candidate.target_entity_id);return decision;
 }
 if(c.type==='media.handover.create'){
  need('intake.send',c.archive_id);const selected=[...new Set(c.entity_ids||[])];if(!selected.length)fail('invalid','Оберіть матеріали.');for(const id of selected){const e=reg(id);if(!e||!['collecting_session','information_unit','file_object','physical_object','document','timed_layer'].includes(e.entity_type)||e.archive_id!==c.archive_id)fail('invalid','Матеріал поза обраним архівом.');get(e.entity_type,id,'domain.read');if(e.entity_type==='document'&&!['field_notebook','session_form'].includes(by('document',id).kind))fail('invalid','Оберіть польовий зошит або бланк сеансу.');if(c.expected_revision_ids)fresh(id,c.expected_revision_ids[id]);}
  const out=run('WF-04',selected[0]),incoming=run('WF-05',selected[0]);incoming.started_by=c.receiver_id;if(!can(s,c.receiver_id,'intake.receive',c.archive_id))fail('invalid','Приймач не має доступу до архіву.');
  const h={id:crypto.randomUUID(),from_workflow_run_id:out.id,to_workflow_run_id:incoming.id,manifest_file_id:null,manifest_checksum:'',state:'prepared',accepted_by:null,accepted_at:null,notes:c.notes||null};t.handover.push(h);
  for(const [i,id]of selected.entries())t.handover_item.push({handover_id:h.id,entity_id:id,revision_id:rev(id),position:i+1,item_checksum:reg(id).entity_type==='file_object'?by('file_object',id).sha256:null,item_state:'unresolved'});
  h.manifest_checksum=await hash(manifestPayload(t.handover_item.filter(x=>x.handover_id===h.id)));audit('handover.create',selected[0],null,null,'Підготовлено пакет');return h;
 }
 if(c.type==='media.handover.review'){
  const h=by('handover',c.id),origin=h&&by('workflow_run',h.from_workflow_run_id);if(!h)fail('forbidden','Пакет недоступний.');
  need('intake.receive',archive(origin.primary_entity_id)||origin.primary_entity_id);
  if(await hash(handoverState(s,h))!==c.expected_hash)fail('stale','Пакет змінився. Оновіть сторінку.');
  if(h.state!=='sent')fail('invalid','Звіряти можна надісланий пакет.');
  const items=t.handover_item.filter(x=>x.handover_id===h.id),checks=c.checks||[];
  if(checks.length!==items.length||new Set(checks.map(x=>x.position)).size!==items.length||checks.some(x=>!items.some(i=>i.position===x.position)))fail('invalid','Звірте кожен елемент пакета.');
  if(!['save','accept','return'].includes(c.decision))fail('invalid','Оберіть рішення.');
  for(const check of checks)await mediaCommand(s,actor,{type:'media.handover',id:h.id,expected_hash:await hash(handoverState(s,h)),action:'check',position:check.position,item_state:check.state,reason:check.reason},ctx);
  if(c.decision!=='save')await mediaCommand(s,actor,{type:'media.handover',id:h.id,expected_hash:await hash(handoverState(s,h)),action:c.decision,reason:c.reason},ctx);
  return h;
 }
 if(c.type==='media.handover'){
  const h=by('handover',c.id),origin=h&&by('workflow_run',h.from_workflow_run_id),a=origin&&(archive(origin.primary_entity_id)||origin.primary_entity_id);if(!h)fail('forbidden','Пакет недоступний.');need(c.action==='send'?'intake.send':'intake.receive',a);
  if(await hash(handoverState(s,h))!==c.expected_hash)fail('stale','Пакет змінився. Оновіть сторінку.');const items=t.handover_item.filter(x=>x.handover_id===h.id);
  if(c.action==='send'){if(!['prepared','returned'].includes(h.state))fail('invalid','Пакет уже надіслано.');h.state='sent';}
  else if(c.action==='check'){
   if(h.state!=='sent')fail('invalid','Звіряти можна надісланий пакет.');const item=items.find(x=>x.position===c.position);if(!item||!['present','missing','unresolved'].includes(c.item_state))fail('invalid','Оберіть елемент і стан.');
   if(c.item_state==='present'&&reg(item.entity_id).entity_type==='file_object'&&independentCopies(s,item.entity_id)<2)fail('blocked','Спочатку забезпечте дві перевірені копії в незалежних сховищах.');
   item.item_state=c.item_state;if(c.item_state!=='present'){text(c.reason);await task('Звірити елемент пакета: '+c.reason,item.entity_id,h.to_workflow_run_id);}
  }else if(c.action==='accept'){
   if(h.state!=='sent'||!items.length||items.some(x=>x.item_state!=='present'))fail('blocked','Спочатку звірте всі елементи пакета.');
   if(items.some(x=>reg(x.entity_id).entity_type==='file_object'&&(x.item_checksum!==by('file_object',x.entity_id).sha256||independentCopies(s,x.entity_id)<2)))fail('blocked','Файли потребують перевірки контрольних сум і резервів.');h.state='accepted';h.accepted_by=actor;h.accepted_at=s.clock;
  }else if(c.action==='return'){if(h.state!=='sent')fail('invalid','Повернути можна надісланий пакет.');h.state='returned';h.notes=text(c.reason);await task('Усунути зауваження до пакета: '+c.reason,origin.primary_entity_id,h.from_workflow_run_id);}
  else fail('invalid','Невідома дія пакета.');audit('handover.'+c.action,origin.primary_entity_id,null,null,c.reason||'Оновлено передання');return h;
 }
 fail('invalid','Невідома дія.');
}
