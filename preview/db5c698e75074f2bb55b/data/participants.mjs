const prefix=role=>({performer:'Р',collector:'З',observer:'П'})[role]||'П';
export function participantCodes(t,session){
 const rows=t.participation.filter(p=>p.session_id===session),used=new Set(rows.flatMap(p=>[p.participant_code,...(p.previous_codes||[])].filter(Boolean))),result=new Map();
 for(const p of rows){let code=p.participant_code;if(!code){const pre=prefix(p.role_code);let n=1;while(used.has(pre+'-'+n))n++;code=pre+'-'+n;used.add(code);}result.set(p.id,code);}return result;
}
export function nextParticipantCode(t,session,role){const used=new Set([...participantCodes(t,session).values(),...t.participation.filter(p=>p.session_id===session).flatMap(p=>p.previous_codes||[])]);let n=1;while(used.has(prefix(role)+'-'+n))n++;return prefix(role)+'-'+n;}
export async function persistParticipantCodes(t,session,revise){for(const [id,code] of participantCodes(t,session)){const p=t.participation.find(p=>p.id===id);if(!p.participant_code){p.participant_code=code;await revise(p,'Зафіксовано позначення учасника');}}}
export function setUnitParticipants(t,unit,ids,fail){
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length)fail('invalid','Перевірте вибір учасників.');
 const rows=ids.map(id=>t.participation.find(p=>p.id===id));if(rows.some(p=>!p||p.session_id!==unit.session_id||!['performer','collector'].includes(p.role_code)))fail('invalid','Оберіть учасників цього сеансу.');
 t.unit_participant=t.unit_participant.filter(p=>p.unit_id!==unit.id||!['performer','collector'].includes(p.role_code)||!p.session_participation_id&&!t.participation.some(x=>x.session_id===unit.session_id&&x.person_id===p.person_id&&x.role_code===p.role_code));rows.forEach((p,i)=>t.unit_participant.push({unit_id:unit.id,person_id:p.person_id,session_participation_id:p.id,role_code:p.role_code,position:i+1}));
}
export function unitPeople(t,unit,label){const codes=participantCodes(t,unit.session_id);return t.unit_participant.filter(p=>p.unit_id===unit.id).map(p=>[codes.get(p.session_participation_id),label(p.person_id)].filter(Boolean).join(' · ')).join(', ')||'Виконавців не зазначено';}
