export function db(env){if(!env.DB)throw new Error('Database is unavailable');return env.DB;}
export async function one(env,sql,...params){return db(env).prepare(sql).bind(...params).first();}
export async function all(env,sql,...params){return (await db(env).prepare(sql).bind(...params).all()).results;}
export async function run(env,sql,...params){return db(env).prepare(sql).bind(...params).run();}
export function statement(env,sql,...params){return db(env).prepare(sql).bind(...params);}
