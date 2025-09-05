class Localizador:
    def __init__(self, id_localizador, topic_mqtt, codigo, ajuste=False):
        self.id = id_localizador
        self.topic_mqtt = topic_mqtt
        self.codigo = codigo
        self.ajuste = ajuste
        self.mensaje = ""  #ultimo mensaje recibido
        self.codIngresado = ""
        self.coordenadas = dict(lat="-2.0528875", lng="-79.9351418")
        self.desbloquear = False
        self.destino= dict(lat=None, lng=None)

    def nuevo_mensaje(self, mensaje):
        """Agrega un nuevo mensaje recibido del canal MQTT."""
        self.mensaje=mensaje

    def actualizar_codigo(self, nuevo_codigo):
        """Permite cambiar el código del localizador."""
        self.codigo = nuevo_codigo

    def set_ajuste(self, estado: bool):
        """Actualiza el estado del ajuste del brazalete."""
        self.ajuste = estado

    def set_codIngresado(self, codigo: bool):
        """Actualiza el codigo ingresado por el usuario."""
        self.codIngresado = codigo
        
    def set_coordenadas(self, coordenadas: list):
        '''Actualiza las coordenadas del localizador.'''
        self.coordenadas['lat'] = coordenadas[0]
        self.coordenadas['lng'] = coordenadas[1]
        
    def set_desbloquear(self, estado: bool):
        """Actualiza el estado de desbloqueo del localizador."""
        self.desbloquear = estado

    def set_destino(self, lat: float, lng: float):
        """Actualiza las coordenadas de destino del localizador."""
        self.destino['lat'] = lat
        self.destino['lng'] = lng

    def __repr__(self):
        return f"<Localizador {self.id} - Topic: {self.topic_mqtt}>"
