import {readRecord} from "./implementation-core.js";
import {PRODUCTION_PREPARATION_ENDPOINT,productionPreparationReview} from "./production-preparation-core.js";

export function productionPreparationPlugin(root){
 return {name:"production-preparation",configureServer(server){server.middlewares.use(async(req,res,next)=>{
  const url=new URL(req.url,"http://localhost"),matched=/^\/api\/analysis\/cx-recycle\/(CR-\d{3,})\/prototype-delivery$/.exec(url.pathname);if(!matched)return next();const requirementId=matched[1];
  const reply=(code,value)=>{res.statusCode=code;res.end(JSON.stringify(value));};res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");
  const host=req.headers.host||"";if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||(req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers["sec-fetch-site"]==="cross-site")return reply(403,{message:"仅允许本机工作台访问。"});
  if(url.search||req.method!=="GET")return reply(405,{message:"原型交付清单只读。"});
  try{return reply(200,productionPreparationReview(readRecord(root,requirementId)));}catch{return reply(503,{message:"原型交付清单暂时无法读取。"});}
 });}};
}
