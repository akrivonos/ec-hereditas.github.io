export const MAX_MEDIA_BYTES=2*1024*1024;
export function fileBytes(content){
 if(content&&typeof content==='object'){
  if(content.encoding!=='base64'||typeof content.data!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(content.data))throw new Error('Некоректні байти файла.');
  return Uint8Array.from(atob(content.data),x=>x.charCodeAt(0));
 }
 return new TextEncoder().encode(content);
}
export const mediaMime=m=>/^(audio\/(wav|x-wav|mpeg|ogg|webm|mp4)|video\/(webm|mp4|ogg)|image\/(png|jpeg|webp))$/.test(m);
export function mediaUrl(content,mime){return content?.encoding==='base64'&&mediaMime(mime)?'data:'+mime+';base64,'+content.data:null;}
