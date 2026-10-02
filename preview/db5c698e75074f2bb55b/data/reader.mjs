import {corpusTarget,corpusKey,corpusAnchor} from './corpus.mjs?v=20261002-wf18';
import {discoverySource,termLabel} from './discovery.mjs?v=20261002-wf18';
import {accessPolicy} from './rights.mjs?v=20261002-wf18';
import {can} from './model.mjs?v=20261002-wf18';
export const noteTypes={note:'Нотатка',doubt:'Сумнів',alternative:'Альтернативне тлумачення'};
export function readerResources(state,actor,source){
 const s={...state,clock:new Date().toISOString()},t=s.tables,ds=accessPolicy(s,source.id,source.revision_id,'research','view');if(!ds)return [];
 const pool=new Map(),anchor={source_entity_id:source.id,source_revision_id:source.revision_id};
 const add=item=>{const view=corpusTarget(s,actor,item);if(view)pool.set(corpusKey(item),{item,view});};
 for(const d of ds)for(const r of t.access_decision_resource.filter(x=>x.decision_id===d.id&&x.effect==='allow')){
  const item={...anchor,target_entity_id:r.resource_entity_id,target_revision_id:r.resource_revision_id};add(item);
  const revision=t.entity_revision.find(x=>x.id===r.resource_revision_id);
  if(t.entity.find(x=>x.id===r.resource_entity_id)?.entity_type==='timed_layer')for(const entry of revision?.snapshot._relations?.timed_layer_entry||[]){const seg=t.entity_revision.find(x=>x.id===entry.segment_revision_id);if(seg)add({...anchor,target_entity_id:seg.entity_id,target_revision_id:seg.id,layer_entity_id:r.resource_entity_id,layer_revision_id:r.resource_revision_id});}
 }for(const seg of t.media_segment.filter(x=>x.scope==='research'&&x.source_entity_id===source.id&&x.source_revision_id===source.revision_id))add({...anchor,target_entity_id:seg.id,target_revision_id:t.entity.find(e=>e.id===seg.id)?.current_revision_id});return [...pool.values()];
}
export function readerTags(s,actor,source){
 const v=discoverySource(s,actor,source.id,source.revision_id);if(!v)return [];
 const tags=[...v.people.map(x=>({...x,kind:'person'})),...v.places.map(x=>({...x,kind:'place'}))];
 if(v.contextAllowed)for(const term of s.tables.vocabulary_term.filter(x=>x.status==='active')){const scheme=s.tables.vocabulary_scheme.find(x=>x.id===term.scheme_id);if(!scheme||scheme.status!=='active'||!['D03','D08','D09'].includes(scheme.d_code)||scheme.owner_archive_id&&!can(s,actor,'domain.read',scheme.owner_archive_id))continue;tags.push({id:term.id,label:termLabel(s,term.id),kind:scheme.d_code==='D08'?'motif':'concept'});}
 return tags;
}
export function annotationView(s,actor,row){
 const v=corpusTarget(s,actor,row);if(!v||['media_segment','representation'].includes(v.type)&&!v.files.length)return null;
 const choices=readerTags(s,actor,v.source),tags=(row.tags||[]).map(tag=>choices.find(x=>x.id===tag.id&&x.kind===tag.kind));if(tags.some(x=>!x))return null;
 const quote=row.range_start==null?'':v.text.slice(row.range_start,row.range_end);
 return {target:v,tags,quote,anchor:corpusAnchor(row)};
}
export function validateAnnotation(s,x,ok){
 const t=s.tables,reg=id=>t.entity.find(x=>x.id===id),r=t.entity_revision.find(r=>r.id===x.target_revision_id),anchor=corpusAnchor(x),sr=t.entity_revision.find(r=>r.id===anchor.revision_id);
 ok(r?.entity_id===x.target_entity_id&&sr?.entity_id===anchor.id,'Точна версія анотації');ok(['research','segment'].includes(x.kind)&&!!x.body?.trim(),'Дослідницька анотація');
 ok(!x.note_type||Object.hasOwn(noteTypes,x.note_type),'Вид нотатки');if(x.kind==='segment')ok(reg(x.target_entity_id)?.entity_type==='media_segment','Анотація сегмента');
 if(x.range_start!=null||x.range_end!=null)ok(reg(x.target_entity_id)?.entity_type==='textual_representation'&&Number.isInteger(x.range_start)&&Number.isInteger(x.range_end)&&x.range_start>=0&&x.range_end>x.range_start&&x.range_end<=r.snapshot.body_text.length,'Діапазон у точній версії тексту');
 if(x.text_part_id)ok(t.text_part.some(p=>p.id===x.text_part_id&&p.text_revision_id===x.target_revision_id),'Частина іншої версії тексту');
 if(x.layer_entity_id)ok(t.entity_revision.some(r=>r.entity_id===x.layer_entity_id&&r.id===x.layer_revision_id&&r.snapshot._relations?.timed_layer_entry?.some(e=>e.segment_revision_id===x.target_revision_id)),'Фрагмент іншого шару');
 const seen=new Set();for(const tag of x.tags||[]){const key=tag.kind+':'+tag.id;ok(!seen.has(key)&&(['person','place'].includes(tag.kind)?reg(tag.id)?.entity_type===tag.kind:['concept','motif'].includes(tag.kind)&&t.vocabulary_term.some(x=>x.id===tag.id)),'Позначка анотації');seen.add(key);}
 if(x.corpus_revision_id)ok(t.entity_revision.some(r=>r.id===x.corpus_revision_id&&r.entity_id===x.corpus_id)&&t.corpus_item.some(i=>i.corpus_revision_id===x.corpus_revision_id&&corpusAnchor(i).id===anchor.id&&corpusAnchor(i).revision_id===anchor.revision_id),'Версія корпусу анотації');
}
