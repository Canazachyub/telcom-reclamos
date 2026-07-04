# -*- coding: utf-8 -*-
"""Cliente HTTP mínimo para la API Apps Script (Code.gs / Tickets.gs).

GET  ?action=tickets|reclamos|penalidades|...
POST {"action": "...", "setupKey": "..."} para endpoints de mantenimiento.

La Web App de Apps Script a veces presenta un certificado que `requests`
no valida bien desde algunos equipos corporativos (proxy/antivirus MITM).
Por eso se intenta primero con verificación TLS normal y, si falla por
error de SSL, se reintenta una vez con verify=False (fallback explícito).
"""
import requests
import urllib3

from config import api_url

# Evita que la consola se llene de warnings cuando usamos verify=False.
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

TIMEOUT = 30


def _request(method: str, params=None, json_body=None):
    """Hace la llamada con verify=True; si falla por SSL, reintenta con verify=False.

    Devuelve (data_dict_or_list, error_str_or_None).
    """
    kwargs = dict(params=params, json=json_body, timeout=TIMEOUT)
    last_err = None
    for verify in (True, False):
        try:
            resp = requests.request(method, api_url(), verify=verify, **kwargs)
            resp.raise_for_status()
            return resp.json(), None
        except requests.exceptions.SSLError as e:
            last_err = f"Error SSL ({'con' if verify else 'sin'} verificación): {e}"
            continue  # probar el siguiente modo (verify=False)
        except requests.exceptions.RequestException as e:
            last_err = str(e)
            break  # error que no es de SSL: no tiene sentido reintentar
        except ValueError as e:  # respuesta no era JSON
            last_err = f"Respuesta no es JSON válido: {e}"
            break
    return None, last_err


def api_get(action: str):
    """GET ?action=... Devuelve (data, error)."""
    return _request("GET", params={"action": action})


def api_post(body: dict):
    """POST con cuerpo JSON. Devuelve (data, error)."""
    return _request("POST", json_body=body)
