// WF-10 records human preparation; no equipment is started by this module.
export const captureProfiles={
 image:{label:'Зображення',fields:{format:['Формат',['TIFF','PNG','JPEG']],resolution_ppi:['Роздільність, ppi',[72,9600]],bit_depth:['Глибина кольору, біт',[8,16,24,48]],color_mode:['Колір',['RGB','grayscale','monochrome']]}},
 audio:{label:'Аудіо',fields:{format:['Формат',['WAV','BWF','FLAC']],sample_rate_hz:['Частота дискретизації, Гц',[8000,384000]],bit_depth:['Розрядність, біт',[16,24,32]],channels:['Канали',[1,2,4,8]]}},
 video:{label:'Відео',fields:{format:['Контейнер',['MOV','MKV','MP4']],codec:['Кодек',['FFV1','ProRes','H264']],width:['Ширина, px',[160,16384]],height:['Висота, px',[120,16384]],frame_rate:['Кадрів за секунду',[1,240]]}}
};
const reg=(s,id)=>s.tables.entity.find(x=>x.id===id),rev=(s,id)=>reg(s,id)?.current_revision_id;
export function profileProblems(profile){
 const schema=captureProfiles[profile?.kind];if(!schema)return ['Оберіть вид фіксації.'];const errors=[];
 for(const [key,[title,range]] of Object.entries(schema.fields)){const value=profile[key];if(typeof range[0]==='string'? !range.includes(value):range.length===2? !Number.isFinite(value)||value<range[0]||value>range[1]||key!=='frame_rate'&&!Number.isInteger(value):!range.includes(value))errors.push('Перевірте параметр «'+title+'».');}
 if(!profile.device?.trim())errors.push('Зазначте запланований пристрій.');return errors;
}
export function plannedOutputs(s,plan){return s.tables.capture_plan_item.filter(x=>x.plan_revision_id===plan).sort((a,b)=>a.position-b.position).flatMap(x=>Array.from({length:x.expected_count||1},(_,i)=>({plan_position:x.position,kind:x.expected_kind,label:x.part_label+((x.expected_count||1)>1?' · '+(i+1):'')})));}
export function preparationFacts(s,job){
 const t=s.tables,p=job?.specification,physical=t.physical_object.find(x=>x.id===job?.physical_object_id),condition=t.condition_assessment.filter(x=>x.physical_object_id===physical?.id).at(-1),custody=t.custody_event.filter(x=>x.physical_object_id===physical?.id).at(-1),issues=[];
 if(!physical||reg(s,physical.id)?.retired_at)return {issues:['Носій недоступний.'],ready:false};
 if(p?.preparation_version!==1)issues.push('Повторно підготуйте план за поточними умовами.');
 issues.push(...profileProblems(p?.capture_profile));
 if(!p?.stop_conditions?.trim())issues.push('Визначте умови зупинки роботи.');
 const parts=t.capture_plan_item.filter(x=>x.plan_revision_id===job.capture_plan_revision_id);
 if(!parts.length||parts.some(x=>x.expected_kind!==p?.capture_profile?.kind||!Number.isInteger(x.expected_count)||x.expected_count<1))issues.push('Перевірте вид і кількість частин плану.');
 if(!p?.object_check||p.object_check.object_revision_id!==rev(s,physical.id)||p.object_check.result!=='matched'||!p.object_check.identifier?.trim())issues.push('Звірте носій, його позначення й поточний опис із завданням.');
 if(!condition||condition.condition_code!=='stable')issues.push('Потрібна оцінка придатності носія до роботи.');
 if(condition&&!t.evidence_link.some(x=>x.subject_entity_id===condition.id&&x.evidence_role==='condition'&&t.evidence.some(e=>e.id===x.evidence_id&&e.source_entity_id===physical.id&&e.source_revision_id===rev(s,physical.id))))issues.push('Потрібен доказ огляду поточної версії носія.');
 if(!condition?.risk_notes?.trim()||!condition?.handling_instructions?.trim())issues.push('Зафіксуйте ризики та правила поводження.');
 if(!p?.transfer||p.transfer.custody_event_id!==custody?.id||!custody?.evidence_id||!custody.to_person_id)issues.push('Зафіксуйте чинне тимчасове передання й відповідального.');
 if(p?.transfer?.return_due_at&&Date.parse(p.transfer.return_due_at)<=Date.parse(s.clock))issues.push('Строк тимчасового передання минув.');
 const confirmation=p?.confirmation;
 const current=confirmation&&confirmation.object_revision_id===rev(s,physical.id)&&confirmation.plan_revision_id===job.capture_plan_revision_id&&confirmation.condition_revision_id===rev(s,condition?.id)&&confirmation.custody_revision_id===rev(s,custody?.id);
 return {issues,condition,custody,current:!!current,ready:!issues.length&&p.readiness==='ready'&&!!current};
}
export function validatePreparation(s,ok,canonical){
 const t=s.tables;
 for(const r of t.entity_revision){for(const j of r.snapshot._relations?.digitization_job||[]){const p=j.specification;if(p.preparation_version!==1)continue;
  ok(!profileProblems(p.capture_profile).length,'Параметри профілю фіксації');
  ok(canonical(p.plan_items)===canonical(t.capture_plan_item.filter(x=>x.plan_revision_id===j.capture_plan_revision_id)),'Змінено історичний склад плану');
  for(const rid of [p.object_check?.object_revision_id,p.confirmation?.object_revision_id].filter(Boolean))ok(t.entity_revision.some(x=>x.id===rid&&x.entity_id===j.physical_object_id),'Звірка іншого носія');
  if(p.object_check)ok(t.evidence.some(x=>x.id===p.object_check.evidence_id&&x.source_entity_id===j.physical_object_id),'Доказ звірки');
  if(p.transfer)ok(t.custody_event.some(x=>x.id===p.transfer.custody_event_id&&x.physical_object_id===j.physical_object_id),'Передання іншого носія');
 }}
}
export async function capturePreparationCommand(s,actor,c,ctx){
 const {need,fail,revise,hash,snapshot,audit}=ctx,t=s.tables,by=(k,id)=>t[k]?.find(x=>x.id===id),e=id=>reg(s,id),r=id=>rev(s,id),text=v=>{if(typeof v!=='string'||!v.trim())fail('invalid','Заповніть обов’язкове поле.');return v.trim();};
 const fresh=(id,rid)=>{if(!e(id)||r(id)!==rid)fail('stale','Запис змінено. Оновіть сторінку й повторіть звірку.');};
 const add=async(kind,values,a)=>{const x={id:crypto.randomUUID(),...values},rid=crypto.randomUUID();(t[kind]??=[]).push(x);t.entity.push({id:x.id,entity_type:kind,owner_installation_id:s.demo.ids.installation,archive_id:a,owner_account_id:actor,current_revision_id:rid,retired_at:null});const snap=snapshot(t,kind,x);t.entity_revision.push({id:rid,entity_id:x.id,revision_no:1,previous_revision_id:null,snapshot:snap,snapshot_hash:await hash(snap),recorded_at:s.clock,actor_account_id:actor,process_run_id:null,change_reason:c.reason||'Підготовка носія'});audit(c.type,x.id,null,rid,c.reason);return x;};
 let job=c.id&&t.digitization_job.find(x=>x.work_item_id===c.id),obj=by('physical_object',job?.physical_object_id||c.physical_object_id);
 if(!obj||e(obj.id)?.retired_at)fail('invalid','Оберіть доступний фізичний носій.');need('physical.write',obj.archive_id);if(job)fresh(job.work_item_id,c.expected_revision_id);else if(c.type!=='media.job.create')fail('invalid','Оберіть завдання оцифрування.');
 const evidence=note=>add('evidence',{source_entity_id:obj.id,source_revision_id:r(obj.id),external_uri:null,locator:c.locator?.trim()||null,quote_text:null,note:text(note),captured_at:s.clock},obj.archive_id);
 const row=()=>by('work_item',job.work_item_id),clear=()=>{job.specification.readiness='draft';job.specification.confirmation=null;};
 if(c.type==='media.job.create'||c.type==='media.plan'){
  fresh(obj.id,c.expected_object_revision_id);text(c.reason);const profile=c.capture_profile,errors=profileProblems(profile);if(errors.length)fail('invalid',errors.join(' '));
  const items=c.items;if(!Array.isArray(items)||!items.length||items.length>100||items.reduce((n,x)=>n+Number(x.expected_count),0)>500||items.some(x=>!x.part_label?.trim()||x.expected_kind!==profile.kind||!Number.isInteger(x.expected_count)||x.expected_count<1||x.expected_count>100)||new Set(items.map(x=>x.part_label.trim().toLocaleLowerCase('uk'))).size!==items.length)fail('invalid','Перевірте частини: унікальні назви, кількість і вид; до 100 рядків та 500 результатів.');
  text(c.stop_conditions);let doc;
  if(job){const old=by('entity_revision',job.capture_plan_revision_id);doc=by('document',old.entity_id);fresh(doc.id,c.plan_revision_id);doc.body_text=items.map(x=>x.part_label).join('\n');await revise(doc,c.reason);}
  else doc=await add('document',{kind:'capture_plan',title:'План: '+obj.title,body_text:items.map(x=>x.part_label).join('\n'),language_tag:'uk',media_asset_id:null,physical_object_id:obj.id},obj.archive_id);
  items.forEach((x,i)=>t.capture_plan_item.push({plan_revision_id:r(doc.id),position:i+1,part_label:x.part_label.trim(),expected_kind:x.expected_kind,expected_count:x.expected_count}));
  if(!job){const run={id:crypto.randomUUID(),workflow_code:'WF-11',primary_entity_id:obj.id,started_by:actor,started_at:s.clock,finished_at:null,state:'in_progress',notes:c.reason};t.workflow_run.push(run);const work=await add('work_item',{workflow_run_id:run.id,kind:'digitization',title:'Оцифрувати: '+obj.title,state:'open',assigned_account_id:actor,assigned_role_id:null,due_at:null,resolution:null},obj.archive_id);t.work_item_target.push({work_item_id:work.id,entity_id:obj.id,revision_id:r(obj.id)});t.work_item_event.push({work_item_id:work.id,from_state:null,to_state:'open',actor_account_id:actor,occurred_at:s.clock,reason:c.reason});job={work_item_id:work.id,physical_object_id:obj.id,source_part:null,condition_assessment_id:null,capture_plan_revision_id:r(doc.id),specification:{}};t.digitization_job.push(job);}
  job.capture_plan_revision_id=r(doc.id);job.specification={...job.specification,preparation_version:1,plan_items:structuredClone(t.capture_plan_item.filter(x=>x.plan_revision_id===r(doc.id))),profile:captureProfiles[profile.kind].label,capture_profile:Object.fromEntries(['kind','device',...Object.keys(captureProfiles[profile.kind].fields)].map(k=>[k,profile[k]])),stop_conditions:c.stop_conditions.trim()};clear();await revise(row(),c.reason);return row();
 }
 const p=job.specification;
 if(c.type==='preparation.check'){
  fresh(obj.id,c.expected_object_revision_id);if(!['matched','mismatch'].includes(c.result)||c.confirm!==true)fail('invalid','Підтвердьте звірку носія.');text(c.identifier);if(c.result==='matched'&&obj.reference_code&&c.identifier.trim()!==obj.reference_code)fail('invalid','Позначення не збігається із шифром носія. Зафіксуйте розбіжність або уточніть опис.');const ev=await evidence(c.evidence_note);
  p.object_check={object_revision_id:r(obj.id),identifier:c.identifier.trim(),result:c.result,evidence_id:ev.id,checked_by:actor,checked_at:s.clock};clear();await revise(row(),c.evidence_note);return row();
 }
 if(c.type==='preparation.transfer'||c.type==='preparation.return'){
  fresh(obj.id,c.expected_object_revision_id);
  const last=t.custody_event.filter(x=>x.physical_object_id===obj.id).at(-1);if(!last||last.id!==c.expected_custody_id)fail('stale','Звірте поточне місце зберігання.');
  const returning=c.type==='preparation.return',location=by('storage_location',returning?p.transfer?.return_location_id:c.to_location_id),person=by('person',returning?p.transfer?.return_person_id:c.to_person_id);
  if(!location||e(location.id)?.archive_id!==obj.archive_id||e(location.id)?.retired_at||!returning&&(!person||e(person.id)?.archive_id!==obj.archive_id||e(person.id)?.retired_at))fail('invalid','Оберіть місце й відповідального в цьому архіві.');
  if(returning&&p.transfer?.custody_event_id!==last.id)fail('stale','Тимчасове передання вже не є поточним.');
  if(!returning&&p.transfer?.custody_event_id===last.id)fail('invalid','Носій уже передано для цієї роботи. Спочатку зафіксуйте повернення.');
  if(!returning&&(!last.to_location_id||!Number.isFinite(Date.parse(c.return_due_at))||Date.parse(c.return_due_at)<=Date.parse(s.clock)))fail('invalid','Потрібні вихідне місце й майбутній строк повернення.');
  text(c.reason);const ev=await evidence(c.evidence_note),event=await add('custody_event',{physical_object_id:obj.id,from_location_id:last.to_location_id,from_person_id:last.to_person_id,to_location_id:location.id,to_person_id:person?.id||null,from_institution_id:last.to_institution_id,to_institution_id:location.institution_id,occurred_at:s.clock,reason:c.reason,evidence_id:ev.id},obj.archive_id);
  if(returning)p.transfer={...p.transfer,returned_event_id:event.id,returned_at:s.clock};else p.transfer={custody_event_id:event.id,return_location_id:last.to_location_id,return_person_id:last.to_person_id,return_due_at:c.return_due_at};clear();await revise(row(),c.reason);return event;
 }
 if(c.type==='preparation.confirm'){
  if(c.confirm!==true)fail('invalid','Підтвердьте готовність носія.');const facts=preparationFacts(s,job);if(facts.issues.length)fail('blocked',facts.issues.join(' '));
  fresh(obj.id,c.expected_object_revision_id);fresh(facts.condition.id,c.expected_condition_revision_id);fresh(facts.custody.id,c.expected_custody_revision_id);text(c.reason);
  p.readiness='ready';p.confirmation={object_revision_id:r(obj.id),plan_revision_id:job.capture_plan_revision_id,condition_revision_id:r(facts.condition.id),custody_revision_id:r(facts.custody.id),confirmed_by:actor,confirmed_at:s.clock,reason:c.reason};job.condition_assessment_id=facts.condition.id;await revise(row(),c.reason);
  for(const w of t.work_item.filter(w=>w.kind==='capture_preparation_review'&&!['done','cancelled'].includes(w.state)&&t.work_item_target.some(x=>x.work_item_id===w.id&&x.entity_id===job.work_item_id))){const from=w.state;w.state='done';w.resolution=c.reason;await revise(w,c.reason);t.work_item_event.push({work_item_id:w.id,from_state:from,to_state:'done',actor_account_id:actor,occurred_at:s.clock,reason:c.reason});}return row();
 }
 if(c.type==='preparation.postpone'){
  text(c.reason);p.readiness='postponed';p.confirmation=null;p.postponement={reason:c.reason,by:actor,at:s.clock};await revise(row(),c.reason);
  let w=t.work_item.find(w=>w.kind==='capture_preparation_review'&&!['done','cancelled'].includes(w.state)&&t.work_item_target.some(x=>x.work_item_id===w.id&&x.entity_id===job.work_item_id));
  if(!w){w=await add('work_item',{workflow_run_id:null,kind:'capture_preparation_review',title:'Підготувати носій: '+obj.title,state:'open',assigned_account_id:actor,assigned_role_id:null,due_at:null,resolution:null},obj.archive_id);t.work_item_target.push({work_item_id:w.id,entity_id:job.work_item_id,revision_id:r(job.work_item_id)});}t.work_item_event.push({work_item_id:w.id,from_state:null,to_state:'open',actor_account_id:actor,occurred_at:s.clock,reason:c.reason});return w;
 }
 fail('invalid','Невідома дія підготовки.');
}
