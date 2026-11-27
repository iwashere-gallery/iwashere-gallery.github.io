export async function openGitHubGallery(repository, token) {
 if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw Error('Enter the repository name.');
 const baseURL = 'https://api.github.com/repos/' + repository;
 async function api(path, method='GET', body) {
  if(method!=='GET'&&!token)throw Error('Enter a repository token.');
  const headers={Accept:'application/vnd.github+json','Content-Type':'application/json'};
  if(token)headers.Authorization='Bearer '+token;
  const response = await fetch(baseURL + path, {
   method, redirect:'error', cache:'no-store', credentials:'omit',
   headers,
   body:body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) throw Error('GitHub '+response.status+' · '+(await response.json()).message);
  return response.json();
 }
 const branch = encodeURIComponent((await api('')).default_branch);
 const head = (await api('/git/ref/heads/'+branch)).object.sha;
 const base = (await api('/git/commits/'+head)).tree.sha;
 async function read(name) {
  const file = await api('/contents/docs/'+name+'?ref='+encodeURIComponent(head));
  return new TextDecoder().decode(Uint8Array.from(atob(file.content), c=>c.charCodeAt(0)));
 }
 if ((await read('gallery-id.txt')).trim() !== 'liwangxushen-photo-gallery-v1') throw Error('This repository does not contain the gallery.');
 const gallery = JSON.parse(await read('gallery.json'));
 if (!Array.isArray(gallery)) throw Error('Invalid gallery.json');
 async function commit(tree,message) {
  const update = await api('/git/trees','POST',{base_tree:base,tree});
  const revision = await api('/git/commits','POST',{message,tree:update.sha,parents:[head]});
  await api('/git/refs/heads/'+branch,'PATCH',{sha:revision.sha,force:false});
 }
 return {gallery,api,commit};
}

export async function removeGitHubWork(snapshot,id) {
 const work=snapshot.gallery.find(item=>item.id===id);
 if (!work) return false;
 const keep=snapshot.gallery.filter(item=>item.id!==id);
 const paths=item=>[item.preview,item.detail,item.signed].filter(Boolean);
 const shared=new Set(keep.flatMap(paths));
 const tree=[];
 for (const path of new Set(paths(work))) {
  if (!/^media\/[\w-]+\.jpg$/.test(path)) throw Error('Unexpected photo path');
  if (!shared.has(path)) tree.push({path:'docs/'+path,mode:'100644',type:'blob',sha:null});
 }
 tree.push({path:'docs/gallery.json',mode:'100644',type:'blob',content:JSON.stringify(keep)});
 await snapshot.commit(tree,'Remove gallery photograph '+id);
 return true;
}
