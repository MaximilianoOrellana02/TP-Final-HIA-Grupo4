"""Simulación programada de incidencias en el Mantis local del TP.

Uso: python scripts/mantis_simulacion.py iniciar|ejecutar|estado|detener
Los tickets y notas automáticos se identifican como simulación. La resolución
queda en manos del responsable después de ejecutar la prueba y adjuntar evidencia.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = Path(os.environ.get("LOCALAPPDATA", str(ROOT / "datos"))) / "tp-final-orellana" / "mantis-automation"
STATE = DATA / "state.json"
TOKENS = DATA / "tokens.json"
BASE_URL = "http://127.0.0.1:8990/api/rest"
TOKEN_NAME = "simulacion-tp-final-2026"
TASK_NAME = "TPFinal-MantisSimulacion"
INTERVAL = timedelta(hours=2)
NOTE_DELAY = timedelta(minutes=40)
ASSIGN_DELAY = timedelta(minutes=40)
USERS = {
    "huells": {"id": 1, "username": "administrator"},
    "orellana": {"id": 2, "username": "cristian.orellana"},
    "guari": {"id": 3, "username": "christian.guari"},
    "figueroa": {"id": 4, "username": "maximiliano.figueroa"},
    "mendez": {"id": 5, "username": "marcos.mendez"},
}

# Los números corresponden a la lista acordada; se omiten 8 y 12.
CASES = [
    {"number": 1, "reporter": "figueroa", "note_author": "guari", "handler": "huells",
     "summary": "Mantis no inicia al levantar los servicios",
     "description": "En la puesta en marcha del entorno, Mantis no aparecía entre los servicios activos después del arranque habitual de Compose. Prueba controlada del TP.",
     "steps": "Ejecutar docker compose up -d; revisar docker compose ps; intentar abrir Mantis. Comparar con el arranque usando --profile incidencias.",
     "note": "El servicio está definido bajo el perfil incidencias. Se debe adjuntar la salida de Compose antes y después de activarlo."},
    {"number": 2, "reporter": "huells", "note_author": "figueroa", "handler": "huells",
     "summary": "El puerto 8989 de Mantis está ocupado",
     "description": "El Mantis de Sodería no podía usar localhost:8989 porque ese puerto estaba ocupado por la instalación del TP6. Prueba controlada del TP.",
     "steps": "Revisar docker ps y los puertos publicados; iniciar el Mantis de Sodería; probar localhost:8989 y localhost:8990.",
     "note": "Se observó el Mantis del TP6 en 8989 y el de Sodería en 8990. Falta adjuntar captura de ambos contenedores y confirmar el acceso."},
    {"number": 3, "reporter": "figueroa", "note_author": "guari", "handler": "mendez",
     "summary": "El backend espera al clúster durante el arranque",
     "description": "Se revisará el tiempo de arranque del backend mientras HAProxy espera un primario de PostgreSQL. Caso de prueba; la falla todavía no se confirmó.",
     "steps": "Iniciar el stack; observar docker compose ps y los logs de haproxy y backend; medir cuándo responde la aplicación.",
     "note": "Hay que medir la espera y guardar el log. Si el backend arranca dentro del tiempo previsto, registrar ese resultado sin afirmar que falló."},
    {"number": 4, "reporter": "figueroa", "note_author": "mendez", "handler": "orellana",
     "summary": "Revisar la conexión al cambiar el nodo principal",
     "description": "Prueba controlada de failover para comprobar si la aplicación pierde conexión y cuánto tarda en recuperarse. Pendiente de ejecución.",
     "steps": "Identificar el primario en Patroni; detenerlo de forma controlada; repetir una consulta a la aplicación y registrar los tiempos.",
     "note": "Antes de la prueba hay que anotar el primario y el estado de las réplicas. Adjuntar luego la salida de Patroni y la hora de recuperación."},
    {"number": 5, "reporter": "guari", "note_author": "figueroa", "handler": "mendez",
     "summary": "Comprobar la sincronización de las réplicas",
     "description": "Se comprobará el estado de los tres nodos de PostgreSQL después del arranque. Caso de prueba; aún no se observó una réplica desincronizada.",
     "steps": "Iniciar el clúster; esperar el arranque; ejecutar patronictl list y guardar el estado de cada nodo.",
     "note": "Registrar cuál es el primario y cuáles son réplicas. Si los tres nodos están operativos, no presentarlo como una falla."},
    {"number": 6, "reporter": "figueroa", "note_author": "huells", "handler": "guari",
     "summary": "pgAdmin no conecta al clúster al iniciar el entorno",
     "description": "Se probará la conexión de pgAdmin a PostgreSQL a través de HAProxy durante el arranque. Caso de prueba pendiente de resultado.",
     "steps": "Iniciar el stack; abrir pgAdmin; intentar conectar al servidor configurado; registrar el mensaje y el estado de HAProxy.",
     "note": "Comprobar el host configurado y si HAProxy ya está healthy. Adjuntar el mensaje exacto si falla la conexión."},
    {"number": 7, "reporter": "guari", "note_author": "figueroa", "handler": "orellana",
     "summary": "Revisar dónde queda el archivo de backup",
     "description": "Se comprobará que el servicio backup genere un archivo utilizable en la carpeta esperada. Caso de prueba pendiente.",
     "steps": "Ejecutar docker compose run --rm backup; anotar la ruta indicada; comprobar el archivo y realizar una restauración en una base de prueba.",
     "note": "La existencia del archivo no basta: se debe probar una restauración controlada antes de resolver el ticket."},
    {"number": 9, "reporter": "figueroa", "note_author": "guari", "handler": "mendez",
     "summary": "Grafana no muestra algunas métricas del clúster",
     "description": "Se revisará si los paneles de Grafana muestran datos luego del arranque de Prometheus y los exportadores. Caso de prueba pendiente.",
     "steps": "Iniciar el stack; abrir Grafana; revisar el panel del clúster y el estado de los targets en Prometheus.",
     "note": "Anotar qué panel queda vacío y si el target correspondiente está disponible. Adjuntar captura con la hora de la prueba."},
    {"number": 10, "reporter": "mendez", "note_author": "guari", "handler": "figueroa",
     "summary": "Consulta de prueba lenta con muchos registros",
     "description": "Se medirá una consulta de historial con la carga de datos del TP para evaluar su rendimiento. Pendiente de medición.",
     "steps": "Preparar datos de prueba; ejecutar la consulta varias veces; guardar tiempos y EXPLAIN antes y después de un ajuste.",
     "note": "Registrar cantidad de filas, tiempo medido y plan de ejecución. No afirmar mejora hasta repetir la medición."},
    {"number": 11, "reporter": "huells", "note_author": "figueroa", "handler": "orellana",
     "summary": "Revisar exposición del panel de HAProxy",
     "description": "El archivo Compose publica el panel de estadísticas de HAProxy en el puerto 7000. Se revisará si queda accesible más allá de lo necesario. Caso de seguridad.",
     "steps": "Revisar la línea de ports de haproxy; iniciar el servicio; comprobar desde qué interfaces responde el puerto 7000.",
     "note": "El Compose contiene 7000:7000. Verificar el alcance de red real y documentar la decisión de acceso antes de cerrar."},
]


def now() -> datetime:
    return datetime.now().astimezone()


def save_json(path: Path, data: dict) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def db(sql: str) -> str:
    result = subprocess.run(
        ["docker", "exec", "-i", "soderia-mantis-db-1", "sh", "-c",
         "mariadb -u mantisbt -p$MARIADB_PASSWORD bugtracker -N"],
        input=sql, text=True, capture_output=True, check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr[-700:])
    return result.stdout.strip()


def api(account: str, method: str, path: str, body: dict | None = None) -> dict:
    tokens = read_json(TOKENS)
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        BASE_URL + path, data=data, method=method,
        headers={"Authorization": tokens[account], "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Mantis HTTP {error.code}: {detail[:500]}") from error


def create_tokens() -> None:
    if TOKENS.exists():
        raise RuntimeError(f"Ya existe {TOKENS}; revisar antes de iniciar de nuevo")
    tokens = {}
    try:
        for account, user in USERS.items():
            token = secrets.token_urlsafe(24)  # Mantis exige exactamente 32 caracteres.
            digest = hashlib.sha256(token.encode()).hexdigest()
            db(f"INSERT INTO mantis_api_token_table(user_id,name,hash,date_created,date_used) "
               f"VALUES ({user['id']},'{TOKEN_NAME}','{digest}',{int(time.time())},1);")
            tokens[account] = token
        save_json(TOKENS, tokens)
        for account, user in USERS.items():
            profile = api(account, "GET", "/users/me")
            if profile.get("name") != user["username"]:
                raise RuntimeError(f"El token de {account} no corresponde a {user['username']}")
    except Exception:
        revoke_tokens()
        raise


def revoke_tokens() -> None:
    db(f"DELETE FROM mantis_api_token_table WHERE name='{TOKEN_NAME}';")
    TOKENS.unlink(missing_ok=True)


def backup() -> Path:
    DATA.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        ["docker", "exec", "soderia-mantis-db-1", "sh", "-c",
         "mariadb-dump -u mantisbt -p$MARIADB_PASSWORD bugtracker"],
        capture_output=True, check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors="replace")[-700:])
    path = DATA / f"backup-{now().strftime('%Y%m%d-%H%M%S')}.sql"
    path.write_bytes(result.stdout)
    return path


def start() -> None:
    if STATE.exists():
        raise RuntimeError("La simulación ya tiene estado local; usar 'estado' o 'detener'")
    saved_backup = backup()
    print(f"Respaldo: {saved_backup}")
    create_tokens()
    try:
        old_ids = [int(value) for value in db("SELECT id FROM mantis_bug_table ORDER BY id;").splitlines() if value]
        for issue_id in old_ids:
            api("huells", "DELETE", f"/issues/{issue_id}")
        print(f"Incidencias anteriores eliminadas: {len(old_ids)}")
        save_json(STATE, {"started_at": now().isoformat(), "next_creation_at": now().isoformat(),
                          "next_index": 0, "tickets": {}, "active": True, "events": []})
        run()
    except Exception:
        if not STATE.exists():
            revoke_tokens()
        raise


def record(state: dict, event: str, number: int, issue_id: int) -> None:
    state["events"].append({"at": now().isoformat(), "event": event,
                            "number": number, "issue_id": issue_id})
    save_json(STATE, state)
    print(f"{event}: caso {number}, Mantis #{issue_id}")


def existing_issue(number: int) -> int | None:
    marker = f"SIMTP-2026-{number:02d}"
    result = db(
        "SELECT b.id FROM mantis_bug_table b "
        "JOIN mantis_bug_text_table t ON t.id=b.bug_text_id "
        f"WHERE b.project_id=1 AND t.additional_information LIKE '%{marker}%' "
        "ORDER BY b.id LIMIT 1;"
    )
    return int(result) if result else None


def existing_note(issue_id: int, number: int) -> bool:
    marker = f"SIMTP-2026-{number:02d}-NOTA"
    result = db(
        "SELECT n.id FROM mantis_bugnote_table n "
        "JOIN mantis_bugnote_text_table t ON t.id=n.bugnote_text_id "
        f"WHERE n.bug_id={issue_id} AND t.note LIKE '%{marker}%' "
        "ORDER BY n.id LIMIT 1;"
    )
    return bool(result)


def disable_task() -> None:
    subprocess.run(["schtasks.exe", "/Change", "/TN", TASK_NAME, "/DISABLE"],
                   capture_output=True, check=False)


def run() -> None:
    state = read_json(STATE)
    if not state["active"]:
        print("Simulación detenida")
        return
    current = now()

    # Una acción por ejecución evita que varias acciones atrasadas se publiquen juntas.
    for case in CASES:
        ticket = state["tickets"].get(str(case["number"]))
        if not ticket:
            continue
        issue_id = ticket["issue_id"]
        if not ticket.get("noted") and current >= datetime.fromisoformat(ticket["note_due"]):
            if not existing_note(issue_id, case["number"]):
                api(case["note_author"], "POST", f"/issues/{issue_id}/notes",
                    {"text": f"Simulación automatizada [SIMTP-2026-{case['number']:02d}-NOTA]: " + case["note"]})
            ticket["noted"] = True
            ticket["assign_due"] = (now() + ASSIGN_DELAY).isoformat()
            record(state, "nota", case["number"], issue_id)
            return
        if ticket.get("noted") and not ticket.get("assigned") and current >= datetime.fromisoformat(ticket["assign_due"]):
            api("huells", "PATCH", f"/issues/{issue_id}",
                {"handler": {"id": USERS[case["handler"]]["id"]}, "status": {"id": 50}})
            ticket["assigned"] = True
            record(state, "asignación", case["number"], issue_id)
            return

    index = state["next_index"]
    if index < len(CASES) and current >= datetime.fromisoformat(state["next_creation_at"]):
        case = CASES[index]
        issue_id = existing_issue(case["number"])
        if issue_id is None:
            issue = api(case["reporter"], "POST", "/issues", {
                "summary": case["summary"],
                "description": case["description"] + "\n\nRegistro de simulación automatizada del TP; verificar el resultado antes de considerarlo una falla confirmada.",
                "steps_to_reproduce": case["steps"],
                "additional_information": f"SIMTP-2026-{case['number']:02d}. Responsable previsto: {case['handler']}.",
                "project": {"id": 1}, "category": {"id": 1},
                "priority": {"id": 30}, "severity": {"id": 50},
                "reproducibility": {"id": 10},
            })
            issue_id = int(issue.get("issue", issue)["id"])
        state["tickets"][str(case["number"])] = {
            "issue_id": issue_id, "created_at": now().isoformat(),
            "note_due": (now() + NOTE_DELAY).isoformat(),
            "noted": False, "assigned": False,
        }
        state["next_index"] = index + 1
        accelerated_until = state.get("accelerated_until_index", 0)
        accelerated_minutes = state.get("accelerated_interval_minutes", 15)
        interval = (timedelta(minutes=accelerated_minutes)
                    if state["next_index"] < accelerated_until else INTERVAL)
        state["next_creation_at"] = (now() + interval).isoformat()
        record(state, "creación", case["number"], issue_id)
        return

    if index == len(CASES) and all(t["assigned"] for t in state["tickets"].values()):
        state["active"] = False
        save_json(STATE, state)
        revoke_tokens()
        disable_task()
        print("Diez tickets creados, anotados y asignados. Tokens retirados.")
    else:
        print("Sin acción pendiente en este momento")


def status() -> None:
    if not STATE.exists():
        print("La simulación no está iniciada")
        return
    state = read_json(STATE)
    print(f"Activa: {state['active']}; creadas: {state['next_index']}/10")
    print(f"Próxima creación: {state['next_creation_at']}")
    for event in state["events"][-8:]:
        print(f"{event['at']} | {event['event']} | caso {event['number']} | Mantis #{event['issue_id']}")


def stop() -> None:
    if STATE.exists():
        state = read_json(STATE)
        state["active"] = False
        save_json(STATE, state)
    if TOKENS.exists():
        revoke_tokens()
    disable_task()
    print("Simulación detenida; las incidencias creadas permanecen en Mantis")


def main() -> None:
    commands = {"iniciar": start, "ejecutar": run, "estado": status, "detener": stop}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        raise SystemExit("Uso: python scripts/mantis_simulacion.py iniciar|ejecutar|estado|detener")
    commands[sys.argv[1]]()


if __name__ == "__main__":
    main()
