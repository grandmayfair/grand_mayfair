import {api} from './api.js';
import {identity,HttpError} from './auth.js';
import assets from './assets.js';
const routes={'/':'/index.html','/destinations':'/destinations.html','/membership':'/membership.html','/experiences':'/experiences.html','/about':'/about.html','/contact':'/contact.html','/login':'/login.html','/portal':'/portal.html','/admin':'/portal.html','/employee':'/portal.html','/customer':'/portal.html','/privacy':'/privacy.html','/booking-guidance':'/booking-guidance.html','/hotel':'/hotel.html','/hotels':'/hotels.html','/india':'/india.html','/international':'/international.html','/packages':'/packages.html','/travel-desk':'/travel-desk.html','/activities':'/activities.html','/customer-care':'/customer-care.html','/payment':'/payment.html','/terms':'/terms.html','/refund-cancellation':'/refund-cancellation.html','/disclaimer':'/disclaimer.html','/cookies':'/cookies.html'};
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return api(request,env);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(['/portal','/admin','/employee','/customer','/portal.html'].includes(url.pathname)){
  try{const user=await identity(request,env);if(!user)return Response.redirect(`${url.origin}/signin-with-chatgpt?return_to=${encodeURIComponent(url.pathname+url.search)}`,302);const required={'/admin':'admin','/employee':'employee','/customer':'customer'}[url.pathname];if(required&&user.role!==required)return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Account access</title><body><h1>This workspace belongs to another role.</h1><p><a href="/portal">Open your workspace</a></p></body></html>',{status:403,headers:{'Content-Type':'text/html; charset=utf-8'}});}catch(error){return new Response(error instanceof HttpError?error.message:'Your workspace is temporarily unavailable.',{status:error.status||503});}
 }
 const file=assets[routes[url.pathname]||url.pathname];const fallback=assets['/404.html'];const asset=file||fallback;
 if(!asset)return new Response('Not found',{status:404});
 const bytes=asset.binary?Uint8Array.from(atob(asset.content),char=>char.charCodeAt(0)):asset.content;
 return new Response(request.method==='HEAD'?null:bytes,{status:file?200:404,headers:{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':asset.type.startsWith('text/html')?'no-store':'public,max-age=3600','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'"}});
}};
