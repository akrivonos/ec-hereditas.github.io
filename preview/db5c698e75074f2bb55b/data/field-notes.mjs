// Field notes are individual documents in a shared research context.
export const isFieldNote = row => ['field_note','field_notebook'].includes(row?.kind);
export function noteResearch(t,row){return row.research_id||t.document_context.find(c=>c.document_id===row.id&&c.context_role==='research')?.target_entity_id;}
export function noteAuthor(t,row){return row.author_account_id||t.entity_revision.find(r=>r.entity_id===row.id&&r.revision_no===1)?.actor_account_id||null;}
export function noteCreated(t,row){return row.created_at||t.entity_revision.find(r=>r.entity_id===row.id&&r.revision_no===1)?.recorded_at||null;}
export function noteDate(value,zone='Europe/Kyiv'){
 if(!value)return 'Дата невідома';
 return new Intl.DateTimeFormat('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:zone}).format(new Date(value)).replace(',', '');
}
export function researchTeamAccess(s,actor,researchId){
 const t=s.tables,account=t.account.find(a=>a.id===actor&&a.state==='active');
 if(!account||!t.field_research.some(r=>r.id===researchId))return false;
 // The single-account preview has installation-wide access. Real API membership
 // must be checked by the server and must not inherit this demo exception.
 if(s.demo.single_user===1&&actor===s.demo.default_actor)return true;
 return t.role_assignment.some(g=>g.account_id===actor&&g.scope_kind==='research'&&g.scope_entity_id===researchId&&(!g.valid_until||Date.parse(g.valid_until)>Date.parse(s.clock)))||t.participation.some(p=>p.person_id===account.person_id&&p.role_code==='collector'&&(p.research_id===researchId||t.collecting_session.some(x=>x.id===p.session_id&&x.research_id===researchId)));
}
export async function fieldNoteCommand(s,actor,c,{fail,fresh,newEntity,revise,arch}){
 const t=s.tables,research=t.field_research.find(r=>r.id===c.research_id);
 if(!researchTeamAccess(s,actor,research?.id))fail('forbidden','Нотатки доступні команді дослідження.');
 let row=c.id&&t.document.find(d=>d.id===c.id);
 if(c.id){
  if(!isFieldNote(row)||noteResearch(t,row)!==research.id||noteAuthor(t,row)!==actor)fail('forbidden','Редагувати нотатку може лише її автор.');
  fresh(row.id,c.expected_revision_id);
 }
 const text=String(c.body_text||'').trim(),title=String(c.title||'').trim();
 if(!text)fail('invalid','Додайте текст нотатки.');
 if(title.length>240)fail('invalid','Назва має містити не більше 240 символів.');
 const now=new Date().toISOString(),created=row?noteCreated(t,row):now;
 const zone=row?.created_timezone||'Europe/Kyiv';
 const values={kind:'field_note',research_id:research.id,author_account_id:actor,created_at:created,created_timezone:zone,updated_at:now,note_title:title||null,title:title||noteDate(created,zone),body_text:text};
 if(row)Object.assign(row,values);
 else row=await newEntity('document',{...values,language_tag:'uk',media_asset_id:null,physical_object_id:null},arch(research.id));
 if(!t.document_context.some(x=>x.document_id===row.id&&x.context_role==='research'))t.document_context.push({document_id:row.id,target_entity_id:research.id,context_role:'research',target_revision_id:null});
 // Existing group/session links remain as provenance, never as new note inputs.
 await revise(row,'Збережено польову нотатку');return {id:row.id};
}
export function validateFieldNotes(s,require,fk){
 for(const row of s.tables.document.filter(d=>d.kind==='field_note')){
  fk('field_research',row.research_id);fk('account',row.author_account_id);
  require(!!row.body_text?.trim(),'Порожня польова нотатка');
  require(Number.isFinite(Date.parse(row.created_at))&&Number.isFinite(Date.parse(row.updated_at)),'Дата нотатки');
  require(s.tables.document_context.some(x=>x.document_id===row.id&&x.context_role==='research'&&x.target_entity_id===row.research_id),'Дослідження нотатки');
 }
}
