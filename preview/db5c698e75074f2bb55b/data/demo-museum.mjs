// Optional synthetic walkthrough; uses domain commands and commits as one transaction.
import {museumCommand,museumOwned,museumMaterials} from './museum.mjs?v=20261002-wf16';

export async function prepareMuseumDemo(s,actor,ctx){
 const t=s.tables,ids=s.demo.ids,archive=ids['archive-a'];
 ctx.need('museum.write',archive);
 if(actor!==ids.museum)ctx.fail('forbidden','Оберіть користувача прикладу Наталю Берегову.');
 const saved=s.demo.external_configuration.museum_walkthrough;
 if(saved&&museumOwned(s,actor,saved.exhibition_id))return saved;
 const institution=t.institution.find(x=>t.entity.some(e=>e.id===x.id&&e.archive_id===archive));
 const materials=museumMaterials(s),keys=['public-museum-notes','public-museum-programme'];
 if(!institution||keys.some(k=>!materials.some(x=>x.id===ids[k])))ctx.fail('invalid','Матеріали прикладу зараз недоступні. Їхні дозволи не будуть змінені.');
 const run=c=>museumCommand(s,actor,c,ctx),revision=id=>t.entity.find(x=>x.id===id).current_revision_id;
 const exhibition=await run({type:'museum.exhibition.create',archive_id:archive,institution_id:institution.id,title:'Лугове: предмети та пам’ять',opens_on:'2026-09-01'});
 const examples=[
  {key:keys[0],title:'Сторінки польового записника',exhibit:'Польовий записник',number:'ЛГ-001',note:'Записник пов’язує музейний предмет із польовими записами Лугового. Відкрийте джерело, щоб прочитати оприлюднений текст.',kind:'printed_qr'},
  {key:keys[1],title:'Як досліджували традиції Лугового',exhibit:'Матеріали польового дослідження',number:'ЛГ-002',note:'План дослідження пояснює, які теми вивчали збирачі та як готували роботу в селі.',kind:'kiosk'}
 ];
 const sets=[],points=[];
 for(const x of examples){
  const pub=materials.find(p=>p.id===ids[x.key]);
  const set=await run({type:'museum.set.create',exhibition_id:exhibition.id,title:x.title,exhibit_title:x.exhibit,museum_inventory_number:x.number,items:[{publication_id:pub.id,publication_revision_id:pub.revision_id,link_reason:'same_ethnographic_region',reason_note:'Матеріал із Лугового пояснює контекст експоната.'}],texts:[{language_tag:'uk',title:x.title,curator_note:x.note,is_default:true}]});
  await run({type:'museum.set.review',id:set.id,expected_revision_id:revision(set.id),confirm:true,reason:'Підготовлено синтетичний приклад для перевірки музейного сценарію.'});
  const point=await run({type:'museum.point.create',exhibition_id:exhibition.id,set_id:set.id,set_revision_id:revision(set.id),kind:x.kind,reason:'Точка синтетичного прикладу для перегляду.'});
  sets.push(set.id);points.push(point.id);
 }
 await run({type:'museum.exhibition.state',id:exhibition.id,expected_revision_id:revision(exhibition.id),state:'open',reason:'Відкрито синтетичний приклад для перевірки.'});
 const result={exhibition_id:exhibition.id,set_ids:sets,point_ids:points};
 s.demo.external_configuration.museum_walkthrough=result;
 return result;
}
