# mqtt_client.py
import paho.mqtt.client as mqtt
import Localizador
import time

# --------------- NUEVO: cliente global ---------------
client = None  # <- accesible desde main.py para publicar

# Canal al que PUBLICAREMOS comandos (donde escucha el Heltec)
PUBLISH_CHANNEL_ID = "3038672"
PUBLISH_FIELD = "field1"  # el Heltec se suscribe a field1
# -----------------------------------------------------

Localizadores = [Localizador.Localizador("1", "field1", "1234"),
                 Localizador.Localizador("2", "field2", "5678")]
print("Localizadores inicializados:", Localizadores)

# === CONFIGURACIÓN ===
CHANNEL_ID = "2983140"  # Canal donde RECIBES telemetría
READ_API_KEY = "6UB2JU56LS2270R2"
MQTT_BROKER = "mqtt3.thingspeak.com"
MQTT_PORT = 1883
MQTT_CLIENTID = "MwMFJRoDDyYMBBEIFzMgNDk"
user = MQTT_CLIENTID
password = "xUh7B+/3tVBsWQP+T4v13/4x"

MQTT_TOPICS = []
for i in Localizadores:
    MQTT_TOPICS.append(f"channels/{CHANNEL_ID}/subscribe/fields/{i.topic_mqtt}")

def on_message(client_in, userdata, message):
    print(f"Mensaje recibido en {message.topic}")
    print(f"Contenido: {message.payload.decode()}")
    newmessage = message.payload.decode().strip().split(" ")
    for i in Localizadores:
        if i.topic_mqtt == message.topic.split("/")[4]:
            i.nuevo_mensaje(newmessage)
            if len(newmessage) > 4:
                if [newmessage[1], newmessage[2]] != [None, None]:
                    try:
                        if (abs(float(newmessage[1])) > 0) and (abs(float(newmessage[2])) > 0):
                            i.set_coordenadas([newmessage[1], newmessage[2]])
                            i.set_ajuste(newmessage[3])
                            i.set_codIngresado(newmessage[4])
                            print(f"Mensaje agregado al localizador {i.id}: {newmessage}")
                            print(f">> cod={i.codIngresado} ajuste={i.ajuste} coord={i.coordenadas}")
                            break
                        else:
                            print("GPS no disponible")
                    except ValueError:
                        print("Payload no numérico en lat/lng")
            elif (newmessage == "-21"):
                print("Localizador fuera de rango")

def on_connect(client_in, userdata, flags, rc):
    if rc == 0:
        print("Conectado al broker MQTT de ThingSpeak.")
        for t in MQTT_TOPICS:
            print(f"Suscribiéndose al tema: {t}")
            client_in.subscribe(t)
            print(f"Suscrito al tema: {t}")
    else:
        print(f"Error de conexión: {rc}")

def start_mqtt():
    global client
    client = mqtt.Client(client_id=MQTT_CLIENTID, protocol=mqtt.MQTTv311, clean_session=False)
    print("Iniciando cliente MQTT...")
    client.username_pw_set(user, password)
    print("pass set")
    client.on_connect = on_connect
    client.on_message = on_message
    connected = False
    while not connected:
        try:
            print("[MQTT] Intentando conectar al broker...")
            client.connect(MQTT_BROKER, MQTT_PORT, 60)
            connected = True
            client.loop_start()
            print("[MQTT] Conexión exitosa.")
        except Exception as e:
            print(f"[MQTT] Error de conexión: {e}")
            print("[MQTT] Reintentando en 5 segundos...")
            time.sleep(5)

def stop_mqtt(client_in):
    print("[MQTT] Deteniendo cliente MQTT...")
    client_in.loop_stop()
    client_in.disconnect()

# --------------- NUEVO: publicar a ThingSpeak ---------------
def publish_to_thingspeak(topic: str, payload: str) -> bool:
    """
    Publica 'payload' en 'topic' usando el cliente MQTT global.
    Devuelve True si la publicación fue aceptada por paho.
    """
    global client
    if client is None:
        print("[MQTT] Cliente no inicializado")
        return False
    try:
        # qos=0, retain=False (ThingSpeak no usa retain)
        info = client.publish(topic, payload, qos=0, retain=False)
        # info.wait_for_publish()  # opcional
        ok = (info.rc == mqtt.MQTT_ERR_SUCCESS)
        print(f"[MQTT] publish({topic}) -> {ok}, payload='{payload}'")
        return ok
    except Exception as e:
        print(f"[MQTT] Error al publicar: {e}")
        return False

from typing import Optional  # <-- pon este import al inicio del archivo

def build_destination_message(localizador: Localizador.Localizador, codigo_override: Optional[str] = None) -> str:
    """
    Construye el string que espera el Heltec:
    'id lat lng ajuste codigo'
    ajuste: 0/1; lat/lng con 6 decimales.
    """
    lat = float(localizador.destino['lat']) if localizador.destino['lat'] is not None else 0.0
    lng = float(localizador.destino['lng']) if localizador.destino['lng'] is not None else 0.0
    ajuste = 1 if str(localizador.ajuste).lower() in ("1", "true", "sí", "si") else 0
    codigo = codigo_override if codigo_override is not None else str(localizador.codigo)
    return f"{codigo} {lat:.6f} {lng:.6f} "

def topic_publish_field(field: str = PUBLISH_FIELD, channel_id: str = PUBLISH_CHANNEL_ID) -> str:
    return f"channels/{channel_id}/publish/fields/{field}"

