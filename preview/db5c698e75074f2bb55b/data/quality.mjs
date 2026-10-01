import {fileBytes} from './binary.mjs?v=20261001-wf13';
import {plannedOutputs} from './capture-preparation.mjs?v=20261001-wf13';
import {captureFormats,captureFileProblem} from './digitization.mjs?v=20261001-wf13';
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
export const qualityDigest=r=>digest(new TextEncoder().encode(JSON.stringify(r)));
export function measureFile(bytes,mime){
 const b=bytes,v=new DataView(b.buffer,b.byteOffset,b.byteLength),ascii=(i,n)=>String.fromCharCode(...b.slice(i,i+n)),m={format:captureFormats[mime]||mime},notes=[];let structure='unknown';
 try{
  if(mime==='image/png'){
   if(b.length<33||ascii(12,4)!=='IHDR')throw Error('Немає заголовка PNG');
   m.width=v.getUint32(16);m.height=v.getUint32(20);m.sample_depth=b[24];m.color_type=b[25];m.bit_depth=b[24]*({0:1,2:3,3:1,4:2,6:4}[b[25]]||0);m.color_mode=b[25]===0&&b[24]===1?'monochrome':[0,4].includes(b[25])?'grayscale':[2,6].includes(b[25])?'RGB':'indexed';
   let p=8,end=false,data=false;while(p+12<=b.length){const size=v.getUint32(p),type=ascii(p+4,4);if(p+12+size>b.length)throw Error('Обрізаний блок PNG');if(type==='pHYs'&&size===9&&b[p+16]===1){m.resolution_ppi=Math.round(v.getUint32(p+8)*0.0254);m.resolution_y_ppi=Math.round(v.getUint32(p+12)*0.0254);}if(type==='IDAT')data=true;if(type==='IEND'){end=true;break;}p+=12+size;}
   if(!end||!data||!m.width||!m.height||!m.bit_depth)throw Error('Неповна структура PNG');structure='pass';notes.push('PNG: IHDR/pHYs і межі блоків; без перевірки CRC та декодування пікселів.');
  }else if(['audio/wav','audio/x-wav'].includes(mime)){
   if(b.length<44||ascii(0,4)!=='RIFF'||ascii(8,4)!=='WAVE'||v.getUint32(4,true)+8>b.length)throw Error('Обрізаний WAV');let p=12,fmt=false,data=null,align=null;
   while(p+8<=b.length){const type=ascii(p,4),size=v.getUint32(p+4,true),at=p+8;if(at+size>b.length)throw Error('Обрізаний блок WAV');if(type==='fmt '&&size>=16){m.encoding=v.getUint16(at,true);m.channels=v.getUint16(at+2,true);m.sample_rate_hz=v.getUint32(at+4,true);align=v.getUint16(at+12,true);m.bit_depth=v.getUint16(at+14,true);fmt=true;}if(type==='data')data={at,size};p=at+size+(size%2);}
   if(!fmt||!data||!align||!m.channels||!m.sample_rate_hz||!m.bit_depth||data.size%align)throw Error('Неповний WAV');m.duration_ms=Math.round(data.size/align/m.sample_rate_hz*1000);structure='pass';
   if(m.encoding===1&&m.bit_depth===16){let peak=0,clipped=0;for(let at=data.at;at<data.at+data.size;at+=2){const value=Math.abs(v.getInt16(at,true));peak=Math.max(peak,value);if(value>=32767)clipped++;}m.peak_dbfs=peak?Math.round(20*Math.log10(peak/32768)*100)/100:null;m.clipped_samples=clipped;}
   notes.push('WAV: RIFF/fmt/data, тривалість; пік і граничні семпли для PCM 16-bit.');
  }else if(mime==='image/jpeg'){
   let p=2;while(p+4<b.length){if(b[p++]!==255)continue;const marker=b[p++];if(marker===217||marker===218)break;const length=v.getUint16(p);if(length<2||p+length>b.length)throw Error('Обрізаний JPEG');if([192,193,194].includes(marker)){m.height=v.getUint16(p+3);m.width=v.getUint16(p+5);m.bit_depth=b[p+2]*b[p+7];m.color_mode=b[p+7]===1?'grayscale':'RGB';}if(marker===224&&ascii(p+2,5)==='JFIF\0'){const unit=b[p+9];if(unit===1||unit===2)m.resolution_ppi=Math.round(v.getUint16(p+10)*(unit===2?2.54:1));}p+=length;}
   if(!m.width||!m.height)throw Error('Немає розмірів JPEG');structure='pass';notes.push('JPEG: SOF/JFIF; декодування перевіряється окремо.');
  }else notes.push('Повного аналізатора цього формату немає. Потрібні перегляд і зовнішня перевірка невиміряних параметрів.');
 }catch(error){structure='fail';notes.push(error.message);}
 return {measured:m,structure,notes};
}
export async function qualityReport(s,rep){
 const t=s.tables,rev=id=>t.entity.find(x=>x.id===id)?.current_revision_id,cap=t.capture_event.find(x=>x.id===rep.technical_metadata?.capture_event_id),plan=cap?.settings?.capture_plan_revision_id?plannedOutputs(s,cap.settings.capture_plan_revision_id):[],profile=cap?.settings?.capture_profile;
 const rows=t.representation_file.filter(x=>x.representation_id===rep.id).sort((a,b)=>a.position-b.position),files=[];
 for(const row of rows){const f=t.file_object.find(x=>x.id===row.file_id),content=s.demo.file_contents[f.id];let bytes=null,observed_hash=null,analysis={measured:{format:captureFormats[f.mime_type]||f.mime_type},structure:'unknown',notes:['Байти недоступні.']};
  try{if(content===undefined)throw Error('missing');bytes=fileBytes(content);observed_hash=await digest(bytes);analysis=measureFile(bytes,f.mime_type);if(captureFormats[f.mime_type]&&captureFileProblem({mime_type:f.mime_type,content},f.mime_type.split('/')[0])){analysis.structure='fail';analysis.notes.push('Заголовок не відповідає MIME.');}}catch{}
  const comparisons=Object.entries(profile||{}).filter(([key])=>!['kind','device'].includes(key)).map(([key,expected])=>{const actual=analysis.measured[key],equal=key==='format'&&expected==='BWF'&&actual==='WAV'?null:actual===undefined?null:typeof expected==='number'&&key==='resolution_ppi'?Math.abs(expected-actual)<=1:actual===expected;return {key,expected,actual:actual??null,result:equal===null?'unknown':equal?'pass':'fail'};});
  files.push({kind_match:!!plan[row.position-1]&&f.mime_type.startsWith(plan[row.position-1].kind+'/'),file_id:f.id,filename:f.original_filename,position:row.position,label:row.component_label,mime_type:f.mime_type,expected_hash:f.sha256,observed_hash,expected_size:f.byte_size,observed_size:bytes?.length??null,checksum:observed_hash===f.sha256&&bytes?.length===f.byte_size?'pass':'fail',...analysis,comparisons,parameters:comparisons.some(x=>x.result==='fail')?'fail':!comparisons.length||comparisons.some(x=>x.result==='unknown')?'unknown':'pass'});
 }
 const expected=plan.map((x,i)=>({position:i+1,label:x.label})),missing=expected.filter(x=>!rows.some(r=>r.position===x.position)),extra=rows.filter(x=>!expected.some(p=>p.position===x.position));
 return {contract:'quality/1',representation_id:rep.id,representation_revision_id:rev(rep.id),capture_revision_id:rev(cap?.id)||null,capture_plan_revision_id:cap?.settings?.capture_plan_revision_id||null,previous_qc_id:t.qc_record.filter(x=>x.representation_revision_id===rev(rep.id)).at(-1)?.id||null,expected,missing,extra:extra.map(x=>x.position),complete:!!plan.length&&!missing.length&&!extra.length&&rows.length===expected.length,order:!!plan.length&&!extra.length&&rows.every(r=>expected.some(p=>p.position===r.position&&p.label===r.component_label)),integrity:!!files.length&&files.every(x=>x.checksum==='pass'),files};
}
export async function qualityCommand(s,actor,c,h){
 const {get,fresh,newEntity,revise,fail,run}=h,t=s.tables,by=(k,id)=>t[k].find(x=>x.id===id),rev=id=>by('entity',id)?.current_revision_id,rep=get('representation',c.id);fresh(rep.id,c.expected_revision_id);
 const report=await qualityReport(s,rep),accepted=['pass','pass_with_note'].includes(c.outcome),cap=t.capture_event.find(x=>x.id===rep.technical_metadata?.capture_event_id),archive=by('entity',rep.id).archive_id;
 if(!['pass','pass_with_note','recapture_required','incomplete'].includes(c.outcome))fail('invalid','Оберіть висновок.');
 if(accepted&&(!report.complete||!report.order||!report.integrity))fail('blocked','Приймання потребує всіх частин, правильного порядку й збігу контрольних сум.');
 if(c.expected_report_hash!==await qualityDigest(report))fail('stale','Результат або попередній висновок змінився. Повторіть перевірку.');
 const reviews=c.reviews&&structuredClone(c.reviews);if(!Array.isArray(reviews)||reviews.length!==report.files.length||new Set(reviews.map(x=>x.file_id)).size!==report.files.length||reviews.some(x=>!report.files.some(f=>f.file_id===x.file_id)||!['pass','fail','unknown'].includes(x.readability)||!['pass','fail','unknown'].includes(x.parameters)))fail('invalid','Перевірте кожен файл результату.');
 if(c.confirm!==true)fail('invalid','Підтвердьте перевірку саме цього результату.');
 if(!c.notes?.trim())fail('invalid','Запишіть підставу висновку.');
 if(accepted&&c.order_confirmed!==true)fail('blocked','Підтвердьте візуальну або слухову відповідність частин плану.');
 for(const f of report.files){const review=reviews.find(x=>x.file_id===f.file_id),probe=review.browser_probe;
  review.browser_comparisons=['width','height'].filter(key=>cap?.settings?.capture_profile?.[key]!==undefined&&Number.isFinite(probe?.[key])).map(key=>({key,expected:cap.settings.capture_profile[key],actual:probe[key],result:probe[key]===cap.settings.capture_profile[key]?'pass':'fail'}));
  if(probe&&!['pass','fail','unsupported'].includes(probe.result))fail('invalid','Невідомий результат перегляду.');
  if(accepted){
   if(!f.kind_match)fail('blocked','Вид файла не відповідає частині плану; потрібен фактичний медіарезультат.');
   if(f.structure==='fail')fail('blocked','Файл має пошкоджену структуру; потрібна повторна фіксація.');
   if(!review.evidence_note?.trim()||['unknown'].includes(review.readability)||review.parameters==='unknown')fail('blocked','Завершіть пофайловий огляд і запишіть доказ.');
   if((f.parameters==='unknown'||!probe||probe.result!=='pass')&&!review.external_review?.trim())fail('blocked','Задокументуйте зовнішню перевірку невиміряних параметрів або непідтримуваного перегляду.');
   if(c.outcome==='pass'&&(f.parameters==='fail'||review.browser_comparisons.some(x=>x.result==='fail')||review.readability==='fail'||review.parameters==='fail'||probe?.result==='fail'))fail('blocked','Є невідповідність або дефект. Повторіть фіксацію або обґрунтуйте приймання із зауваженням.');
  }
 }
 if(c.outcome==='pass_with_note'&&(!c.defect_note?.trim()||c.better_unavailable!==true))fail('blocked','Опишіть відомий дефект і підтвердьте, що кращий результат недоступний.');
 if(c.outcome==='pass'&&c.defect_note?.trim())fail('invalid','Для відомого дефекту оберіть приймання із зауваженням.');
 const workflow=run('WF-12',rep.id),qc=await newEntity('qc_record',{representation_revision_id:rev(rep.id),digitization_job_id:cap?.digitization_job_id||null,reviewer_person_id:by('account',actor).person_id,checked_at:new Date().toISOString(),outcome:c.outcome,notes:c.notes.trim()},archive);
 const evidence=await newEntity('evidence',{source_entity_id:rep.id,source_revision_id:rev(rep.id),external_uri:null,locator:'Пофайловий звіт контролю якості',quote_text:null,note:c.notes.trim(),captured_at:qc.checked_at},archive);
 const check=(code,result,value,note=null)=>t.qc_check_item.push({qc_record_id:qc.id,check_code:code,result,measured_value:value,note,evidence_id:evidence.id});
 check('completeness',report.complete?'pass':'fail',{expected:report.expected,missing:report.missing,extra:report.extra});check('order',report.order&&c.order_confirmed?'pass':'unknown',{expected:report.expected,confirmed:c.order_confirmed===true});check('checksum',report.integrity?'pass':'fail',report.files.map(x=>({file_id:x.file_id,expected:x.expected_hash,observed:x.observed_hash,size:x.observed_size})));
 check('parameters',report.files.some(x=>x.parameters==='fail')||reviews.some(x=>x.parameters==='fail'||x.browser_comparisons.some(y=>y.result==='fail'))?'fail':reviews.every(x=>x.parameters==='pass')?'pass':'unknown',{contract:'quality/1',report,report_hash:await qualityDigest(report),reviews,defect_note:c.defect_note?.trim()||null,better_unavailable:c.better_unavailable===true,workflow_run_id:workflow.id});
 check('readability',reviews.every(x=>x.readability==='pass')?'pass':reviews.some(x=>x.readability==='fail')?'fail':'unknown',reviews.map(x=>({file_id:x.file_id,result:x.readability,evidence_note:x.evidence_note||null,browser_probe:x.browser_probe||null,external_review:x.external_review||null})));
 await revise(qc,'Збережено вимірювання та рішення щодо версії');t.evidence_link.push({subject_entity_id:qc.id,subject_revision_id:rev(qc.id),evidence_id:evidence.id,evidence_role:'qc'});
 const linked=id=>t.work_item_target.some(x=>x.work_item_id===id&&x.entity_id===rep.id);
 if(!accepted){let issue=t.work_item.find(x=>x.kind==='quality_review'&&linked(x.id)&&!['done','cancelled'].includes(x.state));const from=issue?.state||null;
  if(!issue){issue=await newEntity('work_item',{workflow_run_id:workflow.id,kind:'quality_review',title:(c.outcome==='incomplete'?'Доповнити результат: ':'Повторити фіксацію: ')+by('media_asset',rep.asset_id).title,state:'open',assigned_account_id:actor,assigned_role_id:null,due_at:null,resolution:null},archive);t.work_item_target.push({work_item_id:issue.id,entity_id:rep.id,revision_id:rev(rep.id)});}
  t.work_item_event.push({work_item_id:issue.id,from_state:from,to_state:issue.state,actor_account_id:actor,occurred_at:qc.checked_at,reason:c.notes.trim()});
 }else{
  const targets=new Set([rep.id]),captureWorkflows=new Set([cap?.settings?.workflow_run_id].filter(Boolean));let prior=cap,visited=new Set();while(prior&&!visited.has(prior.id)){visited.add(prior.id);const old=t.entity_revision.find(x=>x.id===prior.settings?.previous_capture_revision_id);prior=old&&by('capture_event',old.entity_id);if(prior?.digitization_job_id!==cap?.digitization_job_id)break;const r=prior&&t.representation.find(x=>x.technical_metadata?.capture_event_id===prior.id);if(r)targets.add(r.id);if(prior?.settings?.workflow_run_id)captureWorkflows.add(prior.settings.workflow_run_id);}
  for(const issue of t.work_item.filter(x=>(x.kind==='quality_review'||x.kind==='technical_issue'&&captureWorkflows.has(x.workflow_run_id))&&!['done','cancelled'].includes(x.state)&&t.work_item_target.some(y=>y.work_item_id===x.id&&targets.has(y.entity_id)))){const from=issue.state;issue.state='done';issue.resolution='Прийнято результат; перевірка '+qc.id;await revise(issue,issue.resolution);t.work_item_event.push({work_item_id:issue.id,from_state:from,to_state:'done',actor_account_id:actor,occurred_at:qc.checked_at,reason:issue.resolution});}
 }
 workflow.state='completed';workflow.finished_at=qc.checked_at;workflow.notes=c.notes.trim();return qc;
}
export function validateQuality(s,ok){
 const t=s.tables;
 for(const q of t.qc_record){const measured=t.qc_check_item.find(x=>x.qc_record_id===q.id&&x.check_code==='parameters')?.measured_value;if(measured?.contract!=='quality/1')continue;
  ok(measured.report.representation_revision_id===q.representation_revision_id,'Звіт іншого представлення');
  ok(t.qc_check_item.filter(x=>x.qc_record_id===q.id).length===5,'Неповний звіт QC');
  ok(measured.report.files.length===measured.reviews.length,'Неповний пофайловий огляд');
  if(['pass','pass_with_note'].includes(q.outcome))ok(measured.report.complete&&measured.report.order&&measured.report.integrity,'Приймання неповного результату');
  if(q.outcome==='pass_with_note')ok(!!measured.defect_note&&measured.better_unavailable,'Приймання дефекту без підстави');
 }
}
