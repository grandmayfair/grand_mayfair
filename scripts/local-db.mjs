import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
export function localDatabase(filename=':memory:'){
 const database=new DatabaseSync(filename);database.exec('PRAGMA foreign_keys=ON;');
 database.exec('CREATE TABLE IF NOT EXISTS local_migrations (filename TEXT PRIMARY KEY)');
 for(const file of fs.readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort()){if(!database.prepare('SELECT filename FROM local_migrations WHERE filename=?').get(file)){database.exec(fs.readFileSync(`drizzle/${file}`,'utf8'));database.prepare('INSERT INTO local_migrations VALUES (?)').run(file);}}
 function prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){return database.prepare(sql).get(...values)||null;},async all(){return {results:database.prepare(sql).all(...values)};},async run(){const result=database.prepare(sql).run(...values);return {success:true,meta:{changes:Number(result.changes)}};}};}
 return {prepare,async batch(statements){database.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());database.exec('COMMIT');return results;}catch(error){database.exec('ROLLBACK');throw error;}},close(){database.close();},raw:database};
}
