import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const cors={
  "Access-Control-Allow-Origin":"https://jobcards.io",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json"
};

type Candidate={
  title:string;company:string;location:string;work_model:"Remote"|"Hybrid"|"On-site";
  salary_min:number|null;salary_max:number|null;currency:string;description:string;
  source_url:string;source_kind:string;source_name:string;published_at:string|null;
};

const clean=(value:unknown)=>String(value??"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
const list=(value:unknown)=>Array.isArray(value)?value.map(clean).filter(Boolean):[];
const includesAny=(text:string,needles:string[])=>needles.some(n=>text.includes(n.toLowerCase()));
const safeUrl=(raw:string)=>{
  const url=new URL(raw);
  if(url.protocol!=="https:")throw new Error("Only HTTPS sources are allowed.");
  const host=url.hostname.toLowerCase();
  if(host==="localhost"||host.endsWith(".local")||/^\d+\.\d+\.\d+\.\d+$/.test(host)||host==="0.0.0.0")throw new Error("Private network sources are not allowed.");
  return url;
};
function score(job:Candidate,p:any){
  const text=(job.title+" "+job.company+" "+job.location+" "+job.description).toLowerCase();
  const title=job.title.toLowerCase();
  const excluded=list(p.excluded_keywords);
  if(includesAny(text,excluded))return null;
  const roles=list(p.target_roles);
  if(roles.length&&!includesAny(title,roles))return null;
  const must=list(p.must_have_keywords);
  if(must.some((x:string)=>!text.includes(x.toLowerCase())))return null;
  const locations=list(p.locations);
  if(locations.length&&!includesAny((job.location+" "+job.work_model).toLowerCase(),locations)&&job.work_model!=="Remote")return null;
  const models=list(p.work_models);
  if(models.length&&!models.includes(job.work_model))return null;
  if(p.direct_apply_only&&!/^https:\/\//.test(job.source_url))return null;
  let value=55;
  if(roles.length&&includesAny(title,roles))value+=20;
  value+=Math.min(15,list(p.nice_to_have_keywords).filter((x:string)=>text.includes(x.toLowerCase())).length*5);
  value+=Math.min(6,list(p.industries).filter((x:string)=>text.includes(x.toLowerCase())).length*3);
  if(job.work_model==="Remote")value+=3;
  if(job.salary_min&&p.minimum_salary&&job.salary_min>=p.minimum_salary)value+=6;
  return Math.max(0,Math.min(99,value));
}
async function fetchArbeitnow(){
  const res=await fetch("https://www.arbeitnow.com/api/job-board-api",{headers:{"User-Agent":"JobCards.io/1.0"}});
  if(!res.ok)throw new Error("Arbeitnow feed returned "+res.status);
  const body=await res.json();
  return (body.data??[]).slice(0,100).map((j:any):Candidate=>({
    title:clean(j.title),company:clean(j.company_name),location:clean(j.location)||"Germany",
    work_model:j.remote?"Remote":"On-site",salary_min:null,salary_max:null,currency:"EUR",
    description:clean(j.description),source_url:clean(j.url),source_kind:"public_feed",
    source_name:"Arbeitnow",published_at:j.created_at?new Date(Number(j.created_at)*1000).toISOString():null
  })).filter((j:Candidate)=>j.title&&j.company&&j.source_url);
}
async function fetchCustom(source:any){
  const url=safeUrl(source.url);
  const res=await fetch(url,{redirect:"error",headers:{"User-Agent":"JobCards.io/1.0"}});
  if(!res.ok)throw new Error(source.name+" returned "+res.status);
  const html=(await res.text()).slice(0,1000000);
  const meta=(name:string)=>{
    const re=new RegExp('<meta[^>]+(?:name|property)=[\"\\\']'+name+'[\"\\\'][^>]+content=[\"\\\']([^\"\\\']+)',"i");
    return clean(html.match(re)?.[1]);
  };
  const title=meta("og:title")||clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])||source.name;
  const description=meta("og:description")||meta("description")||clean(html).slice(0,4000);
  if(source.source_type==="job_url"){
    return [{title,company:meta("og:site_name")||source.name,location:"Location not listed",work_model:"On-site",salary_min:null,salary_max:null,currency:"EUR",description,source_url:url.toString(),source_kind:"job_url",source_name:source.name,published_at:null} as Candidate];
  }
  const found:Candidate[]=[];
  const links=[...html.matchAll(/<a[^>]+href=[\"']([^\"']+)[\"'][^>]*>([\s\S]*?)<\/a>/gi)].slice(0,500);
  for(const match of links){
    const label=clean(match[2]);
    if(label.length<5||label.length>140||!/(job|career|position|opening|vacanc|apply|manager|engineer|marketing|sales|product)/i.test(label))continue;
    try{
      const href=new URL(match[1],url);
      if(href.protocol!=="https:"||href.hostname!==url.hostname)continue;
      found.push({title:label,company:source.name,location:"Location not listed",work_model:"On-site",salary_min:null,salary_max:null,currency:"EUR",description,source_url:href.toString(),source_kind:"company_page",source_name:source.name,published_at:null});
    }catch{}
    if(found.length>=25)break;
  }
  return found;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:cors});
  const auth=req.headers.get("Authorization");
  if(!auth)return new Response(JSON.stringify({error:"Sign in required"}),{status:401,headers:cors});
  const client=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_ANON_KEY")??"",{global:{headers:{Authorization:auth}}});
  const token=auth.replace("Bearer ","");
  const {data:{user},error:userError}=await client.auth.getUser(token);
  if(userError||!user)return new Response(JSON.stringify({error:"Invalid session"}),{status:401,headers:cors});
  const {data:run,error:runError}=await client.from("scan_runs").insert({user_id:user.id,status:"running"}).select().single();
  if(runError)return new Response(JSON.stringify({error:runError.message}),{status:400,headers:cors});
  try{
    const [{data:prefs,error:prefsError},{data:sources,error:sourcesError}]=await Promise.all([
      client.from("user_preferences").select("*").eq("user_id",user.id).single(),
      client.from("scan_sources").select("*").eq("user_id",user.id).eq("enabled",true)
    ]);
    if(prefsError)throw new Error("Save your scanning rules first.");
    if(sourcesError)throw sourcesError;
    const batches=await Promise.allSettled([fetchArbeitnow(),...(sources??[]).map(fetchCustom)]);
    const candidates=batches.flatMap(x=>x.status==="fulfilled"?x.value:[]);
    const unique=new Map<string,Candidate>();
    for(const j of candidates)if(j.source_url)unique.set(j.source_url,j);
    const scored=[...unique.values()].map(job=>({job,fit:score(job,prefs)})).filter(x=>x.fit!==null&&x.fit>=60);
    const {data:existing}=await client.from("jobs").select("source_url").eq("user_id",user.id);
    const seen=new Set((existing??[]).map((x:any)=>x.source_url));
    const rows=scored.filter(x=>!seen.has(x.job.source_url)).map(x=>({...x.job,user_id:user.id,fit_score:x.fit,strong_signal:"Matches your active scanning rules.",watch_out:x.job.salary_min?"Review the full description before applying.":"Salary was not listed; verify compensation before applying.",is_sample:false}));
    if(rows.length){
      const {error}=await client.from("jobs").insert(rows);
      if(error)throw error;
    }
    await client.from("scan_runs").update({status:"completed",sources_checked:1+(sources?.length??0),jobs_found:candidates.length,jobs_added:rows.length,completed_at:new Date().toISOString()}).eq("id",run.id);
    return new Response(JSON.stringify({sources_checked:1+(sources?.length??0),jobs_found:candidates.length,jobs_matched:scored.length,jobs_added:rows.length,warnings:batches.filter(x=>x.status==="rejected").length}),{headers:cors});
  }catch(error){
    await client.from("scan_runs").update({status:"failed",error_message:error instanceof Error?error.message:"Scan failed",completed_at:new Date().toISOString()}).eq("id",run.id);
    return new Response(JSON.stringify({error:error instanceof Error?error.message:"Scan failed"}),{status:400,headers:cors});
  }
});