import {consentMedia} from './consent-media.mjs?v=20261002-feedback3';
import {accessPolicy,attributionNames} from './rights.mjs?v=20261002-feedback3';
// Public views use only an approved projection. Internal source rows never enter the public payload.
import {activeAccount} from './model.mjs?v=20261002-feedback3';
import {rawHash} from './media.mjs?v=20261002-feedback3';
import {consentBasisValid} from './workbench.mjs?v=20261002-feedback3';
export const publicTypes=['access_decision','publication_record','user_collection'];
const publicFields=['title','summary','kind','category','place','period','attribution','terms','context_ids','resource_label'];
export function publicAccessStamp(s){
 const ids=new Set((s.tables.publication_resource||[]).map(x=>x.resource_entity_id));
 for(const x of s.tables.publication_resource||[])for(const f of s.tables.entity_revision.find(r=>r.id===x.resource_revision_id)?.snapshot._relations?.representation_file||[])ids.add(f.file_id);
 return JSON.stringify([s.clock,...['publication_record','publication_basis','publication_resource','access_decision','access_decision_basis','access_decision_field','access_decision_resource','access_decision_use','access_decision_attribution','consent_record','consent_scope','evidence','evidence_link'].map(k=>s.tables[k]),s.tables.entity.filter(e=>['publication_record','access_decision','consent_record'].includes(e.entity_type)||ids.has(e.id))]);
}
export function publicRelations(t,type,id){
 const keys={access_decision:['access_decision_basis','access_decision_field','access_decision_resource','access_decision_use','access_decision_attribution'],publication_record:['publication_basis','publication_resource'],user_collection:['user_collection_item']};
 const fk={access_decision:'decision_id',publication_record:'publication_id',user_collection:'collection_id'};
 return Object.fromEntries((keys[type]||[]).map(table=>[table,structuredClone(t[table].filter(x=>x[fk[type]]===id))]));
}
function policy(s,p,use='view'){
 const t=s.tables,reg=id=>t.entity.find(x=>x.id===id),now=Date.parse(s.clock);
 if(!p||p.state!=='published'||p.channel_code!=='public'||p.projection_profile_version!=='public-reader-1'||reg(p.id)?.retired_at)return null;
 const bases=t.publication_basis.filter(x=>x.publication_id===p.id);if(!bases.length)return null;
 if(reg(p.source_entity_id)?.current_revision_id!==p.source_revision_id)return null;
 const decisions=accessPolicy(s,p.source_entity_id,p.source_revision_id,'public',use);
 if(!decisions||decisions.length!==bases.length||decisions.some(d=>!bases.some(b=>b.decision_id===d.id&&b.decision_revision_id===reg(d.id)?.current_revision_id)))return null;
 return decisions;
}
export function publicView(s,id,use='view',resolveContexts=true){
 const t=s.tables,p=t.publication_record?.find(x=>x.id===id||x.stable_slug===id),ds=policy(s,p,use);if(!ds)return null;
 const out={id:p.id,revision_id:t.entity.find(x=>x.id===p.id).current_revision_id,slug:p.stable_slug};
 for(const key of publicFields){
  const rules=ds.map(d=>t.access_decision_field.find(x=>x.decision_id===d.id&&x.field_path===key));
  if(rules.some(x=>!x||!['allow','mask'].includes(x.effect)))continue;
  const masks=rules.filter(x=>x.effect==='mask');if(masks.length){if(key!=='context_ids')out[key]=masks.every(x=>x.replacement_text===masks[0].replacement_text)?masks[0].replacement_text||'Не оприлюднено':'Не оприлюднено';continue;}
  if(key==='context_ids')out[key]=resolveContexts&&Array.isArray(p.safe_payload[key])?p.safe_payload[key].filter(id=>publicView(s,id,'view',false)):[];
  else if(typeof p.safe_payload[key]==='string')out[key]=p.safe_payload[key];
 }
 if(!out.title||!['material','archive','place','person','institution'].includes(out.kind))return null;
 const names=attributionNames(s,ds);if(names&&ds.every(d=>t.access_decision_field.some(f=>f.decision_id===d.id&&f.field_path==='attribution'&&f.effect==='allow')))out.attribution=names;
 if(out.kind==='person'){
  const at=t.access_decision_attribution.filter(x=>ds.some(d=>d.id===x.decision_id)&&x.person_id===p.source_entity_id);
  if(!at.length)return null;
  const names=at.map(x=>x.mode==='anonymous'?'Анонімна особа':x.display_name);
  out.title=names.every(x=>x&&x===names[0])?names[0]:'Анонімна особа';
 }
 return out;
}
export function publicSearch(s,{q='',category='',place='',kind='material'}={}){
 return (s.tables.publication_record||[]).map(x=>publicView(s,x.id)).filter(Boolean).filter(x=>(!kind||x.kind===kind)&&(!category||x.category===category)&&(!place||x.place===place)&&[x.title,x.summary,x.place,x.category].join(' ').toLocaleLowerCase('uk').includes(q.trim().toLocaleLowerCase('uk')));
}
export function publicResources(s,id,use='view'){
 const t=s.tables,p=t.publication_record.find(x=>x.id===id||x.stable_slug===id),ds=policy(s,p,use);if(!ds||!publicView(s,id,use))return [];
 // Standalone resource/file decisions require the broader rights evaluator. Do not override them with an inherited resource grant.
 const separatelyGoverned=(id,rid)=>t.access_decision.some(d=>d.target_entity_id===id&&(!d.target_revision_id||d.target_revision_id===rid)&&d.purpose_code==='public'&&['effective','needs_review','revoked'].includes(d.state));
 return t.publication_resource.filter(x=>x.publication_id===p.id&&x.purpose_code==='public'&&x.use_code==='view').filter(x=>ds.every(d=>{
  const rows=t.access_decision_resource.filter(r=>r.decision_id===d.id&&r.resource_entity_id===x.resource_entity_id&&r.resource_revision_id===x.resource_revision_id);return rows.length&&rows.every(r=>r.effect==='allow');
 })).flatMap(x=>{
  const r=t.entity_revision.find(r=>r.id===x.resource_revision_id&&r.entity_id===x.resource_entity_id),e=r&&t.entity.find(e=>e.id===r.entity_id);
  if(consentMedia(s,e?.id)||e?.entity_type!=='representation'||e.retired_at||separatelyGoverned(e.id,r.id))return [];
  return (r.snapshot._relations?.representation_file||[]).flatMap(part=>{
   const f=t.file_object.find(f=>f.id===part.file_id),fe=f&&t.entity.find(e=>e.id===f.id);
   // Public reader currently supports the real plain-text fixture; no raw filename or metadata.
   if(!f||fe?.retired_at||separatelyGoverned(f.id,fe?.current_revision_id)||f.mime_type!=='text/plain'||typeof s.demo.file_contents[f.id]!=='string')return [];
   return [{resource_id:e.id,revision_id:r.id,file_id:f.id,position:part.position,label:publicView(s,id).resource_label||'Текст джерела',content:s.demo.file_contents[f.id],mime:'text/plain',filename:'archival-page.txt'}];
  });
 }).sort((a,b)=>a.position-b.position);
}
export const publicDownload=(s,id,file)=>publicResources(s,id,'download').find(x=>x.file_id===file)||null;
export const collectionOwned=(s,a,id)=>!!activeAccount(s,a)&&s.tables.entity.some(e=>e.id===id&&e.entity_type==='user_collection'&&e.owner_account_id===a&&!e.retired_at)&&s.tables.user_collection.some(x=>x.id===id&&(!x.expires_at||Date.parse(x.expires_at)>Date.parse(s.clock)));
export function collectionView(s,a,id){
 if(!collectionOwned(s,a,id))return null;const t=s.tables,c=t.user_collection.find(x=>x.id===id);
 return {...c,revision_id:t.entity.find(x=>x.id===id).current_revision_id,items:t.user_collection_item.filter(x=>x.collection_id===id).sort((a,b)=>a.position-b.position).map(x=>{const p=publicView(s,x.publication_id);return p?{publication_id:p.id,position:x.position,note:x.note,publication:p}:{publication_id:x.publication_id,position:x.position,restricted:true};})};
}
export function publicCitationVisible(s,a,c){
 return !!activeAccount(s,a)&&s.tables.entity.some(e=>e.id===c.id&&e.owner_account_id===a)&&c.style_code==='public-versioned-1'&&publicView(s,c.target_entity_id,'cite')?.revision_id===c.target_revision_id;
}
export function publicExportDownload(s,a,id){
 const t=s.tables,x=t.bibliographic_export.find(x=>x.id===id&&x.export_profile_version==='public-1');if(!x||x.requested_by!==a||!activeAccount(s,a))return null;
 const refs=t.export_citation.filter(r=>r.export_id===id);if(!refs.length||refs.some(r=>{const c=t.entity_revision.find(v=>v.id===r.citation_revision_id)?.snapshot;return !c||!publicCitationVisible(s,a,c);}))return null;
 const f=t.file_object.find(f=>f.id===x.file_id);return {content:s.demo.file_contents[f.id],filename:f.original_filename,mime:f.mime_type};
}
export function validatePublic(s,require,fk,canonical){
 const t=s.tables;if(!t.publication_record)return;const by=(type,id)=>t[type].find(x=>x.id===id),reg=id=>by('entity',id),exact=(id,rid)=>require(by('entity_revision',rid)?.entity_id===id,'Чужа версія публікації');
 for(const x of t.access_decision){fk('entity',x.target_entity_id);if(x.target_revision_id)exact(x.target_entity_id,x.target_revision_id);fk('account',x.decided_by);require(['public','controlled_research','closed'].includes(x.access_level)&&['effective','needs_review','superseded','revoked'].includes(x.state),'Рішення доступу');require(Number.isFinite(Date.parse(x.valid_from))&&(!x.valid_until||Number.isFinite(Date.parse(x.valid_until)))&&(!x.embargo_until||Number.isFinite(Date.parse(x.embargo_until))),'Строк рішення');}
 for(const table of ['access_decision_basis','access_decision_field','access_decision_resource','access_decision_use','access_decision_attribution'])for(const x of t[table])fk('access_decision',x.decision_id);
 for(const x of t.access_decision_resource)exact(x.resource_entity_id,x.resource_revision_id);
 for(const x of t.access_decision_field)require(['allow','mask','deny'].includes(x.effect),'Правило публічного поля');
 for(const x of t.access_decision_use)require(['allow','deny'].includes(x.effect),'Правило використання');
 for(const x of t.access_decision_attribution){fk('person',x.person_id);require(['full_name','chosen_name','pseudonym','anonymous'].includes(x.mode),'Атрибуція');}
 for(const x of t.publication_record){exact(x.source_entity_id,x.source_revision_id);require(['published','unpublished'].includes(x.state)&&!!x.stable_slug,'Стан публікації');}
 require(new Set(t.publication_record.map(x=>x.channel_code+':'+x.stable_slug)).size===t.publication_record.length,'Повторений публічний шлях');
 for(const x of t.publication_basis){fk('publication_record',x.publication_id);fk('access_decision',x.decision_id);exact(x.decision_id,x.decision_revision_id);}
 for(const x of t.publication_resource){fk('publication_record',x.publication_id);exact(x.resource_entity_id,x.resource_revision_id);}
 for(const x of t.user_collection){fk('account',x.owner_account_id);require(reg(x.id).owner_account_id===x.owner_account_id&&reg(x.id).archive_id===null&&!!x.title.trim(),'Власник добірки');require(!x.expires_at||Number.isFinite(Date.parse(x.expires_at)),'Строк добірки');}
 const seen=new Set(),positions=new Set();for(const x of t.user_collection_item){fk('user_collection',x.collection_id);fk('publication_record',x.publication_id);const k=x.collection_id+':'+x.publication_id,pos=x.collection_id+':'+x.position;require(!seen.has(k)&&!positions.has(pos)&&Number.isInteger(x.position)&&x.position>0,'Порядок або повтор добірки');seen.add(k);positions.add(pos);}
 for(const type of ['access_decision_field','access_decision_use']){const field=type==='access_decision_field'?'field_path':'use_code';require(new Set(t[type].map(x=>x.decision_id+':'+x[field])).size===t[type].length,'Повторене правило');}
 for(const x of t.user_collection){const items=t.user_collection_item.filter(y=>y.collection_id===x.id).sort((a,b)=>a.position-b.position);require(items.every((y,i)=>y.position===i+1),'Порядок добірки має бути суцільним');}
}
export async function publicCommand(s,actor,c,{fail,hash,audit,snapshot,revise}){
 const t=s.tables,by=(type,id)=>t[type].find(x=>x.id===id),reg=id=>by('entity',id),rev=id=>reg(id)?.current_revision_id;
 const text=v=>{if(typeof v!=='string'||!v.trim())fail('invalid','Заповніть обов’язкове поле.');return v.trim();};
 const own=id=>{if(!collectionOwned(s,actor,id))fail('forbidden','Добірка недоступна.');return by('user_collection',id);};
 const fresh=id=>{if(c.expected_revision_id!==rev(id))fail('stale','Добірку змінено. Оновіть сторінку перед збереженням.');};
 const publication=(id,use='view')=>{const p=publicView(s,id,use);if(!p)fail('forbidden','Матеріал недоступний.');return p;};
 const create=async(type,values)=>{const id=crypto.randomUUID(),rid=crypto.randomUUID(),row={id,...values};t[type].push(row);t.entity.push({id,entity_type:type,owner_installation_id:s.demo.ids.installation,archive_id:null,owner_account_id:actor,current_revision_id:rid,retired_at:null});const snap=snapshot(t,type,row);t.entity_revision.push({id:rid,entity_id:id,revision_no:1,previous_revision_id:null,snapshot:snap,snapshot_hash:await hash(snap),recorded_at:s.clock,actor_account_id:actor,process_run_id:null,change_reason:'Створено приватний запис'});audit(c.type,id,null,rid);return row;};
 const add=(id,p,note='')=>{if(t.user_collection_item.some(x=>x.collection_id===id&&x.publication_id===p.id))fail('invalid','Матеріал уже є в цій добірці.');t.user_collection_item.push({collection_id:id,publication_id:p.id,position:t.user_collection_item.filter(x=>x.collection_id===id).length+1,note:note.trim()||null});};
 if(c.type==='public.collection.create'){
  const p=c.publication_id?publication(c.publication_id):null;const row=await create('user_collection',{owner_account_id:actor,title:text(c.title),expires_at:null});
  if(p){add(row.id,p,c.note||'');await revise(row,'Додано матеріал до добірки');}return row;
 }
 if(c.type.startsWith('public.collection.')){
  const row=own(c.id);fresh(row.id);
  if(c.type==='public.collection.rename')row.title=text(c.title);
  else if(c.type==='public.collection.delete'){reg(row.id).retired_at=s.clock;audit(c.type,row.id,rev(row.id),null,'Видалено приватну добірку');return row;}
  else if(c.type==='public.collection.add')add(row.id,publication(c.publication_id),c.note||'');
  else{
   const item=t.user_collection_item.find(x=>x.collection_id===row.id&&x.publication_id===c.publication_id);if(!item)fail('invalid','Матеріалу немає в добірці.');
   if(c.type==='public.collection.note'){publication(item.publication_id);item.note=c.note?.trim()||null;}
   else if(c.type==='public.collection.remove')t.user_collection_item=t.user_collection_item.filter(x=>x!==item);
   else if(c.type==='public.collection.move'){
    if(![-1,1].includes(c.direction))fail('invalid','Оберіть напрямок.');const other=t.user_collection_item.find(x=>x.collection_id===row.id&&x.position===item.position+c.direction);if(!other)fail('invalid','Матеріал уже на краю списку.');[other.position,item.position]=[item.position,other.position];
   }else fail('invalid','Невідома дія добірки.');
   t.user_collection_item.filter(x=>x.collection_id===row.id).sort((a,b)=>a.position-b.position).forEach((x,i)=>x.position=i+1);
  }
  await revise(row,'Оновлено добірку');return row;
 }
 const cite=async p=>{
  let identifier=t.identifier.find(x=>x.entity_id===p.id&&x.scheme==='urn'&&x.namespace==='public');if(!identifier){identifier={id:crypto.randomUUID(),entity_id:p.id,scheme:'urn',namespace:'public',value:'urn:hereditas:publication:'+p.id,is_primary:true,source_evidence_id:null};t.identifier.push(identifier);}
  const rendered=`${p.title}. ${p.attribution||''}. ${p.period||''}. ${identifier.value}.`;
  return create('citation',{target_entity_id:p.id,target_revision_id:p.revision_id,stable_identifier_id:identifier.id,style_code:'public-versioned-1',language_tag:'uk',rendered_text:rendered,structured_data:{id:identifier.value+'#'+p.revision_id,type:'manuscript',title:p.title,note:p.attribution||''},generated_at:s.clock});
 };
 if(c.type==='public.citation')return cite(publication(c.publication_id,'cite'));
 if(c.type==='public.export'){
  if(!['text','csl_json'].includes(c.format))fail('invalid','Оберіть формат.');let citations=[],context=null;
  if(c.collection_id){context=own(c.collection_id);fresh(context.id);const items=t.user_collection_item.filter(x=>x.collection_id===context.id).sort((a,b)=>a.position-b.position);if(!items.length)fail('invalid','Добірка порожня.');for(const item of items)citations.push(await cite(publication(item.publication_id,'cite')));}
  else{if(!Array.isArray(c.citation_ids)||!c.citation_ids.length||new Set(c.citation_ids).size!==c.citation_ids.length)fail('invalid','Оберіть цитування.');citations=c.citation_ids.map(id=>{const x=by('citation',id);if(!x||!publicCitationVisible(s,actor,x))fail('forbidden','Цитування недоступне.');return x;});}
  const content=c.format==='text'?citations.map(x=>x.rendered_text).join('\n\n'):JSON.stringify(citations.map(x=>x.structured_data),null,2);
  const file=await create('file_object',{sha256:await rawHash(content),byte_size:new TextEncoder().encode(content).length,mime_type:c.format==='text'?'text/plain':'application/json',pronom_id:null,original_filename:'collection-bibliography.'+(c.format==='text'?'txt':'json'),received_at:s.clock,technical_metadata:{}});s.demo.file_contents[file.id]=content;
  const result=await create('bibliographic_export',{requested_by:actor,context_entity_id:context?.id||null,context_revision_id:context?rev(context.id):null,format:c.format,file_id:file.id,generated_at:s.clock,export_profile_version:'public-1'});
  citations.forEach((x,i)=>t.export_citation.push({export_id:result.id,citation_revision_id:rev(x.id),position:i+1}));return result;
 }
 fail('invalid','Невідома дія.');
}
