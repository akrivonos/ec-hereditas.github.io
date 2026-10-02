import {consentMedia} from './consent-media.mjs?v=20261002-annotations';
import {sourceView,sourceTypes} from './research.mjs?v=20261002-annotations';
import {discoverySource} from './discovery.mjs?v=20261002-annotations';
import {accessPolicy} from './rights.mjs?v=20261002-annotations';
import {can} from './model.mjs?v=20261002-annotations';
export const corpusTypes=['information_unit','document','physical_object','textual_representation','representation','timed_layer','media_segment'];
export const corpusKind={information_unit:'Джерело',document:'Документ',physical_object:'Носій',textual_representation:'Текст',representation:'Медіа',timed_layer:'Часовий шар',media_segment:'Фрагмент'};
export const corpusAnchor=x=>({id:x.source_entity_id||x.target_entity_id,revision_id:x.source_revision_id||x.target_revision_id});
export const corpusKey=x=>[x.source_entity_id||x.target_entity_id,x.source_revision_id||x.target_revision_id,x.target_entity_id,x.target_revision_id,x.layer_revision_id||''].join(':');
// Resolve immutable target snapshots under today's rights; never substitute current content.
export function corpusTarget(state,actor,item){
 const s={...state,clock:new Date().toISOString()},t=s.tables,by=(k,id)=>t[k]?.find(x=>x.id===id),reg=id=>by('entity',id),exact=(id,rid)=>{const r=by('entity_revision',rid);return r?.entity_id===id?r:null;};
 const anchor=corpusAnchor(item),src=sourceView(s,actor,anchor.id,anchor.revision_id),e=reg(item.target_entity_id),r=exact(item.target_entity_id,item.target_revision_id);
 if(consentMedia(s,item.target_entity_id)||!src||!r||!e||e.retired_at||!corpusTypes.includes(e.entity_type)||!(e.entity_type==='media_segment'&&e.owner_account_id===actor&&e.archive_id===null||can(s,actor,'domain.read',e.archive_id)))return null;
 const ds=accessPolicy(s,src.id,src.revision_id,'research','view');
 const readable=id=>reg(id)&&!reg(id).retired_at&&can(s,actor,'domain.read',reg(id).archive_id);
 const denied=id=>ds.some(d=>t.access_decision_resource.some(x=>x.decision_id===d.id&&x.resource_entity_id===id&&x.effect==='deny'));
 const allowed=(id,rid)=>readable(id)&&exact(id,rid)&&!denied(id)&&ds.every(d=>t.access_decision_resource.some(x=>x.decision_id===d.id&&x.resource_entity_id===id&&x.resource_revision_id===rid&&x.effect==='allow'));
 const x=r.snapshot,type=e.entity_type;let text='',files=[],segments=[],rep=null;
 if(sourceTypes.includes(type)){if(src.id!==e.id||src.revision_id!==r.id)return null;text=src.text;}
 else if(type==='media_segment'){
  if(item.layer_entity_id||item.layer_revision_id){
   const layer=exact(item.layer_entity_id,item.layer_revision_id);
   if(!layer||reg(layer.entity_id)?.entity_type!=='timed_layer'||!allowed(layer.entity_id,layer.id)||denied(e.id)||!(layer.snapshot._relations?.timed_layer_entry||[]).some(v=>v.segment_revision_id===r.id))return null;
   if(layer.snapshot.representation_id!==x.representation_id||layer.snapshot.representation_revision_id!==x.representation_revision_id)return null;
   const entry=layer.snapshot._relations.timed_layer_entry.find(v=>v.segment_revision_id===r.id);
   text=entry.text_value||by('text_part',entry.text_part_id)?.text||'';
  }else if(!allowed(e.id,r.id)&&!(e.owner_account_id===actor&&e.archive_id===null&&x.scope==='research'&&x.source_entity_id===src.id&&x.source_revision_id===src.revision_id&&!denied(e.id)))return null;
  segments=[{id:e.id,start_ms:x.start_ms,end_ms:x.end_ms,text}];rep=exact(x.representation_id,x.representation_revision_id);
 }else{
  if(!allowed(e.id,r.id))return null;
  if(type==='textual_representation')text=x.body_text||'';
  if(type==='representation')rep=r;
  if(type==='timed_layer'){
   rep=exact(x.representation_id,x.representation_revision_id);
   segments=(x._relations?.timed_layer_entry||[]).map(v=>{const sr=by('entity_revision',v.segment_revision_id);if(!sr||!readable(sr.entity_id)||denied(sr.entity_id))return null;return {id:sr.entity_id,start_ms:sr.snapshot.start_ms,end_ms:sr.snapshot.end_ms,text:v.text_value||by('text_part',v.text_part_id)?.text||''};}).filter(Boolean);
  }
 }
 if(['representation','timed_layer','media_segment'].includes(type)){
  if(!rep||!allowed(rep.entity_id,rep.id))return null;
  files=(rep.snapshot._relations?.representation_file||[]).slice().sort((a,b)=>a.position-b.position).filter(f=>readable(f.file_id)&&!denied(f.file_id)).map(f=>{const file=by('file_object',f.file_id);return {id:f.file_id,filename:file.original_filename,mime:file.mime_type,offset_ms:f.timeline_offset_ms??(f.position===1?0:null)};});
 }
 const label=type==='media_segment'?`Фрагмент ${x.start_ms/1000}–${x.end_ms/1000} с`:corpusKind[type]+(x.language_tag?' · '+x.language_tag:'');
 return {id:e.id,revision_id:r.id,revision_no:r.revision_no,type,label,title:sourceTypes.includes(type)?src.title:label+' — '+src.title,source:src,text,files,segments,newer:e.current_revision_id!==r.id};
}
export function corpusCandidates(s,a,sources){
 const result=[];for(const src of sources){
  const anchor={source_entity_id:src.id,source_revision_id:src.revision_id},add=(id,rid,more={})=>{const item={...anchor,target_entity_id:id,target_revision_id:rid,...more};if(corpusTarget(s,a,item))result.push(item);};
  add(src.id,src.revision_id);
  for(const r of discoverySource(s,a,src.id,src.revision_id)?.resources||[]){add(r.id,r.revision_id);if(r.type==='segments')for(const seg of r.segments)add(seg.id,seg.revision_id,{layer_entity_id:r.id,layer_revision_id:r.revision_id});}
  for(const seg of s.tables.media_segment||[])if(!result.some(x=>x.source_entity_id===src.id&&x.target_entity_id===seg.id))add(seg.id,s.tables.entity.find(x=>x.id===seg.id).current_revision_id);
 }return result;
}
