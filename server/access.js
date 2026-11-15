export const TARGET_URL='/';
// Legacy entrance links open the public classroom demo.
export function createAccessHandler(){return function access(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.setHeader('Allow','GET, HEAD');return res.end();}
 res.statusCode=303;res.setHeader('Location',TARGET_URL);res.end();
};}
