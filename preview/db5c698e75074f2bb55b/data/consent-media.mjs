import {fileBytes,MAX_MEDIA_BYTES,mediaMime} from './binary.mjs?v=20261002-programmes';
import {rawHash} from './media.mjs?v=20261002-programmes';
export function consentMedia(s,id){
 const t=s.tables,reg=t.entity.find(x=>x.id===id),row=reg&&t[reg.entity_type]?.find(x=>x.id===id);if(!row)return false;
 if(reg.entity_type==='file_object')return !!row.technical_metadata?.consent_evidence||t.evidence.some(ev=>t.evidence_link.some(l=>l.evidence_id===ev.id&&l.evidence_role==='consent')&&(()=>{if(ev.source_entity_id===id)return true;const src=t.entity_revision.find(r=>r.id===ev.source_revision_id)?.snapshot;if(!src?.representation_revision_id)return false;const rep=t.entity_revision.find(r=>r.id===src.representation_revision_id)?.snapshot;return rep?._relations?.representation_file?.some(f=>f.file_id===id);})());
 if(reg.entity_type==='representation')return t.representation_file.some(x=>x.representation_id===id&&consentMedia(s,x.file_id));
 if(reg.entity_type==='media_asset')return t.representation.some(x=>x.asset_id===id&&consentMedia(s,x.id));
 if(reg.entity_type==='media_segment'||reg.entity_type==='timed_layer')return consentMedia(s,row.representation_id);
 return false;
}
export async function attachConsentMedia(s,c,session,archive,{add,revise,need,fail}){
 const t=s.tables,by=(k,id)=>t[k]?.find(x=>x.id===id),revision=id=>by('entity',id)?.current_revision_id,method=c.evidence_method||'recorded_note';
 if(!['recorded_note','document','digital_signature','audio','video'].includes(method))fail('invalid','Оберіть спосіб підтвердження.');
 if(method==='recorded_note')return {};
 if(c.confirm!==true)fail('invalid','Перевірте доказ і підтвердьте його відповідність згоді.');
 if(c.recorded_evidence&&c.recording_agreed!==true)fail('invalid','Підтвердьте домовленість про запис доказу.');
 if(method==='digital_signature'&&c.signature_confirmed!==true)fail('invalid','Підпис має бути поставлений у формі згоди.');
 let rep,file;
 if(c.evidence_file){
  const f=c.evidence_file,bytes=fileBytes(f.content);if(!bytes.length||bytes.length>MAX_MEDIA_BYTES||f.content?.encoding!=='base64')fail('invalid','Файл доказу має бути непорожнім і не більшим за 2 МіБ.');
  if(!f.filename?.trim()||!(['document','digital_signature'].includes(method)?['application/pdf','image/png','image/jpeg','image/webp'].includes(f.mime_type):mediaMime(f.mime_type)&&f.mime_type?.startsWith(method+'/')))fail('invalid','Формат файла не відповідає способу підтвердження.');
  file=await add('file_object',{sha256:await rawHash(f.content),byte_size:bytes.length,mime_type:f.mime_type,pronom_id:null,original_filename:f.filename,received_at:s.clock,technical_metadata:{consent_evidence:true,session_id:session}},archive);s.demo.file_contents[file.id]=structuredClone(f.content);
  if(['document','digital_signature'].includes(method))return {source_entity_id:file.id,source_revision_id:revision(file.id),evidence_method:method};
  if(!session)fail('invalid','Для медіадоказу потрібен сеанс.');
  if(!Number.isInteger(f.duration_ms)||f.duration_ms<=0)fail('invalid','Вкажіть тривалість доказу.');
  const asset=await add('media_asset',{title:'Доказ згоди: '+f.filename,media_kind:method,description:c.evidence_note},archive);t.media_asset_subject.push({asset_id:asset.id,subject_entity_id:session,relation_role:'consent',evidence_id:null});await revise(asset,'Додано приватний доказ');
  rep=await add('representation',{asset_id:asset.id,role:'received_original',representation_version:1,duration_ms:f.duration_ms,technical_metadata:{consent_evidence:true}},archive);t.representation_file.push({representation_id:rep.id,file_id:file.id,position:1,component_role:'primary',component_label:f.filename,timeline_offset_ms:0});await revise(rep,'Додано файл доказу');
 }else{
  rep=by('representation',c.evidence_representation_id);if(['document','digital_signature'].includes(method)||!rep||!session||!t.media_asset_subject.some(x=>x.asset_id===rep.asset_id&&x.subject_entity_id===session)||by('media_asset',rep.asset_id)?.media_kind!==method||by('entity',rep.id).archive_id!==archive)fail('invalid','Оберіть медіа цього сеансу.');need('domain.read',archive);if(consentMedia(s,rep.id))need('consent.read',archive);
  if(revision(rep.id)!==c.evidence_representation_revision_id)fail('stale','Медіазапис змінився.');
 }
 const start=Number(c.evidence_start_ms??0),end=Number(c.evidence_end_ms??rep.duration_ms);
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||!rep.duration_ms||end>rep.duration_ms)fail('invalid','Перевірте початок і кінець фрагмента.');
 const files=t.representation_file.filter(x=>x.representation_id===rep.id);if(!files.length)fail('invalid','Файл доказу відсутній.');
 for(const link of files){const f=by('file_object',link.file_id);if(!s.demo.file_contents[f.id]||await rawHash(s.demo.file_contents[f.id])!==f.sha256)fail('invalid','Файл доказу недоступний або змінився.');}
 const affected=new Set([rep.id,rep.asset_id,...files.map(f=>f.file_id),...t.media_segment.filter(x=>x.representation_id===rep.id).map(x=>x.id),...(t.timed_layer||[]).filter(x=>x.representation_id===rep.id).map(x=>x.id)]),sources=new Set();
 for(const d of t.access_decision.filter(d=>d.state==='effective'&&t.access_decision_resource.some(r=>r.decision_id===d.id&&affected.has(r.resource_entity_id)))){d.state='needs_review';sources.add(d.target_entity_id);await revise(d,'Матеріал містить приватний доказ згоди');}
 for(const p of t.publication_record.filter(p=>p.state==='published'&&sources.has(p.source_entity_id))){p.state='unpublished';p.unpublished_at=s.clock;await revise(p,'Перевірте приватний фрагмент перед показом');}
 const segment=await add('media_segment',{representation_id:rep.id,representation_revision_id:revision(rep.id),start_ms:start,end_ms:end,channel:null},archive);
 return {source_entity_id:segment.id,source_revision_id:revision(segment.id),evidence_method:method};
}
