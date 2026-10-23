import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function database(through=Infinity){
 const sqlite=new DatabaseSync(':memory:');
 for(const name of readdirSync(new URL('../../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')&&parseInt(n)<=through).sort())sqlite.exec(readFileSync(new URL('../../migrations/'+name,import.meta.url),'utf8'));
 const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return {meta:{changes:sqlite.prepare(sql).run(...args).changes}};}};},async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 return {DB,sqlite};
}
