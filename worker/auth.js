import {one,run} from './db.js';
export class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
export function requireRole(user,...roles){if(!user)throw new HttpError(401,'Please sign in to continue.');if(!roles.includes(user.role))throw new HttpError(403,'This action is not available for your account.');}
export async function identity(request,env){
 const authId=request.headers.get('oai-authenticated-user-id');const email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
 if(!authId||!email)return null;
 let user=await one(env,'SELECT * FROM users WHERE auth_id=?',authId);
 if(!user){
  const invited=await one(env,'SELECT * FROM users WHERE email=?',email);
  if(invited){
   if(!invited.active)throw new HttpError(403,'This account is inactive. Please contact your administrator.');
   if(invited.auth_id&&invited.auth_id!==authId)throw new HttpError(403,'This email is already linked to another account.');
   await run(env,'UPDATE users SET auth_id=?,version=version+1 WHERE id=? AND auth_id IS NULL',authId,invited.id);
  }else{
   let name=email;const encoded=request.headers.get('oai-authenticated-user-full-name');
   if(encoded&&request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(encoded).slice(0,100);}catch{}}
   const owner=!!env.CRM_OWNER_EMAIL&&email===env.CRM_OWNER_EMAIL.trim().toLowerCase();
   await run(env,'INSERT OR IGNORE INTO users (id,auth_id,email,name,role,active,is_owner,created_at,version) VALUES (?,?,?,?,?,1,?,?,1)',crypto.randomUUID(),authId,email,name,owner?'admin':'customer',owner?1:0,new Date().toISOString());
  }
  user=await one(env,'SELECT * FROM users WHERE auth_id=?',authId);
 }
 if(!user||!user.active)throw new HttpError(403,'This account is inactive. Please contact your administrator.');
 if(env.CRM_OWNER_EMAIL&&email===env.CRM_OWNER_EMAIL.trim().toLowerCase()&&!user.is_owner){await run(env,"UPDATE users SET role='admin',is_owner=1,version=version+1 WHERE id=?",user.id);user={...user,role:'admin',is_owner:1,version:user.version+1};}
 const preview=new URL(request.url).searchParams.get('view');
 if(preview&&(!['admin','employee','customer'].includes(preview)||user.role!=='admin'))throw new HttpError(403,'Role preview is available to administrators only.');
 return {...user,actualRole:user.role,role:preview||user.role,preview:!!preview&&preview!==user.role};
}
export function enquiryScope(user,alias='e'){
 if(user.role==='admin')return {sql:'1=1',params:[]};
 if(user.role==='employee')return {sql:`${alias}.assigned_to=?`,params:[user.id]};
 return {sql:`${alias}.customer_id=?`,params:[user.id]};
}
export async function accessibleEnquiry(env,user,id){requireRole(user,'admin','employee','customer');const scope=enquiryScope(user);const row=await one(env,`SELECT e.* FROM enquiries e WHERE e.id=? AND ${scope.sql}`,id,...scope.params);if(!row)throw new HttpError(404,'Enquiry not found.');return row;}
