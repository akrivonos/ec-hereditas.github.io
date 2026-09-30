import {hash,validate,verifyHashes} from './model.mjs?v=20260930-wf05';
import {upgrade,snapshot} from './field.mjs?v=20260930-wf05';

// A one-time prototype migration: consolidate login identities, not archival people.
export async function singleUser(source){
 if(source.demo.single_user===1)return structuredClone(source);
 validate(source);await verifyHashes(source);
 const s=structuredClone(source),t=s.tables,id=s.demo.ids.admin,oldIds=new Set(t.account.map(x=>x.id));
 const previous=t.account.find(x=>x.id===id);if(!previous)throw Error('Не знайдено обліковий запис адміністратора.');
 t.account=[{...previous,auth_subject:'demo:user',state:'active'}];
 const remap=value=>{
  if(typeof value==='string')return oldIds.has(value)?id:value;
  if(Array.isArray(value))return value.map(remap);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,remap(v)]));
  return value;
 };
 s.tables=remap(t);const tables=s.tables;
 const personId='935623af-494e-4f35-bbbb-a022f024ab09',rid='19c70b86-9d76-4fe2-8e9e-4f9b3a735016';
 const person={id:personId,preferred_name:'Користувач',name_note:null};
 tables.person.push(person);tables.entity.push({id:personId,entity_type:'person',owner_installation_id:s.demo.ids.installation,archive_id:tables.entity.find(e=>e.id===previous.person_id)?.archive_id||s.demo.ids['archive-a'],owner_account_id:null,current_revision_id:rid,retired_at:null});
 const snap=snapshot(tables,'person',person);
 tables.entity_revision.push({id:rid,entity_id:personId,revision_no:1,previous_revision_id:null,snapshot:snap,snapshot_hash:await hash(snap),recorded_at:s.clock,actor_account_id:id,process_run_id:null,change_reason:'Створено єдиний обліковий запис'});
 tables.account[0].person_id=personId;
 const role=tables.access_role.find(x=>x.code==='administrator');
 const permissions=[...new Set(tables.role_permission.map(x=>x.permission_code))];
 for(const permission of permissions)if(!tables.role_permission.some(x=>x.role_id===role.id&&x.permission_code===permission))tables.role_permission.push({role_id:role.id,permission_code:permission});
 tables.role_assignment=[{account_id:id,role_id:role.id,scope_kind:'installation',scope_entity_id:null,installation_id:s.demo.ids.installation,valid_until:null}];
 s.demo.ids=remap(s.demo.ids);s.demo.default_actor=id;s.demo.actors=[{account_id:id,label:'Користувач',professional_role:null,menu_context:'Адміністратор'}];s.demo.single_user=1;
 // Keep every revision and event, rebinding account references to the sole login.
 for(const revision of tables.entity_revision)revision.snapshot_hash=await hash(revision.snapshot);
 validate(s);await verifyHashes(s);return s;
}

export async function prepareSingleUser(base,saved){
 const initial=await singleUser(base);
 if(!saved)return {base:initial,saved:{generation:0,state:initial},changed:true};
 const migrated=await singleUser(upgrade(saved.state,base));
 return {base:initial,saved:{generation:saved.generation+(saved.state.demo.single_user===1?0:1),state:migrated},changed:saved.state.demo.single_user!==1};
}
