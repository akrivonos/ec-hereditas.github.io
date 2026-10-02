import {owns,sourceView,corpusItems} from './research.mjs?v=20261002-wf19';
import {corpusTarget,corpusAnchor} from './corpus.mjs?v=20261002-wf19';
import {assertionEvidence,evidenceView,analysisTerms} from './analysis.mjs?v=20261002-wf19';
import {annotationView} from './reader.mjs?v=20261002-wf19';
import {accessPolicy,projectFields} from './rights.mjs?v=20261002-wf19';
import {rawHash,manifestPayload} from './media.mjs?v=20261002-wf19';
import {fileBytes} from './binary.mjs?v=20261002-wf19';
export const reference=(id,rid)=>'urn:hereditas:'+id+'#'+rid;
export function deliveredSource(state,a,id,rid){
 const s={...state,clock:new Date().toISOString()},src=sourceView(s,a,id,rid,'cite');if(!src||!sourceView(s,a,id,rid,'download'))return null;
 const ds=accessPolicy(s,id,rid,'research','view');if(!ds)return null;
 return {...src,reference:reference(id,rid),conditions:projectFields(s,ds,{terms:ds.map(x=>x.conditions||'').join('; ')}).terms||null};
}
export function assertionResult(s,a,id,rid,download=false){
 const r=s.tables.entity_revision.find(x=>x.id===rid&&x.entity_id===id),x=r?.snapshot;if(!x||!owns(s,a,id)||s.tables.entity.find(e=>e.id===id)?.entity_type!=='assertion'||x.scope!=='research')return null;
 const src=download?deliveredSource(s,a,x.subject_entity_id,x.subject_revision_id):sourceView({...s,clock:new Date().toISOString()},a,x.subject_entity_id,x.subject_revision_id);if(!src)return null;
 const ev=assertionEvidence(s,x,rid),evidence=[];
 for(const e of ev){const source=download?deliveredSource(s,a,e.source_entity_id,e.source_revision_id):evidenceView(s,a,e);if(!source||!evidenceView(s,a,e))return null;
  const n=e.annotation_revision_id&&s.tables.entity_revision.find(r=>r.id===e.annotation_revision_id)?.snapshot;
  evidence.push({id:e.id,role:e.role,source,locator:e.locator,quote:e.quote_text,note:e.note,...(e.target_entity_id?{target_entity_id:e.target_entity_id,target_revision_id:e.target_revision_id,layer_entity_id:e.layer_entity_id||null,layer_revision_id:e.layer_revision_id||null}:{}),...(n?{annotation_revision_id:e.annotation_revision_id,annotation:{body:n.body,quote:annotationView(s,a,n)?.quote||''}}:{})});
 }
 const note=x.annotation_revision_id&&s.tables.entity_revision.find(r=>r.id===x.annotation_revision_id)?.snapshot;if(note&&!annotationView(s,a,note))return null;
 const terms=analysisTerms(s,a,evidence.map(e=>e.source));if((x.analytical_terms||[]).some(id=>!terms.some(t=>t.id===id)))return null;
 const rel=(s.tables.semantic_relation||[]).find(r=>r.assertion_id===id),other=x.object_revision_id&&(download?deliveredSource(s,a,rel?.object_entity_id,x.object_revision_id):sourceView(s,a,rel?.object_entity_id,x.object_revision_id));if(x.object_revision_id&&!other)return null;
 return {id,revision_id:rid,reference:reference(id,rid),source:src,statement:x.statement_text,status:x.research_status||'open',analysis_note:x.analysis_note||null,terms:terms.filter(t=>(x.analytical_terms||[]).includes(t.id)),analytical_relation:x.analytical_relation||null,annotation:note?{revision_id:x.annotation_revision_id,body:note.body,quote:annotationView(s,a,note).quote}:null,relation:rel?{predicate:s.tables.vocabulary_term.find(t=>t.id===rel.relation_type_term_id)?.code,object:other}:null,evidence};
}
export function datasetProjection(s,a,selection){
 try{
  let corpus=null,items=[];const selected=selection.positions||[],files=new Map(),results=[];
  if(selection.corpus_id){if(!owns(s,a,selection.corpus_id))return null;const r=s.tables.entity_revision.find(x=>x.id===selection.corpus_revision_id&&x.entity_id===selection.corpus_id);if(!r)return null;corpus={id:r.entity_id,revision_id:r.id,title:r.snapshot.title,question:r.snapshot.research_question,criteria:r.snapshot.inclusion_criteria,reference:reference(r.entity_id,r.id)};
   if(new Set(selected).size!==selected.length)return null;
   for(const pos of selected){const item=corpusItems(s,r.id).find(x=>x.position===pos),v=item&&corpusTarget(s,a,item),src=v&&deliveredSource(s,a,v.source.id,v.source.revision_id);if(!v||!src)return null;
    // A segment grants its interval, never the bytes outside it. Export full files only for a selected representation.
    const full=selection.include_files&&v.type==='representation';if(full&&!v.files.length)return null;
    const fileRefs=[];if(full)for(const f of v.files){const file=s.tables.file_object.find(x=>x.id===f.id),bytes=s.demo.file_contents[f.id];if(bytes==null)return null;files.set(f.id,{id:f.id,name:f.filename,mime:f.mime,sha256:file.sha256,byte_size:file.byte_size,content:structuredClone(bytes)});fileRefs.push({id:f.id,offset_ms:f.offset_ms});}
    items.push({position:pos,target_entity_id:v.id,target_revision_id:v.revision_id,reference:reference(v.id,v.revision_id),type:v.type,source:src,text:v.text,segments:v.segments,group:item.group_label,selection_reason:item.selection_reason,files:fileRefs});
   }
  }else if(selected.length)return null;
  const refs=selection.results||[];if(new Set(refs.map(x=>x.revision_id)).size!==refs.length)return null;
  for(const ref of refs){const e=s.tables.entity.find(x=>x.id===ref.id),r=s.tables.entity_revision.find(x=>x.id===ref.revision_id&&x.entity_id===ref.id);if(!e||!r||!owns(s,a,e.id))return null;
   if(e.entity_type==='assertion'){const result=assertionResult(s,a,e.id,r.id,true);if(!result)return null;results.push({kind:'assertion',...result});}
   else if(e.entity_type==='annotation'){const n=r.snapshot,v=annotationView(s,a,n),anchor=corpusAnchor(n),src=deliveredSource(s,a,anchor.id,anchor.revision_id);if(!v||!src)return null;results.push({kind:'annotation',id:e.id,revision_id:r.id,reference:reference(e.id,r.id),source:src,target_entity_id:n.target_entity_id,target_revision_id:n.target_revision_id,range_start:n.range_start,range_end:n.range_end,body:n.body,quote:v.quote,tags:v.tags,note_type:n.note_type});}else return null;
  }
  if(!items.length&&!results.length)return null;
  return {profile:'research-dataset/1',corpus,items,results,files:[...files.values()]};
 }catch{return null;}
}
export function datasetDownload(s,a,row){
 if(row.owner_account_id!==a||!owns(s,a,row.file_id))return null;const projection=datasetProjection(s,a,row.selection),f=s.tables.file_object.find(x=>x.id===row.file_id);if(!projection||!f)return null;
 const content=JSON.stringify({...projection,generated_at:row.generated_at},null,2);if(content!==s.demo.file_contents[f.id])return null;
 return {filename:f.original_filename,mime:f.mime_type,content};
}
export function materialCitationView(s,a,x){
 const v=corpusTarget(s,a,x),src=v&&sourceView({...s,clock:new Date().toISOString()},a,v.source.id,v.source.revision_id,'cite');return v&&src&&v.title===x.structured_data.title&&src.attribution===(x.structured_data.attribution||'')?v:null;
}
export async function deliveryCommand(s,a,c,{fail,append,text,own,hash}){
 const t=s.tables,rev=id=>t.entity.find(x=>x.id===id)?.current_revision_id;
 if(c.type==='research.citations'){if(!Array.isArray(c.items)||!c.items.length)fail('invalid','Оберіть матеріали для цитування.');const rows=[];for(const item of c.items)rows.push(await deliveryCommand(s,a,{type:'research.citation.material',...item},{fail,append,text,own,hash}));return rows;}
 if(c.type==='research.dataset'){
  const selection=structuredClone(c.selection),projection=datasetProjection(s,a,selection);if(!projection)fail('forbidden','Оберіть доступні матеріали й результати з дозволом на цитування та завантаження.');
  for(const file of projection.files)if(await rawHash(file.content)!==file.sha256||fileBytes(file.content).length!==file.byte_size)fail('invalid','Контрольна сума або розмір файла не збігаються.');
  const content=JSON.stringify({...projection,generated_at:s.clock},null,2);if(fileBytes(content).length>8*1024*1024)fail('invalid','Пакет перевищує 8 МіБ. Зменште добір або вимкніть файли.');
  const file=await append('file_object',{sha256:await rawHash(content),byte_size:fileBytes(content).length,mime_type:'application/json',pronom_id:null,original_filename:'research-dataset.json',received_at:s.clock,technical_metadata:{profile:'research-dataset/1'}});s.demo.file_contents[file.id]=content;
  const run={id:crypto.randomUUID(),workflow_code:'WF-19',primary_entity_id:file.id,started_by:a,started_at:s.clock,finished_at:s.clock,state:'completed',notes:'Підготовлено дослідницький експорт'};t.workflow_run.push(run);
  const row={id:crypto.randomUUID(),profile:'research-dataset/1',owner_account_id:a,from_workflow_run_id:run.id,to_workflow_run_id:null,manifest_file_id:file.id,manifest_checksum:'',state:'prepared',accepted_by:null,accepted_at:null,notes:null,context_entity_id:selection.corpus_id||null,context_revision_id:selection.corpus_revision_id||null,format:'dataset_json',file_id:file.id,generated_at:s.clock,selection,title:text(c.title)};t.handover.push(row);
  const refs=[...projection.items.map(i=>({id:i.target_entity_id,rid:i.target_revision_id})),...projection.results.map(i=>({id:i.id,rid:i.revision_id})),...projection.files.map(f=>({id:f.id,rid:rev(f.id)}))],unique=[...new Map(refs.map(x=>[x.rid,x])).values()];
  unique.forEach((x,i)=>t.handover_item.push({handover_id:row.id,entity_id:x.id,revision_id:x.rid,position:i+1,item_checksum:t.file_object.find(f=>f.id===x.id)?.sha256||t.entity_revision.find(r=>r.id===x.rid).snapshot_hash,item_state:'present'}));row.manifest_checksum=await hash(manifestPayload(t.handover_item.filter(x=>x.handover_id===row.id)));return row;
 }
 if(c.type==='research.citation.material'){
  const v=corpusTarget(s,a,c),src=v&&sourceView(s,a,v.source.id,v.source.revision_id,'cite');if(!v||!src)fail('forbidden','Цитування матеріалу недоступне.');
  const existing=t.citation.find(x=>owns(s,a,x.id)&&x.style_code==='research-material/1'&&x.target_revision_id===v.revision_id&&x.source_revision_id===src.revision_id&&materialCitationView(s,a,x));if(existing)return existing;
  let identifier=t.identifier.find(x=>x.entity_id===v.id&&x.scheme==='urn'&&x.namespace==='hereditas');if(!identifier){identifier={id:crypto.randomUUID(),entity_id:v.id,scheme:'urn',namespace:'hereditas',value:'urn:hereditas:'+v.id,is_primary:false,source_evidence_id:null};t.identifier.push(identifier);}
  return append('citation',{target_entity_id:v.id,target_revision_id:v.revision_id,source_entity_id:src.id,source_revision_id:src.revision_id,layer_entity_id:c.layer_entity_id||null,layer_revision_id:c.layer_revision_id||null,stable_identifier_id:identifier.id,style_code:'research-material/1',language_tag:'uk',rendered_text:[v.title,src.attribution,'Версія '+v.revision_no,reference(v.id,v.revision_id)].filter(Boolean).join('. ')+'.',structured_data:{id:reference(v.id,v.revision_id),type:'manuscript',title:v.title,attribution:src.attribution,note:v.label+'; версія '+v.revision_no},generated_at:s.clock});
 }
 fail('invalid','Невідома дія експорту.');
}

