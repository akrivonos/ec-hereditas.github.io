import {can} from './model.mjs?v=20261001-wf10';
import {consentBasisValid} from './workbench.mjs?v=20261001-wf10';
export const rightsFields={title:'Назва',summary:'Опис / текст',kind:'Вид',category:'Тема',place:'Місце',period:'Період',attribution:'Джерело й авторство',terms:'Умови',context_ids:'Пов’язані записи',resource_label:'Назва ресурсу',reference:'Архівний шифр'};
export const rightsPurposes={public:'Публічний показ',research:'Дослідницька робота',deposit:'Депонування',processing:'Машинне опрацювання'};
export const rightsUses={view:'Перегляд',cite:'Цитування',download:'Завантаження',museum:'Музейний показ',deposit:'Депонування',machine_process:'Машинне опрацювання'};
const reg=(s,id)=>s.tables.entity.find(x=>x.id===id);
export function accessPolicy(s,id,rid,purpose,use='view'){
 const t=s.tables,now=Date.parse(s.clock),entity=reg(s,id);if(!entity||entity.retired_at)return null;
 const ds=t.access_decision.filter(d=>d.target_entity_id===id&&d.purpose_code===purpose&&(!d.target_revision_id||d.target_revision_id===rid)&&d.state!=='superseded');
 if(!ds.length||ds.some(d=>reg(s,d.id)?.retired_at||d.state!=='effective'||d.access_level==='closed'||purpose==='public'&&d.access_level!=='public'||Date.parse(d.valid_from)>now||d.valid_until&&Date.parse(d.valid_until)<=now||d.embargo_until&&Date.parse(d.embargo_until)>now))return null;
 if(ds.some(d=>{const uses=t.access_decision_use.filter(x=>x.decision_id===d.id&&x.use_code===use),bases=t.access_decision_basis.filter(x=>x.decision_id===d.id);return !uses.length||uses.some(x=>x.effect!=='allow')||!bases.length||bases.some(b=>b.consent_id?!consentBasisValid(s,b,id,purpose,use):!b.basis_note?.trim());}))return null;
 const relevant=new Set(t.consent_scope.filter(x=>x.target_entity_id===id&&x.purpose_code===purpose&&t.consent_record.find(c=>c.id===x.consent_id)?.state!=='superseded').map(x=>x.consent_id));
 if(ds.some(d=>[...relevant].some(id=>!t.access_decision_basis.some(b=>b.decision_id===d.id&&b.consent_id===id))))return null;
 return ds;
}
export function projectFields(s,ds,values){
 const out={};for(const [key,value] of Object.entries(values)){
  const rules=ds.map(d=>s.tables.access_decision_field.find(x=>x.decision_id===d.id&&x.field_path===key));
  if(rules.some(x=>!x||x.effect==='deny'))continue;
  const masks=rules.filter(x=>x.effect==='mask');out[key]=masks.length?(masks.every(x=>x.replacement_text===masks[0].replacement_text)?masks[0].replacement_text:'Не оприлюднено'):value;
 }
 return out;
}
export function attributionNames(s,ds){
 const rows=s.tables.access_decision_attribution.filter(x=>ds.some(d=>d.id===x.decision_id));
 return [...new Set(rows.map(x=>x.person_id))].map(id=>{const rules=ds.map(d=>rows.find(x=>x.decision_id===d.id&&x.person_id===id));if(rules.some(x=>!x||x.mode==='anonymous'))return 'Анонімна особа';return rules.every(x=>x.display_name===rules[0].display_name)?rules[0].display_name:'Анонімна особа';}).join('; ');
}
export async function rightsCommand(s,actor,c,{need,fail,hash,snapshot,revise,audit}){
 const t=s.tables,by=(k,id)=>t[k]?.find(x=>x.id===id),e=id=>reg(s,id),r=id=>e(id)?.current_revision_id;
 const text=v=>{if(typeof v!=='string'||!v.trim())fail('invalid','Заповніть обов’язкове поле.');return v.trim();};
 const fresh=(id,rid)=>{if(!e(id)||r(id)!==rid)fail('stale','Запис змінився. Оновіть сторінку та повторіть перевірку.');};
 const add=async(kind,values,archive)=>{const x={id:crypto.randomUUID(),...values},rid=crypto.randomUUID();(t[kind]??=[]).push(x);t.entity.push({id:x.id,entity_type:kind,owner_installation_id:s.demo.ids.installation,archive_id:archive,owner_account_id:actor,current_revision_id:rid,retired_at:null});const snap=snapshot(t,kind,x);t.entity_revision.push({id:rid,entity_id:x.id,revision_no:1,previous_revision_id:null,snapshot:snap,snapshot_hash:await hash(snap),recorded_at:s.clock,actor_account_id:actor,process_run_id:null,change_reason:c.reason});audit(c.type,x.id,null,rid,c.reason);return x;};
 const source=e(c.source_id);if(!source||source.retired_at||!source.archive_id)fail('invalid','Оберіть матеріал архіву.');need('access.manage',source.archive_id);fresh(source.id,c.expected_source_revision_id);text(c.reason);
 const suspend=async()=>{for(const p of t.publication_record.filter(p=>p.source_entity_id===source.id&&p.state==='published')){p.state='unpublished';p.unpublished_at=s.clock;await revise(p,c.reason);}};
 const tasks=t.work_item.filter(w=>w.kind==='rights_review'&&!['done','cancelled'].includes(w.state)&&t.work_item_target.some(x=>x.work_item_id===w.id&&x.entity_id===source.id));
 if(c.type==='rights.escalate'){
  if(tasks.length)fail('invalid','Питання вже передано на розгляд.');
  for(const d of t.access_decision.filter(d=>d.target_entity_id===source.id&&d.state==='effective')){d.state='needs_review';await revise(d,c.reason);}await suspend();
  const run={id:crypto.randomUUID(),workflow_code:'WF-09',primary_entity_id:source.id,started_by:actor,started_at:s.clock,finished_at:null,state:'in_progress',notes:c.reason};t.workflow_run.push(run);
  const w=await add('work_item',{workflow_run_id:run.id,kind:'rights_review',title:'Перевірити права й етичні умови',state:'open',assigned_account_id:actor,assigned_role_id:null,due_at:null,resolution:null},source.archive_id);t.work_item_target.push({work_item_id:w.id,entity_id:source.id,revision_id:r(source.id)});t.work_item_event.push({work_item_id:w.id,from_state:null,to_state:'open',actor_account_id:actor,occurred_at:s.clock,reason:c.reason});return w;
 }
 if(c.type!=='rights.save')fail('invalid','Невідома дія.');
 const old=c.id&&by('access_decision',c.id);if(c.id){if(!old||old.target_entity_id!==source.id)fail('invalid','Рішення іншого матеріалу.');fresh(old.id,c.expected_revision_id);}
 if(!rightsPurposes[c.purpose_code]||!['public','controlled_research','closed'].includes(c.access_level)||c.confirm!==true)fail('invalid','Перевірте призначення й підтвердьте рішення.');
 if(old&&old.purpose_code!==c.purpose_code)fail('invalid','Для іншого використання створіть окреме рішення.');
 if(c.access_level!=='closed'&&((c.purpose_code==='public')!==(c.access_level==='public')))fail('invalid','Рівень доступу не відповідає використанню.');
 if(!old&&t.access_decision.some(d=>d.target_entity_id===source.id&&d.purpose_code===c.purpose_code&&d.state!=='superseded'))fail('invalid','Для цього використання вже є рішення. Відкрийте його й поновіть.');
 const dates={valid_from:c.valid_from||s.clock,valid_until:c.valid_until||null,embargo_until:c.embargo_until||null};
 if(Object.values(dates).some(v=>v&&!Number.isFinite(Date.parse(v)))||dates.valid_until&&Date.parse(dates.valid_until)<=Date.parse(dates.valid_from)||dates.embargo_until&&dates.valid_until&&Date.parse(dates.embargo_until)>=Date.parse(dates.valid_until))fail('invalid','Перевірте строки рішення та ембарго.');
 const uses=c.uses||[],fields=c.fields||[],resources=c.resources||[],attrs=c.attributions||[],bases=c.bases||[];
 if(!bases.length||!Array.isArray(uses)||uses.some(u=>!rightsUses[u])||new Set(uses).size!==uses.length)fail('invalid','Зазначте підставу й дозволене використання.');
 if(c.access_level!=='closed'&&!uses.length)fail('invalid','Оберіть дозволене використання.');
 const appropriate={public:['view','cite','download','museum'],research:['view','cite','download'],deposit:['deposit'],processing:['machine_process']};
 if(uses.some(u=>!appropriate[c.purpose_code].includes(u)))fail('invalid','Дія не відповідає призначенню.');
 if(new Set(fields.map(x=>x.field_path)).size!==fields.length||fields.some(x=>!rightsFields[x.field_path]||!['allow','mask','deny'].includes(x.effect)||x.effect==='mask'&&(!x.replacement_text?.trim()||x.field_path==='context_ids')))fail('invalid','Перевірте правила полів і текст заміни.');
 for(const b of bases){if(b.consent_id){need('consent.read',source.archive_id);if(e(b.consent_id)?.archive_id!==source.archive_id)fail('invalid','Згода іншого архіву.');fresh(b.consent_id,b.consent_revision_id);if(c.access_level!=='closed'&&uses.some(u=>!consentBasisValid(s,b,source.id,c.purpose_code,u)))fail('invalid','Згода не дозволяє обране використання або її строк минув.');}else text(b.basis_note);}
 // Known participant conditions cannot be bypassed by omitting a consent in the form.
 if(c.access_level!=='closed'){
  const relevant=new Set(t.consent_scope.filter(x=>x.target_entity_id===source.id&&x.purpose_code===c.purpose_code&&by('consent_record',x.consent_id)?.state!=='superseded').map(x=>x.consent_id));
  if([...relevant].some(id=>!bases.some(b=>b.consent_id===id)))fail('invalid','Врахуйте всі задокументовані згоди щодо цього використання.');
 }
 if(new Set(resources.map(x=>x.resource_entity_id)).size!==resources.length)fail('invalid','Ресурс повторено.');
 for(const x of resources){if(!['representation','textual_representation','media_segment','timed_layer','file_object'].includes(e(x.resource_entity_id)?.entity_type)||e(x.resource_entity_id).archive_id!==source.archive_id||e(x.resource_entity_id).retired_at||!['allow','deny'].includes(x.effect))fail('invalid','Оберіть ресурс цього архіву.');need('domain.read',source.archive_id);fresh(x.resource_entity_id,x.resource_revision_id);}
 if(new Set(attrs.map(x=>x.person_id)).size!==attrs.length)fail('invalid','Особу повторено.');
 for(const x of attrs){if(!by('person',x.person_id)||e(x.person_id)?.archive_id!==source.archive_id||!['full_name','chosen_name','pseudonym','anonymous'].includes(x.mode))fail('invalid','Перевірте зазначення особи.');if(x.mode!=='anonymous')text(x.display_name);}
 const values={target_entity_id:source.id,target_revision_id:r(source.id),access_level:c.access_level,purpose_code:c.purpose_code,state:'effective',...dates,decided_by:actor,reason:c.reason,conditions:text(c.conditions)};
 const d=old?Object.assign(old,values):await add('access_decision',values,source.archive_id);
 for(const k of ['basis','field','resource','use','attribution'])t['access_decision_'+k]=t['access_decision_'+k].filter(x=>x.decision_id!==d.id);
 const evidence=await add('evidence',{source_entity_id:source.id,source_revision_id:r(source.id),external_uri:null,locator:c.locator?.trim()||null,quote_text:null,note:text(c.evidence_note),captured_at:s.clock},source.archive_id);
 bases.forEach(b=>t.access_decision_basis.push({decision_id:d.id,consent_id:b.consent_id||null,consent_revision_id:b.consent_id?b.consent_revision_id:null,evidence_id:evidence.id,basis_note:b.basis_note?.trim()||null}));
 fields.forEach(x=>t.access_decision_field.push({decision_id:d.id,field_path:x.field_path,effect:x.effect,replacement_text:x.effect==='mask'?x.replacement_text.trim():null}));
 resources.forEach(x=>t.access_decision_resource.push({decision_id:d.id,resource_entity_id:x.resource_entity_id,resource_revision_id:x.resource_revision_id,effect:x.effect}));
 Object.keys(rightsUses).forEach(u=>t.access_decision_use.push({decision_id:d.id,use_code:u,effect:c.access_level!=='closed'&&uses.includes(u)?'allow':'deny',conditions:c.conditions}));
 attrs.forEach(x=>t.access_decision_attribution.push({decision_id:d.id,person_id:x.person_id,mode:x.mode,display_name:x.mode==='anonymous'?null:x.display_name.trim()}));
 await revise(d,c.reason);if(c.purpose_code==='public')await suspend();
 if(c.resolve_task){const w=tasks.find(x=>x.id===c.resolve_task);if(!w)fail('stale','Питання вже опрацьоване.');fresh(w.id,c.expected_task_revision_id);w.state='done';w.resolution=c.reason;t.work_item_event.push({work_item_id:w.id,from_state:'open',to_state:'done',actor_account_id:actor,occurred_at:s.clock,reason:c.reason});await revise(w,c.reason);if(w.workflow_run_id){const run=by('workflow_run',w.workflow_run_id);run.state='completed';run.finished_at=s.clock;}}
 return d;
}
