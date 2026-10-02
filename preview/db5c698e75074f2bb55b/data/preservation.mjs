import {fileBytes,MAX_MEDIA_BYTES} from './binary.mjs?v=20261001-wf14';
import {captureFileProblem} from './digitization.mjs?v=20261001-wf14';

export function preservationStatus(s,fileId,now=Date.now()){
 const t=s.tables,plan=(t.preservation_plan||[]).filter(x=>x.file_id===fileId).at(-1),required=plan?.required_copies||2,days=plan?.check_interval_days||90;
 const copies=t.storage_copy.filter(x=>x.file_id===fileId),confirmed=copies.filter(x=>{const c=t.fixity_check.filter(c=>c.copy_id===x.id).at(-1);return x.state==='verified'&&c?.result==='match'&&['selected-file','browser-ingest'].includes(c.evidence_method)&&now-Date.parse(c.checked_at)<=days*86400000;});
 const domains=new Set(confirmed.map(x=>t.digital_storage_location.find(l=>l.id===x.storage_location_id)?.failure_domain));
 const reps=t.representation_file.filter(x=>x.file_id===fileId).map(x=>t.representation.find(r=>r.id===x.representation_id));
 const qualityReady=reps.every(r=>{const cap=t.capture_event.find(x=>x.id===r.technical_metadata?.capture_event_id);if(!cap?.digitization_job_id)return true;const revision=t.entity.find(x=>x.id===r.id)?.current_revision_id,q=t.qc_record.filter(x=>x.representation_revision_id===revision).at(-1);return ['pass','pass_with_note'].includes(q?.outcome);});
 return {plan,required,days,confirmed,independent:domains.size,qualityReady,ready:qualityReady&&domains.size>=required};
}

export function validatePreservation(s,require,fk){
 const t=s.tables;
 for(const p of t.preservation_plan||[]){fk('file_object',p.file_id);fk('account',p.actor_account_id);require(Number.isInteger(p.required_copies)&&p.required_copies>=2&&p.required_copies<=5,'Потрібно від 2 до 5 незалежних копій');require(Number.isInteger(p.check_interval_days)&&p.check_interval_days>=1&&p.check_interval_days<=365,'Інтервал перевірок: 1–365 днів');}
 for(const c of t.fixity_check||[])if(c.evidence_method){require(['selected-file','browser-ingest','reported-unavailable'].includes(c.evidence_method),'Невідомий доказ перевірки');if(c.result==='match')require(c.observed_hash&&c.byte_size>=0,'Перевірка потребує байтів');}
 for(const r of t.storage_recovery_check||[])if(r.source_copy_id){fk('storage_copy',r.source_copy_id);fk('entity_revision',r.source_revision_id);const source=t.storage_copy.find(x=>x.id===r.source_copy_id),target=t.storage_copy.find(x=>x.id===r.copy_id);require(source.file_id===target?.file_id&&t.entity_revision.find(x=>x.id===r.source_revision_id).entity_id===source.id,'Відновлення потребує точної версії копії цього файла');if(r.result==='pass')require(r.restored_hash===t.file_object.find(x=>x.id===source.file_id).sha256,'Відновлені байти мають збігатися');}
}

export async function preservationCommand(s,actor,c,h){
 const {get,fresh,newEntity,revise,run,task,rawHash,fail,need}=h,t=s.tables,by=(k,id)=>t[k]?.find(x=>x.id===id),rev=id=>by('entity',id)?.current_revision_id,archive=id=>by('entity',id)?.archive_id,now=new Date().toISOString();
 const text=x=>{if(typeof x!=='string'||!x.trim())fail('invalid','Заповніть обов’язкове поле.');return x.trim();};
 const bytes=content=>{let b;try{b=fileBytes(content);}catch{fail('invalid','Не вдалося прочитати байти файла.');}if(!b.length||b.length>MAX_MEDIA_BYTES)fail('invalid','Додайте файл розміром від 1 байта до 2 МБ.');return b;};
 const log=async(row,content,status='readable')=>{
  const f=by('file_object',row.file_id),b=status==='readable'?bytes(content):null,hash=b?await rawHash(content):null,result=status!=='readable'?status:hash===f.sha256&&b.length===f.byte_size?'match':'mismatch';
  t.fixity_check.push({copy_id:row.id,checked_at:now,algorithm:'SHA-256',observed_hash:hash,byte_size:b?.length??null,result,process_run_id:null,evidence_method:b?'selected-file':'reported-unavailable',actor_account_id:actor,notes:c.notes||null});
  row.state=result==='match'?'verified':result==='missing'?'missing':'corrupt';await revise(row,'Перевірено файл у місці зберігання');
  const tasks=t.work_item_target.filter(x=>x.entity_id===row.id).map(x=>by('work_item',x.work_item_id)).filter(x=>x?.kind==='preservation_review'&&!['done','cancelled'].includes(x.state));
  if(result!=='match'&&!tasks.length){const issue=await task('Перевірити копію: '+f.original_filename,row.id);issue.kind='preservation_review';await revise(issue,'Потрібна перевірка копії');}
  if(result==='match')for(const issue of tasks){t.work_item_event.push({work_item_id:issue.id,from_state:issue.state,to_state:'done',actor_account_id:actor,occurred_at:now,reason:'Байти копії перевірено: SHA-256 і розмір збігаються'});issue.state='done';issue.resolution='Цілісність копії підтверджено';await revise(issue,'Перевірка копії закрила питання');}
  return {result,hash};
 };
 if(c.type==='media.storage.location'){
  need('media.write',c.archive_id);const name=text(c.name),domain=text(c.failure_domain);
  if(t.digital_storage_location.some(x=>x.name===name))fail('invalid','Місце з такою назвою вже існує.');
  const row={id:crypto.randomUUID(),name,installation_id:s.demo.ids.installation,storage_kind:'manual',failure_domain:domain,base_uri:null,notes:text(c.notes)};t.digital_storage_location.push(row);return row;
 }
 if(c.type==='media.preservation.plan'){
  const f=get('file_object',c.file_id),old=(t.preservation_plan||[]).filter(x=>x.file_id===f.id).at(-1);
  if((old?.id||null)!==(c.expected_plan_id||null))fail('stale','План збереження змінився. Оновіть сторінку.');
  const row={id:crypto.randomUUID(),file_id:f.id,required_copies:Number(c.required_copies),check_interval_days:Number(c.check_interval_days),reason:text(c.reason),recorded_at:now,actor_account_id:actor};(t.preservation_plan??=[]).push(row);return row;
 }
 if(['media.ingest','media.derivative'].includes(c.type)){
  let asset,a,input;
  if(c.type==='media.derivative'){
   input=get('representation',c.representation_id);fresh(input.id,c.expected_revision_id);asset=by('media_asset',input.asset_id);a=archive(asset.id);
   if(t.representation_file.filter(x=>x.representation_id===input.id).some(x=>!preservationStatus(s,x.file_id).qualityReady))fail('blocked','Спочатку прийміть результат у контролі якості.');
   if(!['access_derivative','thumbnail','preservation_master','mezzanine'].includes(c.role))fail('invalid','Оберіть роль нового представлення.');text(c.operation);
  }else{need('media.write',c.archive_id);a=c.archive_id;}
  const files=c.files;if(!Array.isArray(files)||!files.length||files.length>20)fail('invalid','Оберіть від 1 до 20 файлів.');let total=0;
  for(const f of files){text(f.filename);text(f.source_path);text(f.mime_type);if(f.content?.encoding!=='base64')fail('invalid','Оберіть фактичний файл.');total+=bytes(f.content).length;if(f.expected_sha256&&(!/^[a-fA-F0-9]{64}$/.test(f.expected_sha256)||await rawHash(f.content)!==f.expected_sha256.toLowerCase()))fail('invalid','Контрольна сума отриманого файла не збігається.');if(f.mime_type.startsWith('image/')||f.mime_type.startsWith('audio/')||f.mime_type.startsWith('video/')){const error=captureFileProblem(f,f.mime_type.split('/')[0]);if(error)fail('invalid',error);}if(input&&c.role==='thumbnail'&&!f.mime_type.startsWith('image/'))fail('invalid','Мініатюра має бути зображенням.');}
  if(total>MAX_MEDIA_BYTES)fail('invalid','За одне збереження можна додати до 2 МБ.');
  if(c.confirm!==true)fail('invalid','Підтвердьте походження файлів.');
  if(!asset){const kinds=new Set(files.map(f=>f.mime_type.split('/')[0]));asset=await newEntity('media_asset',{title:text(c.title),media_kind:kinds.size===1?({image:'photo',audio:'audio',video:'video'}[[...kinds][0]]||'document'):'other',description:c.description||null},a);if(c.subject_id){const subject=by('entity',c.subject_id);if(!subject||subject.archive_id!==a||!['physical_object','collecting_session','information_unit','document'].includes(subject.entity_type))fail('invalid','Оберіть матеріал цього архіву.');get(subject.entity_type,subject.id,'domain.read');t.media_asset_subject.push({asset_id:asset.id,subject_entity_id:subject.id,relation_role:'documents',evidence_id:null});await revise(asset,'Пов’язано з матеріалом');}}
  const role=input?c.role:'received_original',version=Math.max(0,...t.representation.filter(x=>x.asset_id===asset.id&&x.role===role).map(x=>x.representation_version))+1;
  const rep=await newEntity('representation',{asset_id:asset.id,role,representation_version:version,duration_ms:null,technical_metadata:{ingest_method:input?'derived-file':'selected-file',operation:c.operation||null}},a),w=run('WF-13',asset.id);
  let location=t.digital_storage_location.find(x=>x.storage_kind==='browser-local');if(!location){location={id:crypto.randomUUID(),name:'Цей браузер',installation_id:s.demo.ids.installation,storage_kind:'browser-local',failure_domain:'browser-local',base_uri:null};t.digital_storage_location.push(location);}
  for(const [i,f]of files.entries()){
   const sha256=await rawHash(f.content),size=bytes(f.content).length;
   let file=t.file_object.find(x=>archive(x.id)===a&&x.sha256===sha256&&x.byte_size===size);
   if(!file){file=await newEntity('file_object',{sha256,byte_size:size,mime_type:f.mime_type,pronom_id:null,original_filename:f.filename,received_at:now,technical_metadata:{declared_mime_type:f.mime_type}},a);s.demo.file_contents[file.id]=structuredClone(f.content);}
   t.file_ingest_occurrence.push({file_id:file.id,workflow_run_id:w.id,received_filename:f.filename,source_path:f.source_path,received_at:now,capture_event_id:null});
   t.representation_file.push({representation_id:rep.id,file_id:file.id,position:i+1,component_label:f.filename,component_role:'content',timeline_offset_ms:null});
   if(!t.storage_copy.some(x=>x.file_id===file.id&&x.storage_location_id===location.id)){
    const row=await newEntity('storage_copy',{file_id:file.id,storage_location_id:location.id,storage_key:file.id,state:'pending',created_at:now},a);
    await log(row,f.content);t.fixity_check.at(-1).evidence_method='browser-ingest';
   }
  }
  if(input)t.representation_derivation.push({output_representation_id:rep.id,input_representation_revision_id:rev(input.id),process_run_id:null,operation:text(c.operation)});
  await revise(rep,'Збережено отримані байти й походження');w.state='completed';w.finished_at=now;return {id:asset.id,representation_id:rep.id};
 }
 if(c.type==='media.copy'){
  const f=get('file_object',c.file_id),location=by('digital_storage_location',c.location_id);if(!location||location.storage_kind==='browser-local')fail('invalid','Оберіть зовнішнє місце зберігання.');const key=text(c.storage_key);
  if(c.confirm!==true)fail('invalid','Підтвердьте, що файл прочитано з указаного місця.');
  if(t.storage_copy.some(x=>x.storage_location_id===location.id&&x.storage_key===key))fail('invalid','Цей шлях уже зареєстровано. Відкрийте перевірку наявної копії.');
  const row=await newEntity('storage_copy',{file_id:f.id,storage_location_id:location.id,storage_key:key,state:'pending',created_at:now},archive(f.id));const result=await log(row,c.content);return {...row,...result};
 }
 const row=get('storage_copy',c.id);fresh(row.id,c.expected_revision_id);
 if(c.type==='media.fixity'){
  if(c.confirm!==true)fail('invalid','Підтвердьте перевірку вказаного місця.');
  const status=c.status||'readable';if(!['readable','missing','unreadable'].includes(status))fail('invalid','Оберіть результат читання.');if(status!=='readable')text(c.notes);
  return log(row,c.content,status);
 }
 if(c.type==='media.restore'){
  const source=get('storage_copy',c.source_copy_id);fresh(source.id,c.expected_source_revision_id);
  if(source.id===row.id||source.file_id!==row.file_id||by('digital_storage_location',source.storage_location_id)?.failure_domain===by('digital_storage_location',row.storage_location_id)?.failure_domain)fail('invalid','Оберіть копію цього файла з іншої групи сховищ.');
  if(c.confirm!==true)fail('invalid','Підтвердьте читання резервної копії.');text(c.notes);
  const result=await log(source,c.content),ok=result.result==='match';
  // A reconstructed buffer proves recoverability, not a write to the destination.
  t.storage_recovery_check.push({copy_id:row.id,source_copy_id:source.id,source_revision_id:rev(source.id),checked_at:now,method:'Перечитування резерву та відновлення байтів для завантаження',result:ok?'pass':'fail',restored_hash:ok?await rawHash(structuredClone(c.content)):null,operator_note:c.notes,notes:ok?'Відновлений файл готовий до завантаження. Збережіть у цільовому місці та перевірте його повторно.': 'Резерв не збігається з оригіналом. '+c.notes,process_run_id:null});
  return {ok};
 }
 fail('invalid','Невідома дія збереження.');
}
