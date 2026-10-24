const API='https://qn8kojdbz1.execute-api.ap-south-1.amazonaws.com/state';
async function run(total, conc){
  const lat=[], codes={}; let next=0; const t0=performance.now();
  async function worker(){ while(next<total){ next++; const s=performance.now(); try{const r=await fetch(API); await r.arrayBuffer(); codes[r.status]=(codes[r.status]||0)+1; if(r.ok) lat.push(performance.now()-s);}catch(e){codes.err=(codes.err||0)+1;} } }
  await Promise.all([...Array(conc)].map(worker));
  const dur=(performance.now()-t0)/1000; lat.sort((a,b)=>a-b);
  const p=q=>lat.length?Math.round(lat[Math.min(lat.length-1,Math.floor(q*lat.length))]):null;
  return {total,conc,seconds:+dur.toFixed(1),rps:+(total/dur).toFixed(1),codes,p50:p(.5),p95:p(.95),p99:p(.99),max:lat.length?Math.round(lat[lat.length-1]):null};
}
const out=[];
out.push(await run(10,1));         // warm-up
out.push(await run(200,5));        // steady load
out.push(await run(300,40));       // burst well above the 10-concurrency Lambda limit
console.log(JSON.stringify(out,null,1));
