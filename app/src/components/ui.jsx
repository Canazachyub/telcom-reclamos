// Componentes UI reutilizables (gráficos SVG sin librerías)
//
// TOKENS — mismos valores que los tokens CSS de styles.css (:root / :root[data-theme]).
// Duplicado NECESARIO: estas funciones calculan color/contraste en tiempo de render (fills
// de SVG, conic-gradient, elección automática de texto claro/oscuro) y no pueden leer un
// var() de CSS como string. Si cambian los tokens de styles.css, cambia esto también.
// "El rojo se gana": SOLO vencido/penalidad real. Por vencer = ámbar. Informativo = neutro.
export const TOKENS = {
  bg:"#0E1422", card:"#161E2E", bd:"#26303F", tx:"#E6EAF0", mut:"#8A97A8",
  green:"#1E8E5A", amber:"#C9821B", red:"#C0392B", acc:"#1F4E8C",
  blue:"#2E6DA4", teal:"#1E8A96", purple:"#7B5EA7", neutral:"#5B6B7F",
};
export const sem = v => v==="verde"?TOKENS.green:v==="ambar"?TOKENS.amber:v==="rojo"?TOKENS.red:TOKENS.neutral;
export const urgColor = d => d===null?TOKENS.neutral:d<=1?TOKENS.red:d<=2?TOKENS.amber:TOKENS.green;
export const estadoColor = e => ({Pendiente:TOKENS.neutral,"En proceso":TOKENS.acc,Observado:TOKENS.amber,Notificado:TOKENS.teal,Cerrado:TOKENS.green}[e]||TOKENS.neutral);

// Contraste AA — elige texto claro/oscuro automáticamente según la luminancia relativa del
// fondo (para no repetir a mano "amber = texto oscuro, red/acc = texto blanco" en cada sitio).
function luminancia(hex){
  const c = String(hex||"").replace("#","");
  if(c.length!==6) return 1;
  const r=parseInt(c.slice(0,2),16)/255, g=parseInt(c.slice(2,4),16)/255, b=parseInt(c.slice(4,6),16)/255;
  const f = x => x<=0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055,2.4);
  return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);
}
export function textOn(hex, {dark="#0B1220", light="#F4F6FA"}={}){
  const L = luminancia(hex);
  const contrasteConBlanco = 1.05/(L+0.05);
  return contrasteConBlanco>=4.5 ? light : dark;
}

export function Card({children, span, className=""}){
  return <div className={"card "+className} style={span?{gridColumn:`span ${span}`}:null}>{children}</div>;
}
// s: "verde"|"ambar"|"rojo"|null. El VALOR del KPI siempre va en texto neutro (--titulo) —
// "el rojo se gana": un KPI informativo (verde o sin s) nunca grita con color. Solo cuando hay
// advertencia/riesgo REAL (s="ambar"|"rojo") se agrega un acento DISCRETO: la barra izquierda,
// nunca el número completo.
export function Kpi({label, value, sub, s}){
  const accent = (s==="ambar"||s==="rojo") ? sem(s) : null;
  return <div className="card kpi" style={accent?{borderLeftColor:accent}:null}>
    <div className="barL" style={{background:accent||"transparent"}}/>
    <div className="lbl">{label}</div>
    <div className="val">{value}</div>
    <div className="sub">{sub}</div>
  </div>;
}
export function Pill({children, bg, color}){
  return <span className="pill" style={{background:bg, color: color || textOn(bg)}}>{children}</span>;
}
export function Tag({children, bg="var(--card2)", color="var(--tx)"}){ return <span className="tag" style={{background:bg,color}}>{children}</span>; }

export function HBars({items}){
  const max = Math.max(1, ...items.map(i=>i.val));
  return <div className="bars">{items.map((i,k)=>(
    <div className="b" key={k}><div className="nm">{i.nm}</div>
      <div className="track"><div className="fill" style={{width:Math.max(8,i.val/max*100)+"%",background:i.color,color:textOn(i.color)}}>{i.val}</div></div></div>
  ))}</div>;
}
export function Donut({segs}){
  const total = segs.reduce((s,e)=>s+e.value,0)||1; let acc=0;
  const stops = segs.map(e=>{const a=acc/total*100; acc+=e.value; return `${e.color} ${a}% ${acc/total*100}%`;}).join(",");
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
    <div style={{width:140,height:140,borderRadius:"50%",background:`conic-gradient(${stops})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:84,height:84,borderRadius:"50%",background:"var(--card)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div className="mono" style={{fontSize:20,fontWeight:700,color:"var(--titulo)"}}>{total}</div><div style={{fontSize:10,color:"var(--mut)"}}>total</div></div></div>
    <div className="legend" style={{justifyContent:"center",marginTop:10}}>{segs.map((e,k)=><span key={k}><span className="dot" style={{background:e.color}}/>{e.name} <b className="mono">{e.value}</b></span>)}</div>
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
        <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={TOKENS.teal} stopOpacity=".5"/><stop offset="1" stopColor={TOKENS.teal} stopOpacity="0"/></linearGradient>
        <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={TOKENS.green} stopOpacity=".5"/><stop offset="1" stopColor={TOKENS.green} stopOpacity="0"/></linearGradient>
      </defs>
      <path d={ar("r")} fill="url(#ga)"/><polyline points={ln("r")} fill="none" stroke={TOKENS.teal} strokeWidth="2.5"/>
      <path d={ar("c")} fill="url(#gb)"/><polyline points={ln("c")} fill="none" stroke={TOKENS.green} strokeWidth="2.5"/>
      {serie.map((p,i)=><text key={i} x={x(i)} y={H-1} fill={TOKENS.mut} fontSize="10" textAnchor="middle">{p.d}</text>)}
    </svg>
    <div className="legend"><span><span className="dot" style={{background:TOKENS.teal}}/>Recibidos</span><span><span className="dot" style={{background:TOKENS.green}}/>Cerrados</span></div>
  </div>;
}
let toastTimer;
// Toast discreto: posición fija consistente, autodesaparece (2.8s), no bloquea clics cuando
// está oculto (pointer-events solo activos mientras se ve) y respeta prefers-reduced-motion
// (la transición CSS vive en styles.css, clase .toast/.toast.show). role=status para lectores
// de pantalla — la etiqueta de la acción coincide con el toast (mismo verbo, ver guía de copy).
export function toast(msg){
  let el=document.getElementById("toast");
  if(!el){
    el=document.createElement("div");
    el.id="toast"; el.className="toast";
    el.setAttribute("role","status"); el.setAttribute("aria-live","polite");
    document.body.appendChild(el);
  }
  el.textContent=msg;
  el.classList.remove("show"); void el.offsetWidth; // reinicia la animación si ya estaba visible
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove("show"),2800);
}

// ===== Skeleton — sustituye textos "Cargando…" por la FORMA de lo que va a aparecer =====
// (menos parpadeo perceptual). La animación vive en .skel (styles.css) y respeta
// prefers-reduced-motion. Piezas chicas (Skeleton) + compuestos listos (SkeletonKpi/Row/Card).
// aria-hidden="true" en todos los primitivos: es contenido puramente visual (la forma del
// panel mientras carga), no información — un lector de pantalla no debe anunciarlo pieza por
// pieza. El estado "cargando" real se anuncia aparte (toast/role=status donde corresponda).
export function Skeleton({ w = "100%", h = 12, r = 8, style }) {
  return <div className="skel" aria-hidden="true" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}
export function SkeletonKpi() {
  return <div className="card kpi" aria-hidden="true">
    <Skeleton w={70} h={9} style={{ marginBottom: 10 }} />
    <Skeleton w={54} h={22} style={{ marginBottom: 8 }} />
    <Skeleton w={90} h={9} />
  </div>;
}
// Una fila tipo TicketCard (código+suministro / semáforo) — usar en colas/listas cargando.
export function SkeletonRow() {
  return <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--card2)", border: "1px solid var(--bd)" }}>
    <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 6 }}>
      <Skeleton w="46%" h={12} />
      <Skeleton w="30%" h={10} />
    </div>
    <Skeleton w={64} h={20} r={999} />
  </div>;
}
export function SkeletonCard({ rows = 3 }) {
  return <div className="card" aria-hidden="true" style={{ display: "grid", gap: 10 }}>
    <Skeleton w="34%" h={14} />
    {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
  </div>;
}
// Vista de carga completa (primer render de la app, sin datos aún): simula la forma del panel
// "Hoy"/"Mi día" para que la pantalla no salte al llegar los datos reales.
export function SkeletonVista() {
  return <div aria-hidden="true" style={{ display: "grid", gap: 14 }}>
    <div className="kpigrid">
      {Array.from({ length: 4 }).map((_, i) => <SkeletonKpi key={i} />)}
    </div>
    <SkeletonCard rows={4} />
    <SkeletonCard rows={3} />
  </div>;
}
