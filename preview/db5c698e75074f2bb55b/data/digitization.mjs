import {fileBytes,MAX_MEDIA_BYTES} from './binary.mjs?v=20261007-notes1';
import {plannedOutputs,preparationFacts} from './capture-preparation.mjs?v=20261007-notes1';
export const captureFormats={
 'image/png':'PNG','image/jpeg':'JPEG','image/tiff':'TIFF','image/webp':'WEBP',
 'audio/wav':'WAV','audio/x-wav':'WAV','audio/flac':'FLAC','audio/mpeg':'MP3','audio/ogg':'OGG','audio/webm':'WEBM','audio/mp4':'MP4',
 'video/webm':'WEBM','video/mp4':'MP4','video/quicktime':'MOV','video/x-matroska':'MKV'
};
export function captureFileProblem(f,kind){
 if(!f||!captureFormats[f.mime_type]||f.mime_type.split('/')[0]!==kind)return 'Вид файла не відповідає плану.';
 if(f.content?.encoding!=='base64')return 'Додайте отриманий медіафайл.';
 let b;try{b=fileBytes(f.content);}catch{return 'Некоректні байти файла.';}
 if(!b.length||b.length>MAX_MEDIA_BYTES)return 'Файл має містити від 1 байта до 2 МБ.';
 const ascii=(at,n)=>String.fromCharCode(...b.slice(at,at+n)),format=captureFormats[f.mime_type];
 const good={PNG:b.length>=24&&ascii(1,3)==='PNG'&&b[0]===137,JPEG:b.length>=4&&b[0]===255&&b[1]===216&&b[2]===255,TIFF:b.length>=8&&(['II*\0','MM\0*'].includes(ascii(0,4))),WEBP:ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP',WAV:ascii(0,4)==='RIFF'&&ascii(8,4)==='WAVE',FLAC:ascii(0,4)==='fLaC',MP3:ascii(0,3)==='ID3'||b[0]===255&&(b[1]&224)===224,OGG:ascii(0,4)==='OggS',WEBM:b[0]===26&&b[1]===69&&b[2]===223&&b[3]===163,MKV:b[0]===26&&b[1]===69&&b[2]===223&&b[3]===163,MP4:ascii(4,4)==='ftyp',MOV:['ftyp','moov','mdat','wide'].includes(ascii(4,4))}[format];
 return good?null:'Заголовок файла не відповідає обраному формату.';
}
export async function digitize(s,actor,c,h){
 const {get,fresh,newEntity,revise,run,task,copy,manifest,rawHash,fail}=h,t=s.tables,by=(k,id)=>t[k].find(x=>x.id===id),rev=id=>by('entity',id)?.current_revision_id;
 const required=x=>{if(typeof x!=='string'||!x.trim())fail('invalid','Заповніть обов’язкові відомості фіксації.');return x.trim();};
 const w=get('work_item',c.job_id);fresh(w.id,c.expected_revision_id);const job=t.digitization_job.find(x=>x.work_item_id===w.id),a=by('entity',w.id).archive_id;
 if(!job||w.state==='cancelled'||!preparationFacts(s,job).ready)fail('blocked','Носій і план мають бути готові до фіксації.');
 const plan=plannedOutputs(s,job.capture_plan_revision_id),profile=job.specification.capture_profile,files=c.files;
 if(!Array.isArray(files)||!files.length||files.length>plan.length||new Set(files.map(x=>x.position)).size!==files.length)fail('invalid','Додайте файли до унікальних частин плану.');
 let total=0;for(const f of files){if(!Number.isInteger(f.position)||!plan[f.position-1])fail('invalid','Частина поза планом.');required(f.filename);const error=captureFileProblem(f,profile.kind);if(error)fail('invalid',error);total+=fileBytes(f.content).length;}
 if(total>MAX_MEDIA_BYTES)fail('invalid','Для одного збереження додайте до 2 МБ файлів.');
 const operator=by('person',c.operator_person_id);if(!operator||by('entity',operator.id).archive_id!==a||by('entity',operator.id).retired_at)fail('invalid','Оберіть оператора цього архіву.');
 required(c.device_model);required(c.software_name);required(c.software_version);required(c.actual_settings);
 const at=Date.parse(c.occurred_at);if(!Number.isFinite(at)||at>Math.max(Date.parse(s.clock),Date.now())+60000)fail('invalid','Вкажіть фактичну дату й час фіксації.');
 if(!['import','browser'].includes(c.method)||!['received_original','preservation_master'].includes(c.role))fail('invalid','Оберіть спосіб і роль результату.');
 if(c.confirm!==true)fail('invalid','Підтвердьте походження та параметри результату.');
 const missing=plan.flatMap((p,i)=>files.some(f=>f.position===i+1)?[]:[i+1]),deviations=[];
 if(missing.length)deviations.push('Немає частин: '+missing.join(', '));
 const expected=profile.format;
 if(files.some(f=>captureFormats[f.mime_type]!==expected&&!(expected==='BWF'&&captureFormats[f.mime_type]==='WAV')))deviations.push('Формат відрізняється від плану');
 if(c.device_model.trim()!==profile.device)deviations.push('Пристрій відрізняється від плану');
 if(deviations.length)required(c.deviation_reason);
 let previous=null,asset;
 if(c.previous_capture_id){previous=get('capture_event',c.previous_capture_id);fresh(previous.id,c.expected_previous_revision_id);if(previous.digitization_job_id!==w.id)fail('invalid','Попередня фіксація належить іншій роботі.');required(c.recapture_reason);const old=t.representation.find(x=>x.technical_metadata?.capture_event_id===previous.id);asset=get('media_asset',old.asset_id);}
 else asset=await newEntity('media_asset',{title:'Оцифрування: '+by('physical_object',job.physical_object_id).title,media_kind:profile.kind==='image'?'photo':profile.kind,description:null},a);
 if(!previous){t.media_asset_subject.push({asset_id:asset.id,subject_entity_id:job.physical_object_id,relation_role:'capture',evidence_id:null});await revise(asset,'Пов’язано з носієм');}
 const workflow=run('WF-11',job.physical_object_id),cap=await newEntity('capture_event',{session_id:null,digitization_job_id:w.id,operator_person_id:operator.id,occurred_at:new Date(at).toISOString(),recording_form:profile.kind==='image'?'photo':profile.kind,recorder_type_term_id:null,device_make:c.device_make?.trim()||null,device_model:c.device_model.trim(),device_serial:c.device_serial?.trim()||null,device_year:null,software_name:c.software_name.trim(),software_version:c.software_version.trim(),settings:{contract:'digitization/1',method:c.method,capture_plan_revision_id:job.capture_plan_revision_id,capture_profile:structuredClone(profile),preparation:structuredClone(job.specification.confirmation),actual_settings:c.actual_settings.trim(),deviations,deviation_reason:c.deviation_reason?.trim()||null,missing_positions:missing,previous_capture_revision_id:previous?rev(previous.id):null,recapture_reason:previous?c.recapture_reason.trim():null,recorded_by:actor,workflow_run_id:workflow.id},technical_incidents:c.technical_incidents?.trim()||null},a);
 const version=Math.max(0,...t.representation.filter(x=>x.asset_id===asset.id&&x.role===c.role).map(x=>x.representation_version))+1,rep=await newEntity('representation',{asset_id:asset.id,role:c.role,representation_version:version,duration_ms:null,technical_metadata:{capture_event_id:cap.id}},a);
 for(const f of files.slice().sort((a,b)=>a.position-b.position)){
  const part=plan[f.position-1],original=await newEntity('file_object',{sha256:await rawHash(f.content),byte_size:fileBytes(f.content).length,mime_type:f.mime_type,pronom_id:null,original_filename:f.filename.trim(),received_at:s.clock,technical_metadata:{ingest:'digitization/1',header_checked:true,browser_recording:c.method==='browser'&&f.recording_metadata?structuredClone(f.recording_metadata):null}},a);s.demo.file_contents[original.id]=structuredClone(f.content);
  t.file_ingest_occurrence.push({file_id:original.id,workflow_run_id:workflow.id,received_filename:original.original_filename,source_path:f.source_path?.trim()||null,received_at:s.clock,capture_event_id:cap.id});
  const ordinal=plan.slice(0,f.position).filter(x=>x.plan_position===part.plan_position).length;
  t.capture_output.push({capture_event_id:cap.id,file_id:original.id,plan_item_id:null,plan_revision_id:job.capture_plan_revision_id,plan_position:part.plan_position,expected_ordinal:ordinal,position:f.position,notes:part.label});
  t.representation_file.push({representation_id:rep.id,file_id:original.id,position:f.position,component_label:part.label,component_role:profile.kind==='image'?'page':'content',timeline_offset_ms:null});
  await copy(original,t.digital_storage_location[0].id);
 }
 await revise(cap,'Збережено отримані файли й порядок');await revise(rep,'Отриманий результат очікує контролю якості');await manifest(cap,t.capture_output.filter(x=>x.capture_event_id===cap.id));
 if(deviations.length||cap.technical_incidents)await task('Перевірити фіксацію: '+[...deviations,c.deviation_reason,cap.technical_incidents].filter(Boolean).join('; '),rep.id,workflow.id);
 workflow.state='completed';workflow.finished_at=s.clock;workflow.notes='Отриманий результат передано на контроль якості';await revise(w,'Збережено новий результат оцифрування');return {id:cap.id,asset_id:asset.id,representation_id:rep.id};
}
export function validateDigitization(s,ok){
 const t=s.tables,by=(k,id)=>t[k].find(x=>x.id===id);
 for(const cap of t.capture_event.filter(x=>x.settings?.contract==='digitization/1')){
  const plan=plannedOutputs(s,cap.settings.capture_plan_revision_id),outputs=t.capture_output.filter(x=>x.capture_event_id===cap.id),rep=t.representation.find(x=>x.technical_metadata?.capture_event_id===cap.id);
  ok(!!rep&&outputs.length>0,'Відсутній отриманий результат');
  ok(t.entity_revision.filter(x=>x.entity_id===cap.id).at(-1).snapshot._relations.capture_output.length===outputs.length,'Склад фіксації');
  for(const x of outputs){const part=plan[x.position-1];ok(!!part&&x.plan_revision_id===cap.settings.capture_plan_revision_id&&x.plan_position===part.plan_position&&x.expected_ordinal===plan.slice(0,x.position).filter(p=>p.plan_position===part.plan_position).length&&x.notes===part.label,'Зв’язок файла з частиною плану');ok(!captureFileProblem({...by('file_object',x.file_id),content:s.demo.file_contents[x.file_id]},cap.settings.capture_profile.kind),'Отриманий медіафайл');}
  if(cap.settings.previous_capture_revision_id){const previous=by('entity_revision',cap.settings.previous_capture_revision_id);ok(previous?.snapshot.digitization_job_id===cap.digitization_job_id,'Повтор іншої роботи');}
 }
}
