import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function localDatabase(filename=':memory:'){
 const db=new DatabaseSync(filename);
 if(!db.prepare("SELECT name FROM sqlite_schema WHERE name='messages'").get())db.exec(readFileSync('drizzle/0000_guestbook.sql','utf8'));
 if(!db.prepare("SELECT name FROM sqlite_schema WHERE name='download_events'").get())db.exec(readFileSync('drizzle/0001_photo_downloads.sql','utf8'));
 if(!db.prepare("SELECT name FROM sqlite_schema WHERE name='removed_works'").get())db.exec(readFileSync('drizzle/0002_removed_works.sql','utf8'));
 function prepare(sql,args=[]){
  const statement=db.prepare(sql);
  return {bind:(...values)=>prepare(sql,values),first:()=>statement.get(...args),all:()=>({results:statement.all(...args)}),run:()=>statement.run(...args)};
 }
 return {prepare,batch:queries=>queries.map(query=>query.all())};
}
