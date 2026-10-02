import {rightsCommand} from './rights.mjs?v=20261002-programmes2';
import {validateReconciliation,reconciliationCommand} from './reconciliation.mjs?v=20261002-programmes2';
import {catalogTypes,validateCatalog,catalogCommand} from './catalog.mjs?v=20261002-programmes2';
import {legacyTypes,validateLegacy,legacyCommand} from './legacy.mjs?v=20261002-programmes2';
import {intakeTypes,validateIntake,intakeCommand} from './intake.mjs?v=20261002-programmes2';
import {fileBytes} from './binary.mjs?v=20261002-programmes2';
// Shared mock adapter. Domain rows use the names/fields of schema Г.
// Permissions below are a provisional demo profile, not the professional R-codes.
import {fieldTypes,snapshot,addMembers,upgrade,validateField,fieldCommand} from './field.mjs?v=20261002-programmes2';
import {mediaTypes,validateMedia,mediaCommand,rawHash,manifestPayload} from './media.mjs?v=20261002-programmes2';
import {researchTypes,validateResearch,researchCommand} from './research.mjs?v=20261002-programmes2';
import {publicTypes,validatePublic,publicCommand} from './public.mjs?v=20261002-programmes2';
import {museumTypes,validateMuseum,museumCommand} from './museum.mjs?v=20261002-programmes2';
import {archiveTypes,validateArchive,archiveCommand} from './archive.mjs?v=20261002-programmes2';
import {workbenchTypes,validateWorkbench,workbenchCommand,verifyWorkbenchHashes} from './workbench.mjs?v=20261002-programmes2';
import {prepareMuseumDemo} from './demo-museum.mjs?v=20261002-programmes2';
export class ModelError extends Error {
  constructor(code,message){super(message);this.code=code;}
}
const fail=(code,message)=>{throw new ModelError(code,message);};
export const clone=value=>structuredClone(value);
export const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==="object"&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v);
export async function hash(value){
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonical(value))))).map(v=>v.toString(16).padStart(2,"0")).join("");
}
export const grantKey=g=>[g.account_id,g.role_id,g.scope_kind,g.scope_entity_id||g.installation_id].join(":");
export const activeAccount=(s,id)=>s.tables.account.find(a=>a.id===id&&a.state==="active");
export function grants(s,actor){
  if(!activeAccount(s,actor))return [];
  return s.tables.role_assignment.filter(g=>g.account_id===actor&&(!g.valid_until||Date.parse(g.valid_until)>Date.parse(s.clock)));
}
export function can(s,actor,permission,scope=null){
  return grants(s,actor).some(g=>
    s.tables.role_permission.some(p=>p.role_id===g.role_id&&p.permission_code===permission)&&
    (g.scope_kind==="installation" || (scope!==null&&g.scope_entity_id===scope)));
}
export function scopes(s,actor){
  return s.tables.archive.filter(a=>can(s,actor,"task.read",a.id));
}
export function tasks(s,actor,scope=null){
  return s.tables.work_item.filter(t=>{
    const e=s.tables.entity.find(e=>e.id===t.id);
    return (!scope||e.archive_id===scope)&&can(s,actor,"task.read",e.archive_id);
  }).map(t=>({...clone(t),archive_id:s.tables.entity.find(e=>e.id===t.id).archive_id,
    revision_id:s.tables.entity.find(e=>e.id===t.id).current_revision_id,
    // Existence of a hidden dependency is never returned in this projection.
    unresolved_dependencies:s.tables.work_item_dependency.filter(d=>d.work_item_id===t.id)
      .filter(d=>s.tables.work_item.find(x=>x.id===d.depends_on_item_id)?.state!=="done")
      .map(d=>d.depends_on_item_id)}));
}
export function taskView(s,actor,id){
  const task=tasks(s,actor).find(t=>t.id===id);
  if(!task)return null; // Unknown and forbidden intentionally share the same projection.
  return {...task,events:clone(s.tables.work_item_event.filter(e=>e.work_item_id===id)),
    targets:s.tables.work_item_target.filter(t=>t.work_item_id===id).map(t=>{
      const entity=s.tables.entity.find(e=>e.id===t.entity_id);
      if(!can(s,actor,"task.read",entity.archive_id||entity.id))return {restricted:true};
      const revision=s.tables.entity_revision.find(r=>r.id===t.revision_id);
      return {entity_id:t.entity_id,revision_id:t.revision_id,revision_no:revision?.revision_no,
        type:entity.entity_type,label:revision?.snapshot.name||revision?.snapshot.title||"Архівний об’єкт"};
    })};
}
export function validate(s){
  const t=s.tables;
  const require=(condition,message)=>{if(!condition)fail("invalid_fixture",message);};
  const by=(table,id)=>t[table].find(x=>x.id===id);
  const fk=(table,id,nullable=false)=>require((nullable&&id===null)||!!by(table,id),"Недійсний зв’язок: "+table);
  for(const [table,rows]of Object.entries(t)){
    const ids=rows.filter(r=>r.id!==undefined).map(r=>r.id);
    require(new Set(ids).size===ids.length,"Повторений ID: "+table);
    require(ids.every(id=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)),"Некоректний UUID: "+table);
  }
  const snapshotKeys=new Set();
  for(const r of t.entity_revision){
    fk("entity",r.entity_id); fk("account",r.actor_account_id,true);
    require(Number.isInteger(r.revision_no)&&r.revision_no>0,"Некоректний номер версії");
    const key=r.entity_id+":"+r.revision_no;require(!snapshotKeys.has(key),"Повторена версія");snapshotKeys.add(key);
    if(r.previous_revision_id){
      const p=by("entity_revision",r.previous_revision_id);
      require(p?.entity_id===r.entity_id&&p.revision_no===r.revision_no-1,"Неправильний попередник");
    }else require(r.revision_no===1,"Версія без попередника");
    require(r.snapshot.id===r.entity_id,"Snapshot належить іншому об’єкту");
  }
  for(const e of t.entity){
    fk("installation",e.owner_installation_id);fk("archive",e.archive_id,true);fk("account",e.owner_account_id,true);
    require(["archive","person","work_item",...fieldTypes,...mediaTypes,...researchTypes,...publicTypes,...museumTypes,...archiveTypes,...workbenchTypes,...intakeTypes,...legacyTypes,...catalogTypes].includes(e.entity_type),"Непідтриманий тип запису");
    const row=by(e.entity_type,e.id);require(!!row,"Відсутній типізований запис");
    const r=by("entity_revision",e.current_revision_id);
    require(r?.entity_id===e.id,"Поточна версія іншого об’єкта");
    const {_relations,...core}=r.snapshot;
    require(canonical(row)===canonical(core),"Поточний рядок не відповідає snapshot");
  }
  for(const table of ["person","archive","work_item",...fieldTypes,...mediaTypes,...researchTypes,...publicTypes,...museumTypes,...archiveTypes,...workbenchTypes,...intakeTypes,...legacyTypes,...catalogTypes])for(const row of t[table]||[])
    require(by("entity",row.id)?.entity_type===table,"Відсутня реєстрація entity");
  for(const m of t.entity_revision_member){
    fk("entity_revision",m.aggregate_revision_id);
    require(by("entity_revision",m.member_revision_id)?.entity_id===m.member_entity_id,"Невідповідна версія члена агрегату");
  }
  for(const a of t.account){fk("person",a.person_id,true);require(["active","disabled"].includes(a.state),"Стан акаунта");}
  require(new Set(t.account.map(a=>a.auth_subject)).size===t.account.length,"Повторений auth_subject");
  const grantKeys=new Set();
  for(const g of t.role_assignment){
    fk("account",g.account_id);fk("access_role",g.role_id);fk("installation",g.installation_id);
    const key=grantKey(g); require(!grantKeys.has(key),"Повторне призначення прав");grantKeys.add(key);
    require(["installation","archive","research","exhibition"].includes(g.scope_kind),"Невідомий тип scope");
    if(g.scope_kind==="installation")require(g.scope_entity_id===null,"Installation scope має бути NULL");
    else{
      const types={archive:"archive",research:"field_research",exhibition:"museum_exhibition"};
      const e=by("entity",g.scope_entity_id);
      require(e?.entity_type===types[g.scope_kind]&&e.owner_installation_id===g.installation_id,"Тип або інсталяція scope");
    }
    require(g.valid_until===null||Number.isFinite(Date.parse(g.valid_until)),"Некоректний строк grant");
  }
  for(const p of t.role_permission)fk("access_role",p.role_id);
  for(const w of t.workflow_run){fk("entity",w.primary_entity_id,true);fk("account",w.started_by,true);require(/^WF-(0[1-9]|1\d|2\d)$/.test(w.workflow_code),"Код workflow");}
  for(const w of t.work_item){
    fk("workflow_run",w.workflow_run_id,true);fk("account",w.assigned_account_id,true);fk("access_role",w.assigned_role_id,true);
    require(["open","assigned","in_progress","blocked","done","cancelled"].includes(w.state),"Некоректний стан завдання");
    require(typeof w.title==="string"&&w.title.trim().length>0,"Потрібна назва");
    require(w.due_at===null||Number.isFinite(Date.parse(w.due_at)),"Некоректна дата");
    if(w.state==="done")require(!!w.resolution?.trim(),"Завершення без підстави");
  }
  for(const x of t.work_item_target){
    fk("work_item",x.work_item_id);fk("entity",x.entity_id);
    if(x.revision_id)require(by("entity_revision",x.revision_id)?.entity_id===x.entity_id,"Ціль посилається на чужу версію");
    const target=by("entity",x.entity_id), task=by("entity",x.work_item_id);
    const proposal=target.entity_type==="candidate"&&by("candidate",target.id);
    require((target.archive_id||target.id)===task.archive_id||proposal?.kind==="change_proposal"&&by("entity",proposal.target_entity_id)?.archive_id===task.archive_id,"Ціль поза областю завдання");
  }
  for(const x of t.work_item_event){fk("work_item",x.work_item_id);fk("account",x.actor_account_id,true);}
  for(const d of t.work_item_dependency){
    fk("work_item",d.work_item_id);fk("work_item",d.depends_on_item_id);
    require(by("entity",d.work_item_id).archive_id===by("entity",d.depends_on_item_id).archive_id,"Залежність поза scope");
  }
  const visit=(id,path=new Set())=>{
    require(!path.has(id),"Цикл залежностей");const next=new Set([...path,id]);
    for(const d of t.work_item_dependency.filter(d=>d.work_item_id===id))visit(d.depends_on_item_id,next);
  };
  t.work_item.forEach(w=>visit(w.id));
  for(const x of t.digital_storage_location){fk("installation",x.installation_id);require(!!x.failure_domain,"Потрібен failure domain");}
  for(const v of t.vocabulary_scheme){
    require(v.d_code!=="D18","D18 зарезервований");
    if(v.d_code==="D14")require(!!v.owner_archive_id!==!!v.owner_institution_id,"D14 має одного власника");
    if(v.owner_archive_id)fk("archive",v.owner_archive_id);
  }
  for(const a of t.audit_event){
    fk("account",a.actor_account_id,true);fk("entity",a.entity_id,true);
    for(const key of ["before_revision_id","after_revision_id"])if(a[key])require(by("entity_revision",a[key])?.entity_id===a.entity_id,"Чужа версія аудиту");
  }
  validateField(s,require,fk,canonical);
  validateMedia(s,require,fk,canonical);
  validateResearch(s,require,fk,canonical);
  validatePublic(s,require,fk,canonical);
  validateMuseum(s,require,fk,canonical);
  validateArchive(s,require,fk);
  validateIntake(s,require,fk,canonical);
  validateLegacy(s,require,fk);
  validateCatalog(s,require,fk);
  validateReconciliation(s,require,fk);
  validateWorkbench(s,require,fk);
  return true;
}
export async function verifyHashes(s){
  await verifyWorkbenchHashes(s,hash);
  for(const r of s.tables.entity_revision)if(await hash(r.snapshot)!==r.snapshot_hash)fail("invalid_fixture","Змінено незмінний snapshot");
  for(const r of s.tables.source_record||[])if(await rawHash(r.raw_text||canonical(r.raw_payload))!==r.source_hash)fail('invalid_fixture','Змінено джерельний запис');
  for(const f of s.tables.file_object||[])if(await rawHash(s.demo.file_contents[f.id])!==f.sha256||fileBytes(s.demo.file_contents[f.id]).length!==f.byte_size)fail('invalid_fixture','Змінено незмінний файл');
  for(const h of s.tables.handover||[])if(await hash(manifestPayload(s.tables.handover_item.filter(x=>x.handover_id===h.id)))!==h.manifest_checksum)fail('invalid_fixture','Змінено склад пакета');
}
export function createStore(base,persistence=null){
  let state=clone(base),generation=0,busy=false;
  const read=()=>persistence?.read();
  const saved=read();
  if(saved){state=upgrade(saved.state,base);validate(state);generation=saved.generation;}
  validate(state);
  const persist=()=>persistence?.write({generation,state});
  const get=()=>clone(state);
  function sync(){const saved=read();if(saved){state=upgrade(saved.state,base);validate(state);generation=saved.generation;}}
  async function dispatch(actor,command){
    if(busy)fail("busy","Попередня зміна ще зберігається.");
    busy=true;
    try{
      const latest=read();if(latest&&latest.generation!==generation){sync();fail("stale","Дані змінилися в іншій вкладці. Оновіть сторінку та повторіть дію.");}
      if(!activeAccount(state,actor))fail("forbidden","Для дії потрібен активний обліковий запис.");
      const next=clone(state),t=next.tables,c=command;
      const need=(p,scope=null)=>{if(!can(next,actor,p,scope))fail("forbidden","Немає дозволу на цю дію в обраній області.");};
      const audit=(action,entity=null,before=null,after=null,reason=null)=>t.audit_event.push({id:crypto.randomUUID(),actor_account_id:actor,process_run_id:null,entity_id:entity,action,occurred_at:next.clock,before_revision_id:before,after_revision_id:after,reason});
      const revise=async(row,reason)=>{
        const e=t.entity.find(e=>e.id===row.id),before=e.current_revision_id;
        const previous=t.entity_revision.find(r=>r.id===before);
        const snap=snapshot(t,e.entity_type,row);
        const r={id:crypto.randomUUID(),entity_id:row.id,revision_no:previous.revision_no+1,previous_revision_id:before,
          snapshot:snap,snapshot_hash:await hash(snap),recorded_at:next.clock,actor_account_id:actor,process_run_id:null,change_reason:reason};
        t.entity_revision.push(r);e.current_revision_id=r.id;addMembers(t,e.entity_type,row.id,r.id);audit(e.entity_type==='work_item'?"task.revise":"record.revise",row.id,before,r.id,reason);
      };
      let result={};
      if(c.type.startsWith('workbench.'))result=await workbenchCommand(next,actor,c,{need,can,fail,revise,audit,hash,snapshot});
      else if(c.type.startsWith('reconcile.'))result=await reconciliationCommand(next,actor,c,{need,can,fail,revise,audit,hash,snapshot});
      else if(c.type.startsWith('catalog.'))result=await catalogCommand(next,actor,c,{need,can,fail,revise,audit,hash,snapshot});
      else if(c.type.startsWith('legacy.'))result=await legacyCommand(next,actor,c,{need,can,fail,revise,audit,hash,snapshot});
      else if(c.type.startsWith('intake.'))result=await intakeCommand(next,actor,c,{need,can,fail,revise,audit,hash,snapshot});
      else if(c.type.startsWith('rights.'))result=await rightsCommand(next,actor,c,{need,can,fail,revise,audit,hash,snapshot});
      else if(c.type.startsWith('archive.'))result=await archiveCommand(next,actor,c,{need,can,fail,revise,audit,hash,snapshot});
      else if(c.type==='demo.museum.prepare')result=await prepareMuseumDemo(next,actor,{need,can,fail,revise,audit,hash,snapshot});
      else if(c.type.startsWith('museum.'))result=await museumCommand(next,actor,c,{need,can,fail,revise,audit,hash,snapshot});
      else if(c.type.startsWith('public.'))result=await publicCommand(next,actor,c,{need,can,fail,revise,audit,hash,snapshot});
      else if(c.type.startsWith('research.'))result=await researchCommand(next,actor,c,{need,can,fail,revise,audit,hash,snapshot});
      else if(c.type.startsWith('media.')||c.type.startsWith('preparation.'))result=await mediaCommand(next,actor,c,{need,can,fail,revise,audit,hash,snapshot});
      else if(c.type.startsWith('field.'))result=await fieldCommand(next,actor,c,{need,can,fail,revise,audit,hash});
      else if(c.type==="task.create"){
        need("task.create",c.archive_id);
        const archive=t.archive.find(a=>a.id===c.archive_id);
        if(!archive)fail("invalid","Оберіть архів.");
        if(!c.title?.trim()||c.title.trim().length>240)fail("invalid","Назва має містити від 1 до 240 символів.");
        if(!c.reason?.trim())fail("invalid","Вкажіть підставу створення.");
        const id=crypto.randomUUID(),revisionId=crypto.randomUUID();
        const row={id,workflow_run_id:null,kind:"description",title:c.title.trim(),state:"open",assigned_account_id:null,assigned_role_id:null,due_at:c.due_at||null,resolution:null};
        t.work_item.push(row);t.entity.push({id,entity_type:"work_item",owner_installation_id:next.demo.ids.installation,archive_id:c.archive_id,owner_account_id:null,current_revision_id:revisionId,retired_at:null});
        t.entity_revision.push({id:revisionId,entity_id:id,revision_no:1,previous_revision_id:null,snapshot:clone(row),snapshot_hash:await hash(row),recorded_at:next.clock,actor_account_id:actor,process_run_id:null,change_reason:c.reason.trim()});
        t.work_item_target.push({work_item_id:id,entity_id:archive.id,revision_id:t.entity.find(e=>e.id===archive.id).current_revision_id});
        t.work_item_event.push({work_item_id:id,from_state:null,to_state:"open",actor_account_id:actor,occurred_at:next.clock,reason:c.reason.trim()});
        audit("task.create",id,null,revisionId,c.reason.trim());result={id};
      }else if(c.type==="task.transition"||c.type==="task.assign"){
        const task=t.work_item.find(w=>w.id===c.id),entity=t.entity.find(e=>e.id===c.id);
        if(!task||!can(next,actor,"task.read",entity.archive_id))fail("forbidden","Завдання недоступне.");
        if(['archival_review','reconciliation_review','catalog_review','rights_review','capture_preparation_review','quality_review','preservation_review','processing_review'].includes(task.kind))fail('invalid','Опрацьовуйте завдання на сторінці розгляду пропозиції.');
        if(task.kind==='text_review')fail('invalid','Ухваліть рішення на сторінці перевірки тексту.');
        if(['museum_publication_request','museum_correction_request'].includes(task.kind))fail('invalid','Опрацьовуйте це звернення на сторінці «Запити музею».');
        if(c.expected_revision_id!==entity.current_revision_id)fail("stale","Версію завдання змінено. Оновіть сторінку перед збереженням.");
        const from=task.state;
        if(c.type==="task.assign"){
          need("task.assign",entity.archive_id);
          if(["done","cancelled"].includes(from))fail("invalid","Завершене завдання не можна перепризначити.");
          if(!can(next,c.account_id,"task.work",entity.archive_id))fail("invalid","Виконавець не має чинного доступу до цієї області.");
          task.assigned_account_id=c.account_id;
          if(from==="open")task.state="assigned";
        }else{
          need("task.work",entity.archive_id);
          if(task.assigned_account_id&&task.assigned_account_id!==actor&&!can(next,actor,"task.assign",entity.archive_id))fail("forbidden","Завдання призначене іншому виконавцю.");
          const actions={
            take:{from:["open"],to:"assigned"},
            start:{from:["assigned","blocked"],to:"in_progress"},
            block:{from:["open","assigned","in_progress"],to:"blocked"},
            return:{from:["assigned","in_progress","blocked"],to:"open"},
            complete:{from:["in_progress"],to:"done"}
          };
          const rule=actions[c.action];
          if(!rule||!rule.from.includes(from))fail("invalid","Перехід недоступний у поточному стані.");
          const blockers=t.work_item_dependency.filter(d=>d.work_item_id===task.id).filter(d=>t.work_item.find(w=>w.id===d.depends_on_item_id).state!=="done");
          if(["start","complete"].includes(c.action)&&blockers.length)fail("blocked","Спочатку завершіть залежне завдання.");
          if(["block","return","complete"].includes(c.action)&&!c.reason?.trim())fail("invalid","Вкажіть підставу або результат.");
          task.state=rule.to;
          if(c.action==="take")task.assigned_account_id=actor;
          if(c.action==="return")task.assigned_account_id=null;
          if(c.action==="complete")task.resolution=c.reason.trim();
        }
        const reason=c.reason?.trim()||(c.type==="task.assign"?"Призначено виконавця":"Змінено стан завдання");
        t.work_item_event.push({work_item_id:task.id,from_state:from,to_state:task.state,actor_account_id:actor,occurred_at:next.clock,reason});
        await revise(task,reason);
      }else if(c.type==="grant.add"){
        need("account.manage");
        if(!activeAccount(next,c.account_id))fail("invalid","Оберіть активний акаунт.");
        const role=t.access_role.find(r=>r.id===c.role_id);
        if(!role)fail("invalid","Оберіть роль доступу.");
        const installationRole=["administrator","integrator"].includes(role.code);
        if(installationRole!== (c.scope_kind==="installation"))fail("invalid","Службова роль потребує області інсталяції; робоча роль — архіву.");
        if(role.code==='contact-editor'&&c.scope_kind!=='research')fail('invalid','Для приватних контактів оберіть дослідження.');
        if(!installationRole&&role.code!=='contact-editor'&&c.scope_kind!=='archive')fail('invalid','Для цієї ролі оберіть архів.');
        const grant={account_id:c.account_id,role_id:c.role_id,scope_kind:c.scope_kind,scope_entity_id:c.scope_kind==="installation"?null:c.scope_entity_id,installation_id:next.demo.ids.installation,valid_until:c.valid_until||null};
        if(grant.valid_until&&(!Number.isFinite(Date.parse(grant.valid_until))||Date.parse(grant.valid_until)<=Date.parse(next.clock)))fail("invalid","Строк доступу має бути після демонстраційної дати.");
        const existing=t.role_assignment.find(g=>grantKey(g)===grantKey(grant));
        if(existing)fail("invalid","Таке призначення вже існує. Спочатку відкличте попереднє.");
        t.role_assignment.push(grant);audit("grant.add",null,null,null,"Надано scoped grant");
      }else if(c.type==="grant.revoke"){
        need("account.manage");
        const grant=t.role_assignment.find(g=>grantKey(g)===c.key);
        if(!grant)fail("stale","Це призначення вже відкликане.");
        t.role_assignment=t.role_assignment.filter(g=>grantKey(g)!==c.key);
        if(!t.account.some(a=>can(next,a.id,"account.manage")))fail("invalid","Потрібно зберегти хоча б одного активного адміністратора.");
        audit("grant.revoke",null,null,null,"Відкликано scoped grant");
      }else if(c.type==="settings.save"){
        need("settings.manage");
        if(!c.name?.trim())fail("invalid","Вкажіть назву інсталяції.");
        let url;try{url=new URL(c.base_uri);}catch{fail("invalid","Потрібна повна адреса HTTPS.");}
        if(url.protocol!=="https:"||url.username||url.password)fail("invalid","Використайте HTTPS без логіна, пароля або секретів.");
        t.installation[0].name=c.name.trim();t.installation[0].base_uri=url.href;
        audit("settings.save",null,null,null,"Оновлено демонстраційні параметри інсталяції");
      }else fail("invalid","Невідома команда.");
      validate(next);await verifyHashes(next);
      const current=read();if(current&&current.generation!==generation){sync();fail("stale","Паралельна зміна. Повторіть дію з актуальними даними.");}
      try{persistence?.write({generation:generation+1,state:next});}catch{fail('storage_full','Не вдалося зберегти дані в браузері. Звільніть місце або збережіть запис на комп’ютер.');}
      state=next;generation++;return result;
    }finally{busy=false;}
  }
  return {get,dispatch,sync,reset(){state=clone(base);generation++;persist();},verify:()=>verifyHashes(state)};
}
