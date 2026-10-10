import {one,all,run,statement,db} from './db.js';
import {identity,requireRole,enquiryScope,accessibleEnquiry,HttpError} from './auth.js';
import {defaultSettings,defaultDestinations} from './data.js';

const now=()=>new Date().toISOString();
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const id=()=>crypto.randomUUID();
const reference=prefix=>`${prefix}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
const roles=['customer','employee'];
const enquiryStatuses=['new','contacted','qualified','converted','closed'];
const bookingStatuses=['requested','quoted','confirmed','completed','cancelled'];
function fail(message,status=400){throw new HttpError(status,message);}
function str(body,key,max=200,required=false){const value=body[key]??'';if(typeof value!=='string')fail(`${key} must be text.`);const result=value.trim();if(result.length>max||(required&&!result))fail(`Please enter a valid ${key.replaceAll('_',' ')}.`);return result;}
function num(body,key,max=10000000000,defaultValue=0){const value=body[key]??defaultValue;if(!Number.isSafeInteger(value)||value<0||value>max)fail(`Please enter a valid ${key.replaceAll('_',' ')}.`);return value;}
function choice(body,key,choices,defaultValue){const value=body[key]??defaultValue;if(!choices.includes(value))fail(`Choose a valid ${key.replaceAll('_',' ')}.`);return value;}
function day(body,key,required=false){const value=str(body,key,10,required);if(!value)return null;const parsed=new Date(`${value}T12:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)fail(`Choose a valid ${key.replaceAll('_',' ')} date.`);return value;}
function email(body){const value=str(body,'email',254,true).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))fail('Enter a valid email address.');return value;}
function dateRange(start,end){if((start&&!end)||(!start&&end)||(start&&end&&end<=start))fail('End date must be after the start date.');}
function fields(body,allowed){const unknown=Object.keys(body).filter(key=>!allowed.includes(key));if(unknown.length)fail('This request contains unsupported fields.');}
async function bodyJson(request){if(!request.headers.get('content-type')?.startsWith('application/json'))fail('Use a JSON request.');if(Number(request.headers.get('content-length'))>16000)fail('Request is too large.',413);const text=await request.text();if(text.length>16000)fail('Request is too large.',413);let body;try{body=JSON.parse(text);}catch{fail('Request could not be read.');}if(!body||Array.isArray(body)||typeof body!=='object')fail('Request could not be read.');return body;}
function sameOrigin(request){const origin=request.headers.get('Origin');if(origin!==new URL(request.url).origin)fail('Request origin is not permitted.',403);}
function auditStatement(env,user,action,kind,recordId){return statement(env,'INSERT INTO audit_events (id,actor_id,action,entity_type,entity_id,created_at) SELECT ?,?,?,?,?,? WHERE changes()>0',id(),user.id,action,kind,recordId,now());}
async function saveRecord(env,user,table,values,recordId,version,guard={sql:'1=1',params:[]}){
 const keys=Object.keys(values);let operation;
 if(recordId){operation=statement(env,`UPDATE ${table} SET ${keys.map(key=>`${key}=?`).join(',')},version=version+1 WHERE id=? AND version=? AND ${guard.sql}`,...keys.map(key=>values[key]),recordId,version,...guard.params);}
 else{recordId=id();operation=statement(env,`INSERT INTO ${table} (${['id',...keys].join(',')}) SELECT ${['id',...keys].map(()=>'?').join(',')} WHERE ${guard.sql}`,recordId,...keys.map(key=>values[key]),...guard.params);}
 const result=await db(env).batch([operation,auditStatement(env,user,version?'updated':'created',table,recordId)]);
 if(!result[0].meta.changes)fail('This record or its assignment changed while you were editing. Refresh and try again.',409);
 return {id:recordId};
}
async function bootstrapCatalog(env,user){if(!user?.is_owner||user.role!=='admin')return;await db(env).batch(defaultDestinations.map(d=>statement(env,'INSERT OR IGNORE INTO destinations (id,slug,title,region,location,category,summary,description,image,nights,highlights,active,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)',d.id,d.slug,d.title,d.region,d.location,d.category,d.summary,d.description,d.image,d.nights,d.highlights,d.active)));}
async function settings(env){const saved=await all(env,'SELECT key,value FROM settings');return {...defaultSettings,...Object.fromEntries(saved.map(row=>[row.key,row.value]))};}
function safeUser(user){if(!user)return null;return {id:user.id,email:user.email,name:user.name,phone:user.phone,role:user.role,actualRole:user.actualRole,preview:user.preview};}
async function person(env,userId,role){const p=await one(env,'SELECT id,role,active FROM users WHERE id=?',userId);if(!p||!p.active||(role?p.role!==role:!['admin','employee'].includes(p.role)))fail('Choose an active account of the correct type.');return p;}

function recordQuery(user,kind){
 const e=enquiryScope(user);const staff=user.role==='admin'||user.role==='employee';
 if(kind==='enquiries')return {from:'enquiries e',where:e.sql,params:e.params,select:'e.*,u.name AS customer_name,a.name AS assignee_name',joins:' LEFT JOIN users u ON u.id=e.customer_id LEFT JOIN users a ON a.id=e.assigned_to',search:['e.reference','e.name','e.email','e.destination'],order:'e.created_at',status:'e.status'};
 if(kind==='bookings')return {from:'bookings b',where:e.sql,params:e.params,select:'b.*,e.customer_id,e.name AS customer_name,e.email,e.assigned_to',joins:' JOIN enquiries e ON e.id=b.enquiry_id',search:['b.reference','b.destination','b.property_name','e.name'],order:'b.created_at',status:'b.status'};
 if(kind==='memberships'){requireRole(user,'admin','customer');return {from:'memberships m',where:user.role==='admin'?'1=1':'m.customer_id=?',params:user.role==='admin'?[]:[user.id],select:'m.*,u.name AS customer_name',joins:' JOIN users u ON u.id=m.customer_id',search:['m.plan_name','u.name'],order:'m.created_at',status:'m.status'};}
 if(kind==='tasks'){requireRole(user,'admin','employee');return {from:'tasks t',where:user.role==='admin'?'1=1':'t.assigned_to=? AND (t.enquiry_id IS NULL OR EXISTS(SELECT 1 FROM enquiries e WHERE e.id=t.enquiry_id AND e.assigned_to=?))',params:user.role==='admin'?[]:[user.id,user.id],select:'t.*,a.name AS assignee_name,e.reference AS enquiry_reference',joins:' JOIN users a ON a.id=t.assigned_to LEFT JOIN enquiries e ON e.id=t.enquiry_id',search:['t.title','t.details','a.name'],order:'t.created_at',status:'t.status'};}
 if(kind==='users'){requireRole(user,'admin','employee');return {from:'users u',where:user.role==='admin'?'1=1':'u.role=\'customer\' AND EXISTS(SELECT 1 FROM enquiries e WHERE e.customer_id=u.id AND e.assigned_to=?)',params:user.role==='admin'?[]:[user.id],select:'u.id,u.email,u.name,u.phone,u.role,u.active,u.created_at,u.version',joins:'',search:['u.name','u.email','u.phone'],order:'u.created_at',status:'u.role'};}
 if(kind==='destinations'){requireRole(user,'admin');return {from:'destinations d',where:'1=1',params:[],select:'d.*',joins:'',search:['d.title','d.location','d.category'],order:'d.title',status:'d.region'};}
 if(kind==='audit'){requireRole(user,'admin');return {from:'audit_events a',where:'1=1',params:[],select:'a.*,u.name AS actor_name',joins:' JOIN users u ON u.id=a.actor_id',search:['a.action','a.entity_type','u.name'],order:'a.created_at',status:null};}
 fail('Record type not found.',404);
}
async function records(env,user,url){
 requireRole(user,'admin','employee','customer');const kind=url.searchParams.get('kind')||'enquiries';const query=recordQuery(user,kind);const q=(url.searchParams.get('q')||'').trim().slice(0,100);const status=(url.searchParams.get('status')||'').slice(0,30);const page=Math.max(1,Math.min(10000,parseInt(url.searchParams.get('page')||'1',10)||1));
 let where=query.where;const params=[...query.params];if(q){where+=` AND (${query.search.map(column=>`${column} LIKE ? ESCAPE '\\'`).join(' OR ')})`;const value=`%${q.replace(/[\\%_]/g,char=>`\\${char}`)}%`;params.push(...query.search.map(()=>value));}if(status&&query.status){where+=` AND ${query.status}=?`;params.push(status);}
 const total=(await one(env,`SELECT COUNT(*) AS n FROM ${query.from}${query.joins} WHERE ${where}`,...params)).n;
 const rows=await all(env,`SELECT ${query.select} FROM ${query.from}${query.joins} WHERE ${where} ORDER BY ${query.order} DESC LIMIT 20 OFFSET ?`,...params,(page-1)*20);
 if(user.role==='customer')rows.forEach(row=>{delete row.notes;delete row.assigned_to;delete row.assignee_name;});
 return {rows,total,page,pages:Math.max(1,Math.ceil(total/20))};
}
async function workspace(env,user){
 requireRole(user,'admin','employee','customer');const scope=enquiryScope(user);const counts={};
 counts.enquiries=(await one(env,`SELECT COUNT(*) AS n FROM enquiries e WHERE ${scope.sql} AND e.status NOT IN ('closed','converted')`,...scope.params)).n;
 counts.bookings=(await one(env,`SELECT COUNT(*) AS n FROM bookings b JOIN enquiries e ON e.id=b.enquiry_id WHERE ${scope.sql} AND b.status NOT IN ('completed','cancelled')`,...scope.params)).n;
 if(user.role!=='employee')counts.memberships=(await one(env,`SELECT COUNT(*) AS n FROM memberships WHERE status='active'${user.role==='customer'?' AND customer_id=?':''}`,...(user.role==='customer'?[user.id]:[]))).n;
 if(user.role!=='customer')counts.tasks=(await one(env,`SELECT COUNT(*) AS n FROM tasks t WHERE t.status='todo'${user.role==='employee'?' AND t.assigned_to=? AND (t.enquiry_id IS NULL OR EXISTS(SELECT 1 FROM enquiries e WHERE e.id=t.enquiry_id AND e.assigned_to=?))':''}`,...(user.role==='employee'?[user.id,user.id]:[]))).n;
 if(user.role==='admin'){counts.customers=(await one(env,"SELECT COUNT(*) AS n FROM users WHERE role='customer' AND active=1")).n;counts.recorded_receipts=(await one(env,'SELECT (SELECT COALESCE(SUM(paid_minor),0) FROM bookings)+(SELECT COALESCE(SUM(paid_minor),0) FROM memberships) AS n')).n;}
 let people=[];let memberships=[];let enquiries=[];
 if(user.role==='admin'){people=await all(env,'SELECT id,name,email,role FROM users WHERE active=1 ORDER BY name');memberships=await all(env,"SELECT id,customer_id,plan_name FROM memberships WHERE status='active' ORDER BY created_at DESC");}
 if(user.role==='employee')people=await all(env,"SELECT u.id,u.name,u.email,u.role FROM users u WHERE u.id=? OR (u.role='customer' AND EXISTS(SELECT 1 FROM enquiries e WHERE e.customer_id=u.id AND e.assigned_to=?))",user.id,user.id);
 if(user.role!=='customer')enquiries=await all(env,`SELECT e.id,e.reference,e.name,e.customer_id FROM enquiries e WHERE ${scope.sql} ORDER BY e.created_at DESC LIMIT 500`,...scope.params);
 return {user:safeUser(user),counts,people,memberships,enquiries};
}
async function createEnquiry(request,env,user,body,staff=false){
 const allowed=['name','email','phone','interest','destination','checkin','checkout','guests','style','notes','website'];if(staff)allowed.push('customer_id','assigned_to','status','followup_date');fields(body,allowed);
 if(str(body,'website',100))fail('Request could not be accepted.');
 const values={name:str(body,'name',100,true),email:email(body),phone:str(body,'phone',30),interest:choice(body,'interest',['Holiday','Membership','Stays','Tailored holiday','Travel assistance','Booking request','Member support'],'Holiday'),destination:str(body,'destination',100),checkin:day(body,'checkin'),checkout:day(body,'checkout'),guests:num(body,'guests',30,2),style:str(body,'style',100),notes:str(body,'notes',2000),status:'new',created_at:now(),updated_at:now(),reference:reference('GM'),customer_id:user?.role==='customer'?user.id:null,assigned_to:null};
 if(values.guests<1)fail('At least one traveller is required.');dateRange(values.checkin,values.checkout);
 if(staff){values.customer_id=str(body,'customer_id',100)||null;if(values.customer_id){await person(env,values.customer_id,'customer');if(user.role==='employee'&&!await one(env,'SELECT id FROM enquiries WHERE customer_id=? AND assigned_to=? LIMIT 1',values.customer_id,user.id))fail('Choose a customer already assigned to you.',403);}values.assigned_to=user.role==='employee'?user.id:str(body,'assigned_to',100)||null;if(values.assigned_to)await person(env,values.assigned_to);values.status=choice(body,'status',enquiryStatuses,'new');values.followup_date=day(body,'followup_date');}
 else{
  const recent=await one(env,'SELECT COUNT(*) AS n FROM enquiries WHERE email=? AND created_at>?',values.email,new Date(Date.now()-600000).toISOString());if(recent.n>=5)fail('Please wait a few minutes before sending another enquiry.',429);
  if(values.checkin&&values.checkin<new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date()))fail('Choose a future travel date.');
 }
 const recordId=id();const keys=Object.keys(values);const insert=statement(env,`INSERT INTO enquiries (id,${keys.join(',')}) VALUES (?,${keys.map(()=>'?').join(',')})`,recordId,...keys.map(key=>values[key]));
 await db(env).batch(user?[insert,auditStatement(env,user,'created','enquiries',recordId)]:[insert]);return {id:recordId,reference:values.reference,status:'received'};
}
async function updateEnquiry(env,user,body,recordId){
 requireRole(user,'admin','employee');const existing=await accessibleEnquiry(env,user,recordId);fields(body,['version','status','followup_date','assigned_to','customer_id']);
 const values={status:choice(body,'status',enquiryStatuses,existing.status),followup_date:'followup_date' in body?day(body,'followup_date'):existing.followup_date,updated_at:now()};
 if(user.role==='admin'){values.assigned_to='assigned_to' in body?str(body,'assigned_to',100)||null:existing.assigned_to;values.customer_id='customer_id' in body?str(body,'customer_id',100)||null:existing.customer_id;if(values.assigned_to)await person(env,values.assigned_to);if(values.customer_id)await person(env,values.customer_id,'customer');if(values.customer_id!==existing.customer_id&&await one(env,'SELECT id FROM bookings WHERE enquiry_id=? LIMIT 1',recordId))fail('Customer ownership cannot change after a booking is created.');}
 else if('assigned_to' in body||'customer_id' in body)fail('Only an administrator can change ownership or assignment.',403);
 const guard=values.customer_id!==undefined&&values.customer_id!==existing.customer_id?{sql:'NOT EXISTS(SELECT 1 FROM bookings WHERE enquiry_id=?)',params:[recordId]}:undefined;
 return saveRecord(env,user,'enquiries',values,recordId,num(body,'version',1000000),guard);
}
async function saveUser(env,user,body,recordId){
 requireRole(user,'admin');fields(body,['name','email','phone','role','active','version']);let existing;if(recordId){existing=await one(env,'SELECT * FROM users WHERE id=?',recordId);if(!existing)fail('Account not found.',404);if(existing.is_owner)fail('The owner account is managed through its own profile.');}
 const values={name:str(body,'name',100,true),email:email(body),phone:str(body,'phone',30),role:choice(body,'role',roles,'customer'),active:num(body,'active',1,1)};
 if(existing?.auth_id&&values.email!==existing.email)fail('A linked account’s verified email cannot be changed.');
 if(existing&&existing.role!==values.role){const related=await one(env,'SELECT (SELECT COUNT(*) FROM memberships WHERE customer_id=?)+(SELECT COUNT(*) FROM enquiries WHERE customer_id=? OR assigned_to=?)+(SELECT COUNT(*) FROM tasks WHERE assigned_to=?) AS n',recordId,recordId,recordId,recordId);if(related.n)fail('Reassign linked enquiries, memberships, and tasks before changing this account’s role.');}
 if(!recordId)values.created_at=now();
 try{return await saveRecord(env,user,'users',values,recordId,recordId?num(body,'version',1000000):undefined);}catch(error){if(error.message.includes('UNIQUE'))fail('An account with this email already exists.',409);throw error;}
}
async function saveMembership(env,user,body,recordId){
 requireRole(user,'admin');fields(body,['customer_id','plan_name','status','start_date','end_date','entitled_nights','used_nights','amount_minor','paid_minor','notes','version']);
 const values={customer_id:str(body,'customer_id',100,true),plan_name:str(body,'plan_name',100,true),status:choice(body,'status',['pending','active','expired','cancelled'],'pending'),start_date:day(body,'start_date',true),end_date:day(body,'end_date',true),entitled_nights:num(body,'entitled_nights',10000),used_nights:num(body,'used_nights',10000),amount_minor:num(body,'amount_minor'),paid_minor:num(body,'paid_minor'),notes:str(body,'notes',2000)};
 await person(env,values.customer_id,'customer');dateRange(values.start_date,values.end_date);if(values.used_nights>values.entitled_nights)fail('Used nights cannot exceed entitled nights.');if(values.paid_minor>values.amount_minor)fail('Recorded receipts cannot exceed the agreed amount.');
 if(recordId){const existing=await one(env,'SELECT * FROM memberships WHERE id=?',recordId);if(!existing)fail('Membership not found.',404);if(existing.customer_id!==values.customer_id)fail('Membership ownership cannot be changed.');}else values.created_at=now();
 return saveRecord(env,user,'memberships',values,recordId,recordId?num(body,'version',1000000):undefined);
}
async function saveBooking(env,user,body,recordId){
 requireRole(user,'admin','employee');fields(body,['enquiry_id','membership_id','destination','property_name','checkin','checkout','guests','status','amount_minor','paid_minor','notes','version']);
 const enquiry=await accessibleEnquiry(env,user,str(body,'enquiry_id',100,true));const values={enquiry_id:enquiry.id,membership_id:str(body,'membership_id',100)||null,destination:str(body,'destination',100,true),property_name:str(body,'property_name',200),checkin:day(body,'checkin',true),checkout:day(body,'checkout',true),guests:num(body,'guests',30,2),status:choice(body,'status',bookingStatuses,'requested'),amount_minor:num(body,'amount_minor'),paid_minor:num(body,'paid_minor'),notes:str(body,'notes',2000)};
 dateRange(values.checkin,values.checkout);if(values.guests<1)fail('At least one traveller is required.');if(values.paid_minor>values.amount_minor)fail('Recorded receipts cannot exceed the agreed amount.');
 if(values.membership_id){const membership=await one(env,'SELECT * FROM memberships WHERE id=? AND customer_id=?',values.membership_id,enquiry.customer_id);if(!membership)fail('Choose a membership belonging to this enquiry’s customer.');}
 let existing;if(recordId){existing=await one(env,'SELECT * FROM bookings WHERE id=?',recordId);if(!existing)fail('Booking not found.',404);await accessibleEnquiry(env,user,existing.enquiry_id);if(existing.enquiry_id!==values.enquiry_id)fail('A booking’s enquiry cannot be changed.');}
 if(user.role==='employee'){if(existing&&['confirmed','completed'].includes(existing.status))fail('An administrator must change a confirmed booking.',403);if(!['requested','quoted','cancelled'].includes(values.status)&&values.status!==existing?.status)fail('An administrator must confirm or complete a booking.',403);if(values.paid_minor!==(existing?.paid_minor||0))fail('Only an administrator can record receipts.',403);}
 if(!recordId){values.created_at=now();values.reference=reference('BK');}
 const guard={sql:'EXISTS(SELECT 1 FROM enquiries e WHERE e.id=? AND e.version=?'+(user.role==='employee'?' AND e.assigned_to=?':'')+')',params:[enquiry.id,enquiry.version,...(user.role==='employee'?[user.id]:[])]};
 return saveRecord(env,user,'bookings',values,recordId,recordId?num(body,'version',1000000):undefined,guard);
}
async function saveTask(env,user,body,recordId){
 requireRole(user,'admin','employee');fields(body,['title','details','assigned_to','enquiry_id','due_date','priority','status','version']);const values={title:str(body,'title',150,true),details:str(body,'details',2000),assigned_to:user.role==='employee'?user.id:str(body,'assigned_to',100,true),enquiry_id:str(body,'enquiry_id',100)||null,due_date:day(body,'due_date',true),priority:choice(body,'priority',['normal','high'],'normal'),status:choice(body,'status',['todo','done'],'todo')};
 const guard={sql:'1=1',params:[]};await person(env,values.assigned_to);if(values.enquiry_id){const lead=await accessibleEnquiry(env,user,values.enquiry_id);if(user.role==='admin'&&values.assigned_to!==lead.assigned_to&&values.assigned_to!==user.id)fail('Assign the linked task to the enquiry’s coordinator.');guard.sql+=' AND EXISTS(SELECT 1 FROM enquiries e WHERE e.id=? AND e.version=?'+(user.role==='employee'?' AND e.assigned_to=?':'')+')';guard.params.push(lead.id,lead.version,...(user.role==='employee'?[user.id]:[]));}
 if(recordId){const existing=await one(env,'SELECT * FROM tasks WHERE id=?',recordId);if(!existing)fail('Task not found.',404);if(user.role==='employee'&&existing.assigned_to!==user.id)fail('Task not found.',404);if(existing.enquiry_id)await accessibleEnquiry(env,user,existing.enquiry_id);}
 else{values.created_by=user.id;values.created_at=now();}
 if(recordId&&user.role==='employee'){guard.sql+=' AND assigned_to=? AND (enquiry_id IS NULL OR EXISTS(SELECT 1 FROM enquiries e WHERE e.id=tasks.enquiry_id AND e.assigned_to=?))';guard.params.push(user.id,user.id);}
 return saveRecord(env,user,'tasks',values,recordId,recordId?num(body,'version',1000000):undefined,guard);
}
async function saveDestination(env,user,body,recordId){
 requireRole(user,'admin');fields(body,['slug','title','region','location','category','summary','description','image','nights','highlights','active','version']);const values={slug:str(body,'slug',80,true),title:str(body,'title',100,true),region:choice(body,'region',['india','international'],'india'),location:str(body,'location',100,true),category:str(body,'category',80,true),summary:str(body,'summary',180,true),description:str(body,'description',1800,true),image:choice(body,'image',['/assets/island.jpg','/assets/mountains.jpg','/assets/jaipur.jpg'],'/assets/island.jpg'),nights:num(body,'nights',60,4),active:num(body,'active',1,1)};
 if(!/^[a-z][a-z0-9-]*$/.test(values.slug))fail('Use lowercase letters, numbers, and hyphens for the destination slug.');const highlights=str(body,'highlights',1000).split('\n').map(value=>value.trim()).filter(Boolean).slice(0,8);values.highlights=JSON.stringify(highlights);
 if(recordId&&!await one(env,'SELECT id FROM destinations WHERE id=?',recordId))fail('Destination not found.',404);
 return saveRecord(env,user,'destinations',values,recordId,recordId?num(body,'version',1000000):undefined);
}
export async function api(request,env){
 try{
  const url=new URL(request.url);const path=url.pathname;const user=await identity(request,env);await bootstrapCatalog(env,user);
  if(request.method==='GET'&&path==='/api/session')return json({user:safeUser(user),signIn:'/signin-with-chatgpt?return_to=%2Fportal'});
  if(request.method==='GET'&&path==='/api/settings')return json(await settings(env));
  if(request.method==='GET'&&path==='/api/destinations'){const rows=await all(env,'SELECT * FROM destinations WHERE active=1 ORDER BY title');const count=await one(env,'SELECT COUNT(*) AS n FROM destinations');return json({rows:count.n?rows:defaultDestinations});}
  if(request.method==='GET'&&path==='/api/workspace')return json(await workspace(env,user));
  if(request.method==='GET'&&path==='/api/records')return json(await records(env,user,url));
  if(request.method==='GET'&&path.startsWith('/api/notes/')){requireRole(user,'admin','employee');const leadId=path.split('/').at(-1);await accessibleEnquiry(env,user,leadId);const scope=enquiryScope(user);return json({rows:await all(env,`SELECT n.*,u.name AS author_name FROM notes n JOIN users u ON u.id=n.author_id JOIN enquiries e ON e.id=n.enquiry_id WHERE n.enquiry_id=? AND ${scope.sql} ORDER BY n.created_at DESC`,leadId,...scope.params)});}
  if(request.method==='GET'&&path==='/api/reports'){requireRole(user,'admin');return json({pipeline:await all(env,'SELECT status,COUNT(*) AS count FROM enquiries GROUP BY status'),bookings:await all(env,'SELECT status,COUNT(*) AS count FROM bookings GROUP BY status'),receipts:await one(env,'SELECT (SELECT COALESCE(SUM(paid_minor),0) FROM bookings) AS booking_receipts,(SELECT COALESCE(SUM(paid_minor),0) FROM memberships) AS membership_receipts'),followups:await all(env,"SELECT e.reference,e.name,e.followup_date,u.name AS assignee_name FROM enquiries e LEFT JOIN users u ON u.id=e.assigned_to WHERE e.followup_date IS NOT NULL AND e.status NOT IN ('closed','converted') ORDER BY e.followup_date LIMIT 50")});}
  if(!['POST','PATCH'].includes(request.method))fail('Endpoint not found.',404);
  sameOrigin(request);const body=await bodyJson(request);
  if(user?.preview)fail('Exit role preview before changing records.',403);
  if(request.method==='POST'&&path==='/api/enquiries')return json(await createEnquiry(request,env,user,body),201);
  if(path==='/api/profile'){requireRole(user,'admin','employee','customer');fields(body,['name','phone']);await run(env,'UPDATE users SET name=?,phone=?,version=version+1 WHERE id=?',str(body,'name',100,true),str(body,'phone',30),user.id);return json({status:'saved'});}
  if(path==='/api/settings'){requireRole(user,'admin');fields(body,Object.keys(defaultSettings));const operations=Object.keys(defaultSettings).filter(key=>key in body).map(key=>statement(env,'INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,str(body,key,1000)));await db(env).batch([...operations,auditStatement(env,user,'updated','settings','contact')]);return json({status:'saved'});}
  if(path.startsWith('/api/notes/')){requireRole(user,'admin','employee');fields(body,['body']);const enquiryId=path.split('/').at(-1);const lead=await accessibleEnquiry(env,user,enquiryId);const noteId=id();const result=await db(env).batch([statement(env,'INSERT INTO notes (id,enquiry_id,author_id,body,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM enquiries e WHERE e.id=? AND e.version=?'+(user.role==='employee'?' AND e.assigned_to=?':'')+')',noteId,enquiryId,user.id,str(body,'body',2000,true),now(),lead.id,lead.version,...(user.role==='employee'?[user.id]:[])),auditStatement(env,user,'note_added','enquiries',enquiryId)]);if(!result[0].meta.changes)fail('Enquiry assignment changed. Refresh and try again.',409);return json({id:noteId},201);}
  const match=path.match(/^\/api\/crm\/(enquiries|users|memberships|bookings|tasks|destinations)(?:\/([a-zA-Z0-9-]+))?$/);if(!match)fail('Endpoint not found.',404);requireRole(user,'admin','employee');const [,kind,recordId]=match;
  if((request.method==='PATCH')!==!!recordId)fail('Use the correct record operation.');
  if(recordId&&num(body,'version',1000000)<1)fail('Refresh this record before editing.');
  const handlers={users:saveUser,memberships:saveMembership,bookings:saveBooking,tasks:saveTask,destinations:saveDestination};
  const result=kind==='enquiries'?(recordId?await updateEnquiry(env,user,body,recordId):await createEnquiry(request,env,user,body,true)):await handlers[kind](env,user,body,recordId);
  return json({...result,status:'saved'},recordId?200:201);
 }catch(error){if(error instanceof HttpError)return json({error:error.message},error.status);console.error('CRM request failed',error.message);return json({error:'We could not save or load this information. Your details are still available; please try again.'},503);}
}
