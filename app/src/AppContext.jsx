// Contexto global de la app (F1b — eliminar el prop-drilling Shell→Admin/Operativo→Reportes/Hoy→hijos).
// SOLO agrupa estado/handlers que YA vivían en Shell (App.jsx): ningún dato nuevo, ninguna
// llamada de red nueva (la red sigue pasando solo por lib/api.js) y ningún cambio de semántica
// — mismo nombre, misma firma, mismo efecto de cada handler. Lo único que cambia es CÓMO llega
// al componente (contexto en vez de props).
//
// Alcance (F1b): SOLO consumen este contexto Admin.jsx, Operativo.jsx, Hoy.jsx, Reportes.jsx y
// Expedientes.jsx (§ver ARQUITECTURA.md/FRONTEND-MAPA.md). Los componentes hoja — SalaExpediente,
// Drawer, NuevoCaso, Bandeja, Cuadernos, MiDia, TrabajoEquipo, Calendario, Equipo, etc. — NO se
// tocan aquí: siguen recibiendo props explícitas de su padre (Admin/Operativo hacen de puente
// contexto→props para ellos), tal como antes.
import { createContext, useContext } from "react";

export const AppCtx = createContext(null);

// Hook de conveniencia: lanza un error claro si algún componente intenta usarlo fuera de
// <AppCtx.Provider> (Shell, en App.jsx) — en vez del típico "Cannot read properties of null".
export function useApp(){
  const ctx = useContext(AppCtx);
  if(!ctx) throw new Error("useApp() debe usarse dentro de <AppCtx.Provider> (Shell, en App.jsx)");
  return ctx;
}
