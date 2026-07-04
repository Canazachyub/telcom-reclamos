// Componentes UI reutilizables (gráficos SVG sin librerías)
export const sem = v => v==="verde"?"#22c55e":v==="ambar"?"#f59e0b":"#ef4444";
export const urgColor = d => d===null?"#94a3b8":d<=1?"#ef4444":d<=2?"#f59e0b":"#22c55e";
export const estadoColor = e => ({Pendiente:"#64748b","En proceso":"#1d4ed8",Observado:"#f59e0b",Notificado:"#0e7490",Cerrado:"#22c55e"}[e]||"#64748b");

export function Card({children, span, className=""}){
  return <div className={"card "+className} style={span?{gridColumn:`span ${span}`}:null}>{children}</div>;
}
export function Kpi({label, value, sub, s}){
  return <div className="card kpi"><div className="barL" style={{background:sem(s)}}/><div className="lbl">{label}</div>
    <div className="val" style={{color:sem(s)}}>{value}</div><div className="sub">{sub}</div></div>;
}
export function Pill({children, bg, color="#fff"}){ return <span className="pill" style={{background:bg,color}}>{children}</span>; }
export function Tag({children, bg="#1e293b", color="#cbd5e1"}){ return <span className="tag" style={{background:bg,color}}>{children}</span>; }

export function HBars({items}){
  const max = Math.max(1, ...items.map(i=>i.val));
  return <div className="bars">{items.map((i,k)=>(
    <div className="b" key={k}><div className="nm">{i.nm}</div>
      <div className="track"><div className="fill" style={{width:Math.max(8,i.val/max*100)+"%",background:i.color}}>{i.val}</div></div></div>
  ))}</div>;
}
export function Donut({segs}){
  const total = segs.reduce((s,e)=>s+e.value,0)||1; let acc=0;
  const stops = segs.map(e=>{const a=acc/total*100; acc+=e.value; return `${e.color} ${a}% ${acc/total*100}%`;}).join(",");
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
    <div style={{width:140,height:140,borderRadius:"50%",background:`conic-gradient(${stops})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:84,height:84,borderRadius:"50%",background:"var(--card)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:20,fontWeight:800}}>{total}</div><div style={{fontSize:10,color:"var(--mut)"}}>total</div></div></div>
    <div className="legend" style={{justifyContent:"center",marginTop:10}}>{segs.map((e,k)=><span key={k}><span className="dot" style={{background:e.color}}/>{e.name} <b>{e.value}</b></span>)}</div>
  </div>;
}
export function AreaChart({serie}){
  const W=560,H=170,P=8,n=serie.length;
  const max=Math.max(1,...serie.map(p=>Math.max(p.r,p.c)))*1.1;
  const x=i=>P+i*(W-2*P)/Math.max(1,n-1), y=v=>H-P-(v/max)*(H-2*P);
  const ln=k=>serie.map((p,i)=>`${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  const ar=k=>`M ${x(0)},${H-P} L `+serie.map((p,i)=>`${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" L ")+` L ${x(n-1)},${H-P} Z`;
  return <div>
    <svg viewBox={`0 0 ${W} ${H+4}`} width="100%" height="190">
      <defs>
        <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0e7490" stopOpacity=".5"/><stop offset="1" stopColor="#0e7490" stopOpacity="0"/></linearGradient>
        <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22c55e" stopOpacity=".5"/><stop offset="1" stopColor="#22c55e" stopOpacity="0"/></linearGradient>
      </defs>
      <path d={ar("r")} fill="url(#ga)"/><polyline points={ln("r")} fill="none" stroke="#0e7490" strokeWidth="2.5"/>
      <path d={ar("c")} fill="url(#gb)"/><polyline points={ln("c")} fill="none" stroke="#22c55e" strokeWidth="2.5"/>
      {serie.map((p,i)=><text key={i} x={x(i)} y={H-1} fill="#64748b" fontSize="10" textAnchor="middle">{p.d}</text>)}
    </svg>
    <div className="legend"><span><span className="dot" style={{background:"#0e7490"}}/>Recibidos</span><span><span className="dot" style={{background:"#22c55e"}}/>Cerrados</span></div>
  </div>;
}
let toastTimer;
export function toast(msg){
  let el=document.getElementById("toast"); if(!el){el=document.createElement("div");el.id="toast";el.className="toast";document.body.appendChild(el);}
  el.textContent=msg; el.style.display="block"; clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.style.display="none",2800);
}
