export function bindMediaFragment(params,t){
 const player=document.getElementById('session-player-0');if(!player)return;
 const snap=t.entity_revision.find(x=>x.id===params.get('segment'))?.snapshot;
 if(!snap||snap.representation_id!==params.get('media'))return;
 const start=snap.start_ms/1000,end=snap.end_ms/1000;
 const seek=()=>{player.currentTime=start;};if(player.readyState>=1)seek();else player.addEventListener('loadedmetadata',seek,{once:true});
 player.addEventListener('timeupdate',()=>{if(player.currentTime>=end){player.pause();}});
 player.addEventListener('play',()=>{if(player.currentTime<start||player.currentTime>=end)seek();});
 document.querySelector('[data-fragment-status]')?.scrollIntoView({block:'center'});
}
export function fragmentLink(pg,session,rep,revision){return pg(8,{role:'R01',id:session,section:'media',media:rep,segment:revision});}
