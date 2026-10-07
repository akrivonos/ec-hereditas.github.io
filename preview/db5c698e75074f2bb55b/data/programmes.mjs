import {fileBytes,MAX_MEDIA_BYTES} from './binary.mjs?v=20261007-notes1';
import {rawHash} from './media.mjs?v=20261007-notes1';
export const programmeRefs=row=>row?.programme_revision_ids??(row?.programme_revision_id?[row.programme_revision_id]:[]);
export const programmeVersions=(s,row)=>programmeRefs(row).map(id=>s.tables.entity_revision.find(v=>v.id===id)).filter(Boolean);
export function programmePdf(s,doc){const rep=s.tables.entity_revision.find(v=>v.id===doc.programme_pdf_revision_id);return rep&&s.tables.file_object.find(f=>rep.snapshot._relations?.representation_file?.some(x=>x.file_id===f.id));}
export function validateProgrammes(s,ok){
 const t=s.tables,entity=id=>t.entity.find(e=>e.id===id);
 for(const row of [...t.field_research,...t.collecting_session]){const refs=programmeRefs(row);ok(Array.isArray(refs)&&new Set(refs).size===refs.length,'Некоректний перелік питальників');ok(!row.programme_revision_ids||row.programme_revision_id===(refs[0]||null),'Основна програма не відповідає переліку');const docs=new Set();for(const rid of refs){const v=t.entity_revision.find(v=>v.id===rid);ok(v?.snapshot.kind==='research_programme'&&entity(v.entity_id)?.archive_id===entity(row.id)?.archive_id,'Програма іншого архіву');ok(!docs.has(v.entity_id),'Документ повторюється у програмі');docs.add(v.entity_id);if(v.snapshot.programme_research_id)ok(v.snapshot.programme_research_id===(row.research_id||row.id),'Питальник іншого дослідження');}}
 for(const v of t.entity_revision.filter(v=>v.snapshot.kind==='research_programme'&&v.snapshot.programme_pdf_revision_id)){const rep=t.entity_revision.find(x=>x.id===v.snapshot.programme_pdf_revision_id),f=programmePdf(s,v.snapshot);ok(entity(rep?.entity_id)?.entity_type==='representation'&&rep.snapshot.asset_id===v.snapshot.media_asset_id&&entity(rep.entity_id)?.archive_id===entity(v.entity_id)?.archive_id&&f?.mime_type==='application/pdf','Некоректний PDF програми');}
}
export async function programmeCommand(s,c,h){
 const {lookup,fresh,required,newEntity,revise,fail,reg,arch}=h,t=s.tables,r=lookup(c.id);if(reg(r.id).entity_type!=='field_research')fail('invalid','Оберіть дослідження.');fresh(r.id,c.expected_revision_id);
 const refs=[...programmeRefs(r)],index=c.document_id?refs.findIndex(id=>t.entity_revision.find(v=>v.id===id)?.entity_id===c.document_id):-1;let doc=c.document_id&&t.document.find(d=>d.id===c.document_id);
 if(c.document_id){if(index<0||!doc)fail('invalid','Питальник не належить цьому дослідженню.');lookup(doc.id);fresh(doc.id,c.document_revision_id);}
 if(c.remove){if(!doc)fail('invalid','Оберіть питальник.');refs.splice(index,1);}
 else if(c.direction!==undefined){const next=index+c.direction;if(!doc||![-1,1].includes(c.direction)||next<0||next>=refs.length)fail('invalid','Переміщення недоступне.');[refs[index],refs[next]]=[refs[next],refs[index]];}
 else{
  if(!['general','thematic'].includes(c.programme_kind))fail('invalid','Оберіть тип програми.');const title=required(c.title),text=c.body_text?.trim()||'';let pdf=null;
  if(c.pdf){const bytes=fileBytes(c.pdf.content);if(c.pdf.mime_type!=='application/pdf'||!c.pdf.filename?.trim()||!bytes.length||bytes.length>MAX_MEDIA_BYTES||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')fail('invalid','Оберіть PDF до 2 МіБ.');pdf=c.pdf;}
  if(!text&&!pdf&&(!doc?.programme_pdf_revision_id||c.remove_pdf))fail('invalid','Додайте текст або PDF питальника.');
  if(!doc)doc=await newEntity('document',{kind:'research_programme',title,body_text:text,programme_kind:c.programme_kind,programme_research_id:r.id,language_tag:'uk',media_asset_id:null,physical_object_id:null},arch(r.id));
  Object.assign(doc,{title,body_text:text,programme_kind:c.programme_kind,programme_research_id:r.id});
  if(c.remove_pdf){doc.programme_pdf_revision_id=null;doc.media_asset_id=null;}
  if(pdf){const f=await newEntity('file_object',{sha256:await rawHash(pdf.content),byte_size:fileBytes(pdf.content).length,mime_type:'application/pdf',pronom_id:null,original_filename:pdf.filename,received_at:s.clock,technical_metadata:{local_browser:true}},arch(r.id));s.demo.file_contents[f.id]=structuredClone(pdf.content);
   const asset=await newEntity('media_asset',{title,media_kind:'document',description:'PDF програми дослідження'},arch(r.id));t.media_asset_subject.push({asset_id:asset.id,subject_entity_id:doc.id,relation_role:'document',evidence_id:null});await revise(asset,'Пов’язано з питальником');
   const rep=await newEntity('representation',{asset_id:asset.id,role:'received_original',representation_version:1,duration_ms:null,technical_metadata:{}},arch(r.id));t.representation_file.push({representation_id:rep.id,file_id:f.id,position:1,component_label:f.original_filename,component_role:'primary',timeline_offset_ms:0});await revise(rep,'Додано PDF');doc.media_asset_id=asset.id;doc.programme_pdf_revision_id=reg(rep.id).current_revision_id;
  }
  if(!t.document_context.some(x=>x.document_id===doc.id&&x.target_entity_id===r.id&&x.context_role==='programme'))t.document_context.push({document_id:doc.id,target_entity_id:r.id,context_role:'programme',target_revision_id:null});
  await revise(doc,'Оновлено програму / питальник');if(index>=0)refs[index]=reg(doc.id).current_revision_id;else refs.push(reg(doc.id).current_revision_id);
 }
 r.programme_revision_ids=refs;r.programme_revision_id=refs[0]||null;await revise(r,'Оновлено перелік програм і питальників');return {id:doc.id};
}
