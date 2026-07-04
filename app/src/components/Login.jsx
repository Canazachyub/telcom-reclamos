import { useState } from "react";
import { login } from "../lib/auth.js";

export default function Login({ onLogin }){
  const [usuario, setUsuario] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e){
    e.preventDefault();
    setErr(null); setBusy(true);
    const res = await login(usuario, pin);
    setBusy(false);
    if(res.ok) onLogin(res.perfil); else setErr(res.error || "No se pudo iniciar sesión");
  }

  return (
    <div className="loginbg">
      <form className="loginbox" onSubmit={submit}>
        <div className="brand">
          <img className="logo-img" src="https://ingeneriatelcom.com/assets/images/logo/logo-horizontal.png" alt="INGENIERIA TELCOM"/>
          <div><div style={{fontSize:11,color:"var(--mut)"}}>Plataforma de Reclamos · ELSE</div></div>
        </div>
        <h2>Iniciar sesión</h2>
        <div className="sub">CP-026-2026-ELSE · Electro Sur Este</div>
        {err && <div className="loginerr">{err}</div>}
        <div className="field">
          <label>Usuario</label>
          <input autoFocus value={usuario} onChange={e=>setUsuario(e.target.value)} placeholder="ej. aaraujo" autoComplete="username"/>
        </div>
        <div className="field">
          <label>PIN</label>
          <input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="••••" inputMode="numeric" autoComplete="current-password"/>
        </div>
        <button className="loginbtn" disabled={busy || !usuario || !pin}>{busy?"Verificando…":"Ingresar"}</button>
        <div className="hint">
          Ingresa con el usuario y PIN que te asignó coordinación.<br/>
          ¿No los tienes? Pídelos a Andre (Coordinador) o al Gerente.
        </div>
      </form>
    </div>
  );
}
