export const TARGET_URL='https://script.google.com/a/macros/stu.musashino-u.ac.jp/s/AKfycbwDeECBD1UE0K7Qe6T3QThhkA2Ok-9KQ2rc68URAwXDARh2rx1AuAyn96WQdOqao7nBkA/exec';
// Authentication and persistent global lock are enforced by the owner-only Google app.
export function createAccessHandler(){return function access(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.setHeader('Allow','GET, HEAD');return res.end();}
 res.statusCode=303;res.setHeader('Location',TARGET_URL);res.end();
};}
