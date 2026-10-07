// Museum editors own their workspace; visitors receive a freshly checked public projection.
import {can} from './model.mjs?v=20261007-places1';
import {publicView,publicResources,publicCommand} from './public.mjs?v=20261007-places1';
import {rawHash} from './media.mjs?v=20261007-places1';
import {qrcodegen} from '../vendor/qrcodegen.mjs?v=20261007-places1';
import {museumRequestCommand,validateMuseumRequests} from './museum-requests.mjs?v=20261007-places1';
export const museumTypes=['museum_exhibition','exhibit_set','access_point'];
export const museumReasons={same_ritual:'Спільний обряд',same_object_in_work:'Предмет згадано у творі',same_ethnographic_region:'Спільний етнографічний регіон',same_performer:'Спільний виконавець'};
export const museumEnabled=(s,a)=>s.tables.archive.some(x=>can(s,a,'museum.write',x.id));
export const museumOwned=(s,a,id)=>s.tables.entity.some(e=>e.id===id&&!e.retired_at&&e.owner_account_id===a&&can(s,a,'museum.write',e.archive_id));
const revision=(s,id)=>s.tables.entity.find(x=>x.id===id)?.current_revision_id;
export const setItems=(s,id)=>s.tables.exhibit_set_item.filter(x=>x.set_revision_id===revision(s,id)).sort((a,b)=>a.position-b.position);
export const setTexts=(s,id)=>s.tables.exhibit_set_text.filter(x=>x.set_revision_id===revision(s,id));
export function museumRelations(t,type,id){
 if(type==='exhibit_set'){const rid=t.entity.find(e=>e.id===id)?.current_revision_id;return Object.fromEntries(['exhibit_set_text','exhibit_set_item'].map(k=>[k,structuredClone(t[k].filter(x=>x.set_revision_id===rid))]));}
 if(type==='access_point')return {access_point_target:structuredClone(t.access_point_target.filter(x=>x.access_point_id===id))};
 return {};
}
export const museumStamp=s=>JSON.stringify(museumTypes.map(k=>s.tables[k]));
export function museumMaterials(s){return s.tables.publication_record.map(x=>publicView(s,x.id,'museum')).filter(x=>x?.kind==='material'&&publicView(s,x.id,'view')&&publicView(s,x.id,'cite'));}
export function museumAuthor(s,id){
 // The sole prototype login uses a generic byline, without publishing a person's profile.
 if(s.demo.single_user===1&&s.tables.account.length===1&&s.tables.account[0].person_id===id)return 'Користувач';
 return s.tables.publication_record.filter(p=>p.source_entity_id===id).map(p=>publicView(s,p.id)).find(p=>p?.kind==='person')?.title||null;
}
export function museumPrintView(s,actor,id){
 const print=s.tables.access_point_print.find(x=>x.id===id),point=print&&s.tables.access_point.find(x=>x.id===print.access_point_id),target=print&&s.tables.access_point_target.find(x=>x.id===print.target_history_id);
 if(!point||!museumOwned(s,actor,point.id)||point.state!=='active'||point.current_target_id!==print.target_history_id||!target||!approved(s,target.target_entity_id,target.target_revision_id))return null;
 const citation=s.tables.entity_revision.find(x=>x.id===print.citation_revision_id)?.snapshot;
 return {...structuredClone(print),svg:s.demo.file_contents[print.qr_file_id],citation:citation?.rendered_text||null};
}
export function setIssues(s,id){
 const row=s.tables.exhibit_set.find(x=>x.id===id);if(!row)return ['Добірка недоступна.'];
 const items=setItems(s,id),texts=setTexts(s,id),issues=[];
 if(!items.length)issues.push('Додайте хоча б один матеріал.');
 if(!texts.length||texts.filter(x=>x.is_default).length!==1||texts.some(x=>!x.curator_note.trim()))issues.push('Додайте пояснення та основну мову.');
 if(texts.some(x=>!museumAuthor(s,x.author_person_id)))issues.push('Потрібна погоджена публічна форма імені автора пояснення.');
 items.forEach((x,i)=>{const pub=publicView(s,x.publication_id,'museum');if(pub&&(!pub.attribution?.trim()||!pub.terms?.trim()))issues.push(`Матеріал ${i+1}: потрібні джерело та умови використання.`);if(!pub||pub.revision_id!==x.publication_revision_id||!publicView(s,x.publication_id,'view')||!publicView(s,x.publication_id,'cite'))issues.push(`Матеріал ${i+1}: змінився доступ або оприлюднена версія. Замініть його в добірці.`);});
 return issues;
}
export function setState(s,id){const row=s.tables.exhibit_set.find(x=>x.id===id);return row?.state==='ready'&&setIssues(s,id).length?'needs_review':row?.state;}
function approved(s,id,rid){
 const row=s.tables.exhibit_set.find(x=>x.id===id),d=s.tables.review_decision.find(x=>x.id===row?.review_decision_id);
 return row&&revision(s,id)===rid&&setState(s,id)==='ready'&&d?.decision==='accept'&&d.target_entity_id===id&&d.target_revision_id===rid;
}
export function resolvePoint(s,token,language='uk'){
 const t=s.tables,p=t.access_point.find(x=>x.stable_token===token),archive=p&&t.archive.find(x=>x.id===p.contact_archive_id);
 const unavailable={available:false,message:p?.unavailable_message||'Це посилання зараз недоступне.',archive_name:archive?.name||null};
 if(!p||p.state!=='active'||t.entity.find(e=>e.id===p.id)?.retired_at)return unavailable;
 const exhibition=t.museum_exhibition.find(x=>x.id===p.exhibition_id),target=t.access_point_target.find(x=>x.id===p.current_target_id&&x.access_point_id===p.id);
 if(exhibition?.state!=='open'||!target||!approved(s,target.target_entity_id,target.target_revision_id))return unavailable;
 const row=t.exhibit_set.find(x=>x.id===target.target_entity_id);if(row.exhibition_id!==exhibition.id)return unavailable;
 const texts=setTexts(s,row.id),text=texts.find(x=>x.language_tag===language)||texts.find(x=>x.is_default);
 return {available:true,title:text.title||row.title,exhibit_title:row.exhibit_title,exhibition_title:exhibition.title,curator_note:text.curator_note,author_credit:museumAuthor(s,text.author_person_id),language:text.language_tag,languages:texts.map(x=>x.language_tag),archive_name:archive.name,
  items:setItems(s,row.id).map(x=>{const pub=publicView(s,x.publication_id,'museum');return {publication_id:pub.id,title:pub.title,summary:pub.summary,attribution:pub.attribution,terms:pub.terms,reason:museumReasons[x.link_reason],reason_note:x.reason_note,resources:publicResources(s,pub.id,'museum'),citation:t.entity_revision.find(r=>r.id===x.citation_revision_id)?.snapshot.rendered_text||null};})};
}
export function qrSvg(text){
 const qr=qrcodegen.QrCode.encodeText(text,qrcodegen.QrCode.Ecc.MEDIUM),size=qr.size+8,parts=[];
 for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.getModule(x,y))parts.push(`M${x+4},${y+4}h1v1h-1z`);
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR-код посилання" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="white"/><path d="${parts.join('')}" fill="black"/></svg>`;
}
export function validateMuseum(s,require,fk,canonical){
 const t=s.tables;if(!t.museum_exhibition)return;
 validateMuseumRequests(s,require,fk);
 const by=(k,id)=>t[k].find(x=>x.id===id),reg=id=>by('entity',id),exact=(id,rid)=>require(by('entity_revision',rid)?.entity_id===id,'Чужа версія музейного матеріалу');
 for(const kind of museumTypes)for(const x of t[kind]){fk('account',reg(x.id).owner_account_id);fk('archive',reg(x.id).archive_id);}
 for(const x of t.museum_exhibition){fk('institution',x.institution_id);fk('person',x.responsible_person_id);if(x.place_id)fk('place',x.place_id);require(!!x.title.trim()&&['draft','open','closed','archived'].includes(x.state),'Експозиція');require(!x.opens_on||!x.closes_on||x.opens_on<=x.closes_on,'Дати експозиції');}
 for(const x of t.exhibit_set){fk('museum_exhibition',x.exhibition_id);fk('person',x.curator_person_id);require(reg(x.id).owner_account_id===reg(x.exhibition_id).owner_account_id&&reg(x.id).archive_id===reg(x.exhibition_id).archive_id,'Область добірки');require(!!x.title.trim()&&!!x.exhibit_title.trim()&&['draft','ready','needs_review','archived'].includes(x.state),'Добірка');if(x.review_decision_id)fk('review_decision',x.review_decision_id);if(x.state==='ready'){const d=by('review_decision',x.review_decision_id);require(d?.decision==='accept'&&d.target_entity_id===x.id&&d.target_revision_id===reg(x.id).current_revision_id,'Готовність без перевірки точної версії');}}
 const positions=new Set(),languages=new Set();
 for(const x of t.exhibit_set_item){require(reg(by('entity_revision',x.set_revision_id)?.entity_id)?.entity_type==='exhibit_set','Версія добірки');exact(x.target_entity_id,x.target_revision_id);exact(x.publication_id,x.publication_revision_id);require(reg(x.publication_id)?.entity_type==='publication_record'&&x.target_entity_id===x.publication_id&&x.target_revision_id===x.publication_revision_id,'Музейний профіль публікації');const key=x.set_revision_id+':'+x.position;require(Number.isInteger(x.position)&&x.position>0&&!positions.has(key)&&!!museumReasons[x.link_reason],'Порядок або причина зв’язку');positions.add(key);if(x.citation_revision_id){const c=by('entity_revision',x.citation_revision_id);require(reg(c?.entity_id)?.entity_type==='citation'&&c.snapshot.target_entity_id===x.publication_id&&c.snapshot.target_revision_id===x.publication_revision_id,'Цитування іншої версії');}}
 for(const x of t.exhibit_set_text){require(reg(by('entity_revision',x.set_revision_id)?.entity_id)?.entity_type==='exhibit_set','Версія музейного тексту');fk('person',x.author_person_id);const key=x.set_revision_id+':'+x.language_tag;require(['uk','en','pl','de'].includes(x.language_tag)&&!languages.has(key)&&!!x.curator_note.trim(),'Мова та пояснення');languages.add(key);}
 for(const r of t.entity_revision.filter(r=>reg(r.entity_id)?.entity_type==='exhibit_set'))for(const k of ['exhibit_set_text','exhibit_set_item'])require(canonical(r.snapshot._relations?.[k])===canonical(t[k].filter(x=>x.set_revision_id===r.id)),'Змінено історичну добірку');
 const tokens=new Set();for(const x of t.access_point){fk('museum_exhibition',x.exhibition_id);fk('archive',x.contact_archive_id);require(reg(x.id).owner_account_id===reg(x.exhibition_id).owner_account_id&&reg(x.id).archive_id===x.contact_archive_id,'Область точки');require(/^[a-f0-9-]{36}$/.test(x.stable_token)&&!tokens.has(x.stable_token),'Незмінна унікальна адреса');tokens.add(x.stable_token);require(['printed_qr','label','interactive_panel','kiosk','audio_guide'].includes(x.kind)&&['draft','active','access_unavailable','archived'].includes(x.state),'Стан точки');require(by('access_point_target',x.current_target_id)?.access_point_id===x.id,'Поточна ціль іншої точки');for(const r of t.entity_revision.filter(r=>r.entity_id===x.id)){require(r.snapshot.stable_token===x.stable_token,'Змінено адресу точки');const old=r.snapshot._relations?.access_point_target||[];require(old.every(h=>canonical(h)===canonical(by('access_point_target',h.id))),'Змінено історію цілей');}}
 const targets=new Set();for(const x of t.access_point_target){fk('access_point',x.access_point_id);exact(x.target_entity_id,x.target_revision_id);fk('account',x.changed_by);const point=by('access_point',x.access_point_id);require(by('exhibit_set',x.target_entity_id)?.exhibition_id===point.exhibition_id,'Ціль іншої експозиції');const key=x.access_point_id+':'+x.target_version;require(Number.isInteger(x.target_version)&&x.target_version>0&&!targets.has(key)&&!!x.reason.trim(),'Історія цілей');targets.add(key);}
 for(const x of t.access_point_print){const point=by('access_point',x.access_point_id);require(point&&by('access_point_target',x.target_history_id)?.access_point_id===point.id,'Друк іншої точки');fk('file_object',x.qr_file_id);require(x.minimum_size_mm>=30&&x.minimum_size_mm<=120,'Розмір QR');const u=new URL(x.human_readable_url);require(['http:','https:'].includes(u.protocol)&&u.pathname.endsWith('/pages/pg-61.html')&&u.searchParams.get('token')===point.stable_token,'Адреса QR');require(s.demo.file_contents[x.qr_file_id]===qrSvg(x.human_readable_url),'Вміст QR не відповідає адресі');if(x.layout_profile==='museum-label-2'||x.citation_revision_id){const c=by('entity_revision',x.citation_revision_id),target=by('access_point_target',x.target_history_id);require(reg(c?.entity_id)?.entity_type==='citation'&&c.snapshot.target_entity_id===target.target_entity_id&&c.snapshot.target_revision_id===target.target_revision_id,'Цитування іншої етикетки');}}
}
export async function museumCommand(s,actor,c,ctx){
 if(c.type.startsWith('museum.request.'))return museumRequestCommand(s,actor,c,ctx);
 const {fail,hash,audit,snapshot,revise}=ctx,t=s.tables,by=(k,id)=>t[k].find(x=>x.id===id),reg=id=>by('entity',id),rev=id=>reg(id)?.current_revision_id;
 if(!museumEnabled(s,actor))fail('forbidden','Немає дозволу на роботу з експозиціями.');
 const text=v=>{if(typeof v!=='string'||!v.trim())fail('invalid','Заповніть обов’язкове поле.');return v.trim();};
 const own=(k,id)=>{const x=by(k,id);if(!x||!museumOwned(s,actor,id))fail('forbidden','Запис недоступний.');return x;};
 const fresh=id=>{if(c.expected_revision_id!==rev(id))fail('stale','Запис змінено. Оновіть сторінку перед збереженням.');};
 const person=by('account',actor).person_id;
 const writable=ex=>{if(['closed','archived'].includes(ex.state))fail('invalid','Експозицію закрито. Створіть нову експозицію.');};
 const append=async(kind,row,archive,rid=crypto.randomUUID(),children=null)=>{
  let e=reg(row.id),before=e?.current_revision_id||null;if(!e){row={id:crypto.randomUUID(),...row};t[kind].push(row);e={id:row.id,entity_type:kind,owner_installation_id:s.demo.ids.installation,archive_id:archive,owner_account_id:actor,current_revision_id:rid,retired_at:null};t.entity.push(e);}else e.current_revision_id=rid;
  if(children)for(const [k,rows]of Object.entries(children))t[k].push(...rows.map(x=>({...x,set_revision_id:rid})));
  const snap=snapshot(t,kind,row);t.entity_revision.push({id:rid,entity_id:row.id,revision_no:before?by('entity_revision',before).revision_no+1:1,previous_revision_id:before,snapshot:snap,snapshot_hash:await hash(snap),recorded_at:s.clock,actor_account_id:actor,process_run_id:null,change_reason:c.reason?.trim()||'Оновлено музейний запис'});audit(c.type,row.id,before,rid);return row;
 };
 if(['museum.exhibition.create','museum.exhibition.save'].includes(c.type)){
  const old=c.type==='museum.exhibition.save'?own('museum_exhibition',c.id):null,archive=old?reg(old.id).archive_id:c.archive_id;if(old){fresh(old.id);writable(old);}
  if(!can(s,actor,'museum.write',archive))fail('forbidden','Архів недоступний.');
  if(!by('institution',c.institution_id)||reg(c.institution_id).archive_id!==archive)fail('invalid','Оберіть установу.');
  if(c.place_id&&(!by('place',c.place_id)||reg(c.place_id).archive_id!==archive))fail('invalid','Місце недоступне.');
  for(const v of [c.opens_on,c.closes_on])if(v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))fail('invalid','Перевірте дату.');
  if(c.opens_on&&c.closes_on&&c.opens_on>c.closes_on)fail('invalid','Завершення передує відкриттю.');
  const responsible=c.responsible_person_id||old?.responsible_person_id||person;
  if(!t.account.some(a=>a.person_id===responsible&&can(s,a.id,'museum.write',archive)))fail('invalid','Відповідальна особа не має доступу до експозицій цього архіву.');
  const values={title:text(c.title),institution_id:c.institution_id,place_id:c.place_id||null,opens_on:c.opens_on||null,closes_on:c.closes_on||null,responsible_person_id:responsible};
  return append('museum_exhibition',old?Object.assign(old,values):{...values,state:'draft'},archive);
 }
 if(c.type==='museum.exhibition.state'){
  const ex=own('museum_exhibition',c.id);fresh(ex.id);const reason=text(c.reason);
  if(!({draft:['open','archived'],open:['closed'],closed:['archived']}[ex.state]||[]).includes(c.state))fail('invalid','Цей перехід недоступний.');
  if(c.state==='open'){const sets=t.exhibit_set.filter(x=>x.exhibition_id===ex.id&&x.state!=='archived');if(!sets.length||sets.some(x=>!approved(s,x.id,rev(x.id))))fail('invalid','Перевірте всі добірки перед відкриттям.');}
  ex.state=c.state;await revise(ex,reason);
  if(['closed','archived'].includes(c.state))for(const point of t.access_point.filter(x=>x.exhibition_id===ex.id&&x.state!=='archived')){point.state='archived';await revise(point,reason);}
  return ex;
 }
 if(['museum.set.archive','museum.set.restore'].includes(c.type)){
  const row=own('exhibit_set',c.id),ex=own('museum_exhibition',row.exhibition_id);fresh(row.id);writable(ex);text(c.reason);
  const restoring=c.type==='museum.set.restore';if(restoring?row.state!=='archived':row.state==='archived')fail('invalid','Дія недоступна в цьому стані.');
  const children={exhibit_set_item:setItems(s,row.id),exhibit_set_text:setTexts(s,row.id)};row.state=restoring?'draft':'archived';row.review_decision_id=null;
  await append('exhibit_set',row,reg(ex.id).archive_id,crypto.randomUUID(),children);
  if(!restoring)for(const point of t.access_point.filter(x=>x.state==='active'&&by('access_point_target',x.current_target_id)?.target_entity_id===row.id)){point.state='access_unavailable';await revise(point,c.reason);}
  return row;
 }
 if(['museum.set.create','museum.set.save','museum.set.review'].includes(c.type)){
  const old=c.type==='museum.set.create'?null:own('exhibit_set',c.id),ex=own('museum_exhibition',old?.exhibition_id||c.exhibition_id);writable(ex);if(old)fresh(old.id);
  if(old?.state==='archived')fail('invalid','Добірку заархівовано.');
  const reviewing=c.type==='museum.set.review';let items,texts;
  if(reviewing){if(c.confirm!==true)fail('invalid','Підтвердьте перевірку добірки.');const issues=setIssues(s,old.id);if(issues.length)fail('invalid',issues.join(' '));items=setItems(s,old.id);texts=setTexts(s,old.id);}
  else{
   if(!Array.isArray(c.items)||!c.items.length||new Set(c.items.map(x=>x.publication_id)).size!==c.items.length)fail('invalid','Оберіть матеріали без повторень.');
   items=c.items.map((x,i)=>{const p=publicView(s,x.publication_id,'museum');if(!p||p.kind!=='material'||p.revision_id!==x.publication_revision_id||!publicView(s,p.id,'view')||!publicView(s,p.id,'cite'))fail('forbidden','Матеріал не дозволений для музею або його версія змінилася.');if(!museumReasons[x.link_reason])fail('invalid','Оберіть причину зв’язку.');return {position:i+1,target_entity_id:p.id,target_revision_id:p.revision_id,publication_id:p.id,publication_revision_id:p.revision_id,link_reason:x.link_reason,reason_note:x.reason_note?.trim()||null,citation_revision_id:null};});
   if(!Array.isArray(c.texts)||!c.texts.length||c.texts.filter(x=>x.is_default).length!==1||new Set(c.texts.map(x=>x.language_tag)).size!==c.texts.length)fail('invalid','Оберіть одну основну мову без повторень.');
   texts=c.texts.map(x=>{if(!['uk','en','pl','de'].includes(x.language_tag))fail('invalid','Мова недоступна.');return {language_tag:x.language_tag,title:x.title?.trim()||null,curator_note:text(x.curator_note),author_person_id:person,is_default:!!x.is_default};});
  }
  const archive=reg(ex.id).archive_id,rid=crypto.randomUUID(),decisionId=reviewing?crypto.randomUUID():null;
  if(reviewing){text(c.reason);items=await Promise.all(items.map(async x=>{const citation=await publicCommand(s,actor,{type:'public.citation',publication_id:x.publication_id},ctx);return {...x,citation_revision_id:rev(citation.id)};}));}
  let museumUri=old?.museum_record_uri||null;if(!reviewing&&c.museum_record_uri!==undefined){museumUri=c.museum_record_uri?.trim()||null;if(museumUri){let u;try{u=new URL(museumUri);}catch{fail('invalid','Перевірте посилання на музейний запис.');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)fail('invalid','Потрібне посилання http або https без облікових даних.');museumUri=u.href;}}
  const values=reviewing?{state:'ready',review_decision_id:decisionId}:{exhibition_id:ex.id,title:text(c.title),exhibit_title:text(c.exhibit_title),museum_inventory_number:c.museum_inventory_number?.trim()||null,museum_record_uri:museumUri,museum_object_type_term_id:old?.museum_object_type_term_id||null,curator_person_id:person,state:'draft',review_decision_id:null};
  const row=await append('exhibit_set',old?Object.assign(old,values):values,archive,rid,{exhibit_set_item:items,exhibit_set_text:texts});
  if(reviewing){await append('review_decision',{id:decisionId,target_entity_id:row.id,target_revision_id:rid,decision:'accept',reviewer_account_id:actor,decided_at:s.clock,reason:text(c.reason),supersedes_decision_id:null},archive);t.review_application.push({review_decision_id:decisionId,result_entity_id:row.id,result_revision_id:rid,applied_at:s.clock});}
  return row;
 }
 if(['museum.point.create','museum.point.retarget'].includes(c.type)){
  const old=c.type==='museum.point.create'?null:own('access_point',c.id),ex=own('museum_exhibition',old?.exhibition_id||c.exhibition_id);writable(ex);if(old){fresh(old.id);if(old.state==='archived')fail('invalid','Точку заархівовано.');}
  const set=own('exhibit_set',c.set_id);if(set.exhibition_id!==ex.id||!approved(s,set.id,c.set_revision_id))fail('invalid','Оберіть перевірену актуальну добірку цієї експозиції.');
  const id=old?.id||crypto.randomUUID(),target={id:crypto.randomUUID(),access_point_id:id,target_version:t.access_point_target.filter(x=>x.access_point_id===id).length+1,target_entity_id:set.id,target_revision_id:c.set_revision_id,publication_id:null,changed_at:s.clock,changed_by:actor,reason:text(c.reason)};
  if(!old&&!['printed_qr','label','interactive_panel','kiosk'].includes(c.kind))fail('invalid','Оберіть тип точки.');
  t.access_point_target.push(target);
  return append('access_point',old?Object.assign(old,{current_target_id:target.id,state:'active'}):{id,exhibition_id:ex.id,stable_token:crypto.randomUUID(),kind:c.kind,state:'active',current_target_id:target.id,contact_archive_id:reg(ex.id).archive_id,unavailable_message:'Матеріали цієї експозиції зараз недоступні. Зверніться до працівника музею або архіву.'},reg(ex.id).archive_id);
 }
 if(c.type==='museum.point.archive'){const point=own('access_point',c.id);fresh(point.id);if(point.state==='archived')fail('invalid','Точку вже заархівовано.');point.state='archived';await revise(point,text(c.reason));return point;}
 if(c.type==='museum.point.print'){
  const point=own('access_point',c.id);fresh(point.id);if(point.state!=='active')fail('invalid','Друк доступний для активної точки.');
  const target=by('access_point_target',point.current_target_id);if(!approved(s,target.target_entity_id,target.target_revision_id))fail('invalid','Спочатку оновіть ціль точки.');
  let u;try{u=new URL(c.url);}catch{fail('invalid','Перевірте адресу порталу.');}
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.hash||!u.pathname.endsWith('/pages/pg-61.html')||u.searchParams.get('token')!==point.stable_token||[...u.searchParams.keys()].some(k=>k!=='token'))fail('invalid','Потрібна постійна адреса цієї точки.');
  const size=Number(c.minimum_size_mm);if(!Number.isFinite(size)||size<30||size>120)fail('invalid','Розмір QR має бути від 30 до 120 мм.');
  const set=by('exhibit_set',target.target_entity_id),archiveName=by('archive',point.contact_archive_id).name;
  let identifier=t.identifier.find(x=>x.entity_id===set.id&&x.scheme==='urn'&&x.namespace==='museum');if(!identifier){identifier={id:crypto.randomUUID(),entity_id:set.id,scheme:'urn',namespace:'museum',value:'urn:hereditas:exhibit-set:'+set.id,is_primary:false,source_evidence_id:null};t.identifier.push(identifier);}
  const sources=setItems(s,set.id).map(x=>by('entity_revision',x.citation_revision_id)?.snapshot.rendered_text).filter(Boolean),authors=[...new Set(setTexts(s,set.id).map(x=>museumAuthor(s,x.author_person_id)))];
  const rendered=`${set.title}. Пояснення: ${authors.join(', ')}. ${archiveName}. ${u.href}\n${sources.join('\n')}`;
  const citation=await append('citation',{target_entity_id:set.id,target_revision_id:target.target_revision_id,stable_identifier_id:identifier.id,style_code:'museum-label-1',language_tag:'uk',rendered_text:rendered,structured_data:{id:identifier.value+'#'+target.target_revision_id,type:'collection',title:set.title,note:sources.join('\n')},generated_at:s.clock},null);
  const content=qrSvg(u.href),file=await append('file_object',{sha256:await rawHash(content),byte_size:new TextEncoder().encode(content).length,mime_type:'image/svg+xml',pronom_id:null,original_filename:'museum-qr.svg',received_at:s.clock,technical_metadata:{}},reg(point.id).archive_id);s.demo.file_contents[file.id]=content;
  const row={id:crypto.randomUUID(),access_point_id:point.id,target_history_id:target.id,qr_file_id:file.id,human_readable_url:u.href,archive_name:archiveName,citation_revision_id:rev(citation.id),minimum_size_mm:size,layout_profile:'museum-label-2',generated_at:s.clock};t.access_point_print.push(row);audit(c.type,point.id);return row;
 }
 fail('invalid','Невідома музейна дія.');
}
