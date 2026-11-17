---
# Identificador de la lección. También es la clave de localStorage para notas y progreso.
id: nube-tutor-nist-v2
curso: Fundamentos de computación en la nube
leccion: Fundamentos de nube según NIST
descripcion: Comprende la definición de nube y distingue sus modelos de servicio y despliegue.
marca: nube
profesor: Tu profesor de nube
etiqueta: FUNDAMENTOS DE NUBE
icono: cloud
tema: computación en la nube
fuente:
  nombre: NIST SP 800-145
  url: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf
agenda: [Definición, Servicios, Despliegues]
acciones:
  - Dame un ejemplo
  - Explícalo de otra forma
  - ¿Qué es multicloud?
pronunciacion:
  NIST: Instituto Nacional de Estándares y Tecnología
  IaaS: infraestructura como servicio
  PaaS: plataforma como servicio
  SaaS: software como servicio
  cloud: nube
  API: interfaz de programación
alcance:
  afines: [multicloud, serverless, virtualización, seguridad cloud, proveedores, migración, costos, arquitectura cloud]
  criterios: >-
    Simular demanda, balanceo, capacidad, instancias, costos, almacenamiento o disponibilidad
    pertenece a CLOUD, incluso si pide fórmulas, gráficos, números o controles.
    Rechaza peticiones de otras áreas (medicina, cocina, historia, matemáticas sin relación cloud,
    meteorología, etc.), incluso si incluyen palabras como nube.
  redireccion: >-
    Esta sesión está dedicada a computación en la nube. Podemos explorar la definición de NIST,
    sus modelos o conceptos afines como multicloud. ¿Qué te gustaría aclarar sobre nube?
objetivos:
  - objetivo: Definir cloud computing
    pregunta: ¿Qué describe cloud computing según NIST?
    opciones:
      - Cualquier servidor conectado a Internet
      - Acceso por red bajo demanda a recursos compartidos y configurables
      - Solo aplicaciones instaladas en tu computador
    respuesta: 1
  - objetivo: Distinguir IaaS, PaaS y SaaS
    pregunta: ¿En qué modelo despliegas tus aplicaciones usando la plataforma del proveedor?
    opciones: [IaaS, PaaS, SaaS]
    respuesta: 1
  - objetivo: Reconocer los despliegues
    pregunta: ¿Qué despliegue integra nubes distintas y permite portabilidad de datos y aplicaciones?
    opciones: [Público, Comunitario, Híbrido]
    respuesta: 2
---

# Fundamentos de nube según NIST

## Bienvenida

¡Hola! Hoy vamos a estudiar la definición de computación en la nube de NIST, los modelos de servicio IaaS, PaaS y SaaS, y los modelos de despliegue público, privado, comunitario e híbrido. Empecemos con una idea: usar recursos de cómputo cuando los necesitas, sin tener que prepararlos todos de antemano. Según NIST, la nube permite acceder por red y bajo demanda a recursos configurables compartidos que se pueden aprovisionar y liberar rápidamente con muy poca gestión. Piensa en solicitar almacenamiento y empezar a usarlo en minutos. Durante la clase puedes participar con una idea, responder por voz o pedirme una aclaración. Con esta idea de partida podemos seguir explorando cómo funciona la nube.

## Eje: ¿Qué es computación en la nube?

Claves: nist, cloud, nube, definicion, caracteristica

Según NIST, permite acceder por red, de forma ubicua, conveniente y bajo demanda, a recursos de cómputo configurables compartidos. Se aprovisionan y liberan rápidamente con un esfuerzo de gestión o interacción con el proveedor mínimo. Paráfrasis de SP 800-145.

- Autoservicio bajo demanda y acceso amplio por red.
- Recursos compartidos y elasticidad rápida.
- Servicio medido para controlar y reportar el uso.

> Ejemplo [definicion]: Imagina que necesitas espacio para guardar archivos. En la nube puedes solicitar almacenamiento por red cuando lo necesitas y liberarlo después. Esta idea ilustra el acceso bajo demanda a recursos compartidos.

> Cierre: Con esto completamos la definición de nube del NIST y sus cinco características.

### Definición {#definicion}

Según NIST, permite acceder por red, de forma ubicua, conveniente y bajo demanda, a recursos de cómputo configurables compartidos. Se aprovisionan y liberan rápidamente con un esfuerzo de gestión o interacción con el proveedor mínimo. Paráfrasis de SP 800-145.

### Autoservicio bajo demanda {#autoservicio}

Con el autoservicio bajo demanda solicitas recursos por tu cuenta, sin que una persona del proveedor tenga que intervenir.

### Acceso amplio por red {#acceso_red}

El acceso amplio por red te permite utilizar esos recursos desde equipos distintos mediante mecanismos estándar.

### Agrupación de recursos {#agrupacion}

La agrupación de recursos permite al proveedor atender a varios consumidores y reasignar capacidad según sus necesidades.

### Elasticidad rápida {#elasticidad}

La elasticidad rápida permite aumentar o liberar esa capacidad cuando cambia la demanda.

### Servicio medido {#servicio_medido}

Con el servicio medido, el uso se registra y se puede supervisar y comunicar, por ejemplo en gigabytes de almacenamiento.

## Eje: Tres modelos de servicio

Claves: servicio, iaas, paas, saas

Los modelos describen qué capacidad recibe el consumidor y qué partes puede administrar.

- IaaS. Aprovisionas cómputo, almacenamiento y red. Controlas sistemas operativos y aplicaciones.
- PaaS. Despliegas tus aplicaciones en una plataforma soportada por el proveedor.
- SaaS. Utilizas las aplicaciones del proveedor con opciones limitadas de configuración.

> Ejemplo [iaas, paas, saas]: Para publicar un sitio web, con IaaS administrarías el sistema operativo y tu aplicación. Con PaaS desplegarías tu aplicación en una plataforma gestionada. Con SaaS usarías una aplicación ya disponible del proveedor.

> Cierre: Con esto completamos los tres modelos de servicio: IaaS, PaaS y SaaS.

### IaaS {#iaas}

IaaS. Aprovisionas cómputo, almacenamiento y red. Controlas sistemas operativos y aplicaciones.

### PaaS {#paas}

PaaS. Despliegas tus aplicaciones en una plataforma soportada por el proveedor.

### SaaS {#saas}

SaaS. Utilizas las aplicaciones del proveedor con opciones limitadas de configuración.

## Eje: Cuatro modelos de despliegue

Claves: despliegue, publica, privada, comunitaria, hibrid

NIST los distingue por quién puede usar la infraestructura y cómo se compone.

- Privada. Uso exclusivo de una organización. Puede estar dentro o fuera de sus instalaciones.
- Comunitaria. Uso exclusivo de organizaciones con intereses compartidos.
- Pública. Abierta al uso del público general.
- Híbrida. Integra dos o más nubes distintas mediante tecnología que permite portabilidad de datos y aplicaciones.

> Ejemplo [privada, hibrida]: Una organización puede usar una nube privada de uso exclusivo y una nube pública. Si integra ambas con tecnología que permite portabilidad de datos y aplicaciones, hablamos de un despliegue híbrido.

> Cierre: Con esto completamos los cuatro modelos de despliegue: privado, comunitario, público e híbrido.

### Nube privada {#privada}

Privada. Uso exclusivo de una organización. Puede estar dentro o fuera de sus instalaciones.

### Nube comunitaria {#comunitaria}

Comunitaria. Uso exclusivo de organizaciones con intereses compartidos.

### Nube pública {#publica}

Pública. Abierta al uso del público general.

### Nube híbrida {#hibrida}

Híbrida. Integra dos o más nubes distintas mediante tecnología que permite portabilidad de datos y aplicaciones.

## Resumen

La computación en la nube permite solicitar por red recursos compartidos bajo demanda, ajustar su capacidad y medir el uso. Los modelos de servicio distinguen qué administras: en IaaS controlas el sistema operativo y tus aplicaciones, en PaaS despliegas tu aplicación y en SaaS utilizas la aplicación del proveedor. Los despliegues distinguen quién usa la infraestructura: una organización en la nube privada, una comunidad con intereses comunes en la comunitaria y el público general en la pública. La nube híbrida integra infraestructuras distintas para permitir la portabilidad de datos y aplicaciones.

## Tema afín: Multicloud {#multicloud}

Multicloud significa utilizar servicios de varios proveedores cloud. Puede coexistir con una nube híbrida. Es un concepto afín y no figura entre los cuatro modelos de despliegue de NIST SP 800-145.

- Ejemplo ilustrativo: servicios en Azure y AWS.
- La integración y la portabilidad distinguen el despliegue híbrido.

## Notas para el profesor

- Explica las cinco características al aclarar la definición. La definición española es una paráfrasis de NIST SP 800-145, no una traducción oficial.
- Los modelos de despliegue se distinguen por uso y composición; no atribuyas seguridad o alta disponibilidad garantizadas a una nube por ser pública o privada.
- Multicloud es afín y no es un quinto despliegue NIST.
- En los diagramas de arquitectura, las etiquetas de conexiones describen el flujo real: nunca des a entender que una solicitud se replica a todas las instancias.
- En las simulaciones de capacidad, para exceso de demanda usa exactamente ["demanda","instancias",100,"*","-",0,"max"] y para la capacidad ["instancias",100,"*"]. Ejemplo de costo: ["instancias","horas","*","tarifa","*"].
- No atribuyas a NIST las cifras inventadas ni presentes supuestos como resultados de infraestructura real.
