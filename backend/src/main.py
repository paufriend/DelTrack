# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from mqtt_client import start_mqtt, Localizadores, publish_to_thingspeak, build_destination_message, topic_publish_field
import threading

app = FastAPI()

# CORS para localhost y 127.0.0.1
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    mqtt_thread = threading.Thread(target=start_mqtt, daemon=True)
    mqtt_thread.start()

@app.get("/messages")
async def get_messages():
    messages = []
    for localizador in Localizadores:
        if localizador.mensaje:
            messages.append({
                "id": localizador.id,
                "topic": localizador.topic_mqtt,
                "mensaje": localizador.mensaje,
                "lat": localizador.mensaje[1],
                "lng": localizador.mensaje[2],
                "desbloquear": localizador.desbloquear
            })
    return {"messages": messages}

@app.get("/coordenadas/{localizador_id}")
async def get_coordenadas(localizador_id: str):
    for localizador in Localizadores:
        if localizador.id == localizador_id:
            if localizador.coordenadas:
                print(f"Coordenadas del localizador {localizador_id}: {localizador.coordenadas}")
                return localizador.coordenadas
            raise HTTPException(status_code=404, detail="Coordenadas no disponibles")
    raise HTTPException(status_code=404, detail="Localizador no encontrado")

@app.get("/localizadores")
async def get_localizadores():
    return {"localizadores": [l.id for l in Localizadores]}

@app.get("/status")
def read_status():
    return {"message": "API funcionando"}

class DestinoPayload(BaseModel):
    destino: dict
    codigo: str

@app.post("/destino/{localizador_id}")
async def set_destino(localizador_id: str, payload: DestinoPayload):
    """
    1) Actualiza código y destino en memoria.
    2) Publica a ThingSpeak (canal 3038672, field1) el mensaje:
       'codigo lat lng'  -> lo recibe tu Heltec.
    """
    # Sanitiza y valida entradas
    if not isinstance(payload.destino, dict):
        raise HTTPException(status_code=400, detail="Destino inválido")

    lat = payload.destino.get("lat")
    lng = payload.destino.get("lng")
    codigo = (payload.codigo or "").strip()

    try:
        latf = float(lat)
        lngf = float(lng)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="lat/lng deben ser numéricos")

    if not (-90.0 <= latf <= 90.0 and -180.0 <= lngf <= 180.0):
        raise HTTPException(status_code=400, detail="lat/lng fuera de rango")

    if not codigo:
        raise HTTPException(status_code=400, detail="codigo vacío")

    for localizador in Localizadores:
        if localizador.id == localizador_id:
            # Actualiza estado interno
            localizador.actualizar_codigo(codigo)
            localizador.set_destino(latf, lngf)

            # **Formato requerido**: "codigo lat lng"
            msg = f"{codigo} {latf:.6f} {lngf:.6f}"

            # Publica a canal de control 3038672 (field1)
            ts_topic = topic_publish_field(field="field1")  # channels/3038672/publish/fields/field1
            ok = publish_to_thingspeak(ts_topic, msg)

            return {
                "message": f"Destino actualizado para el localizador {localizador_id}",
                "published": bool(ok),
                "topic": ts_topic,
                "payload": msg
            }

    raise HTTPException(status_code=404, detail="Localizador no encontrado")

