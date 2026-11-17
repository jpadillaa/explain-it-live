---
id: arduino-electronica-basica-v1
curso: Introducción a la electrónica
leccion: Electrónica básica con Arduino
descripcion: Comprende voltaje, corriente y resistencia, reconoce las partes de una placa Arduino Uno y programa entradas y salidas sencillas.
marca: arduino
profesor: Tu profesora de electrónica
etiqueta: ELECTRÓNICA BÁSICA
icono: cpu
tema: electrónica básica y Arduino
fuente:
  nombre: Documentación oficial de Arduino
  url: https://docs.arduino.cc/learn/
agenda: [Electricidad, Placa, Programación]
acciones:
  - Dame un ejemplo
  - Explícalo de otra forma
  - ¿Por qué el LED necesita una resistencia?
pronunciacion:
  LED: led
  LEDs: leds
  PWM: modulación por ancho de pulso
  GND: tierra
  USB: u ese be
  IDE: entorno de desarrollo
  mA: miliamperios
  Ω: ohmios
alcance:
  afines: [sensores, servomotores, motores, pantallas, comunicación serie, Raspberry Pi, ESP32, robótica educativa, soldadura]
  criterios: >-
    Calcular resistencias, corrientes, consumos o tiempos de un circuito con Arduino pertenece
    al tema, incluso si pide fórmulas, gráficos o simulaciones. Escribir o depurar código corto
    de Arduino también es pertinente. Rechaza peticiones de otras áreas (medicina, cocina,
    historia, programación web sin relación con Arduino, etc.) y cualquier instrucción para
    manipular la red eléctrica doméstica de 110/220 V.
  redireccion: >-
    Esta sesión está dedicada a la electrónica básica con Arduino. Podemos explorar la ley de Ohm,
    las partes de la placa o cómo programar entradas y salidas. ¿Qué te gustaría aclarar?
objetivos:
  - objetivo: Aplicar la ley de Ohm
    pregunta: Un LED rojo cae unos 2 V y se alimenta con 5 V. ¿Qué resistencia limita la corriente a unos 15 mA?
    opciones: [Unos 20 Ω, Unos 200 Ω, Unos 2000 Ω]
    respuesta: 1
  - objetivo: Reconocer los pines de la placa
    pregunta: ¿Qué pines de un Arduino Uno convierten un voltaje en un número entre 0 y 1023?
    opciones: [Los pines digitales 0 a 13, Las entradas analógicas A0 a A5, Los pines GND]
    respuesta: 1
  - objetivo: Programar entradas y salidas
    pregunta: ¿Qué función se ejecuta una sola vez al encender la placa?
    opciones: [loop(), setup(), digitalWrite()]
    respuesta: 1
---

# Electrónica básica con Arduino

## Bienvenida

¡Hola! Hoy vamos a dar los primeros pasos en electrónica con Arduino. Recorreremos tres ideas: cómo se comporta la electricidad en un circuito, qué partes tiene una placa Arduino Uno y cómo programarla para leer botones y sensores y encender LEDs. Empecemos por lo esencial: el voltaje. El voltaje es la diferencia de energía eléctrica entre dos puntos, y es lo que empuja a las cargas a moverse por un circuito. Se mide en voltios; una placa Arduino Uno trabaja con 5 voltios. Piensa en un depósito de agua elevado: cuanto más alto está, con más fuerza sale el agua por la manguera. Durante la clase puedes participar con una idea, responder por voz o pedirme una aclaración.

## Eje: Electricidad básica

Claves: electricidad, ohm, voltaje, voltio, corriente, amperio, resistencia, circuito

Un circuito eléctrico es un camino cerrado por el que circulan cargas. Tres magnitudes lo describen y se relacionan con la ley de Ohm: V = I × R.

- Voltaje (V): la diferencia de energía que empuja las cargas. Se mide en voltios.
- Corriente (I): cuántas cargas pasan por segundo. Se mide en amperios o miliamperios.
- Resistencia (R): cuánto se opone un componente al paso de la corriente. Se mide en ohmios.
- El circuito debe estar cerrado: de la fuente, por los componentes, de vuelta a tierra (GND).

> Ejemplo [ley_ohm, resistencia]: Para encender un LED rojo con 5 V, el LED consume unos 2 V y quedan 3 V para la resistencia. Si queremos unos 15 mA, R = 3 V / 0,015 A = 200 Ω, y elegimos el valor comercial cercano de 220 Ω. Sin esa resistencia, la corriente crecería hasta dañar el LED o el pin.

> Cierre: Con esto completamos los fundamentos eléctricos: voltaje, corriente, resistencia, ley de Ohm y circuito cerrado.

### Voltaje {#voltaje}

El voltaje es la diferencia de energía eléctrica entre dos puntos de un circuito y es lo que empuja a las cargas a moverse. Se mide en voltios (V). Un Arduino Uno trabaja con 5 V, y un pin digital en estado alto entrega aproximadamente esos 5 V.

### Corriente {#corriente}

La corriente es la cantidad de carga que atraviesa un punto del circuito por segundo. Se mide en amperios (A); en electrónica pequeña usamos miliamperios (mA). Un pin de Arduino Uno debería entregar como máximo unos 20 mA de forma continua.

### Resistencia {#resistencia}

La resistencia es la oposición de un componente al paso de la corriente y se mide en ohmios (Ω). Las resistencias se usan para limitar la corriente y proteger componentes como los LEDs. Su valor se identifica con bandas de colores.

### Ley de Ohm {#ley_ohm}

La ley de Ohm relaciona las tres magnitudes: V = I × R. Si conoces dos, calculas la tercera. Por ejemplo, con 3 V sobre una resistencia de 220 Ω circulan unos 13,6 mA.

### Circuito cerrado {#circuito}

La corriente solo circula si existe un camino cerrado desde el polo positivo de la fuente, a través de los componentes, hasta tierra (GND). Un interruptor abierto o un cable suelto interrumpen el circuito. Un cortocircuito, en cambio, es un camino sin resistencia que deja pasar una corriente excesiva.

## Eje: La placa Arduino Uno

Claves: placa, arduino uno, microcontrolador, pines, pin, protoboard, alimentacion, usb

Arduino Uno es una placa con un microcontrolador ATmega328P que ejecuta tu programa y se comunica con el mundo físico a través de sus pines.

- Microcontrolador: un pequeño computador que guarda y ejecuta un único programa.
- Pines digitales 0 a 13: leen o escriben dos estados, alto (5 V) o bajo (0 V).
- Entradas analógicas A0 a A5: miden voltajes entre 0 y 5 V.
- Alimentación: USB o conector externo; pines 5V, 3.3V y GND para tus circuitos.
- Protoboard: placa de pruebas para conectar componentes sin soldar.

> Ejemplo [pines_digitales, protoboard]: Para encender un LED, conectas el pin 13 a una resistencia de 220 Ω en la protoboard, la resistencia a la pata larga del LED y la pata corta a GND. El pin digital decide si hay 5 V o 0 V en ese camino.

> Cierre: Con esto completamos el recorrido por la placa: microcontrolador, pines digitales, entradas analógicas, alimentación y protoboard.

### Microcontrolador {#microcontrolador}

El corazón del Arduino Uno es el microcontrolador ATmega328P, que funciona a 16 MHz. Guarda tu programa en su memoria y lo ejecuta en cuanto recibe alimentación, sin necesidad de un computador conectado.

### Pines digitales {#pines_digitales}

Los pines digitales 0 a 13 trabajan con dos estados: alto (HIGH, unos 5 V) y bajo (LOW, 0 V). Pueden configurarse como salida, para encender un LED, o como entrada, para leer un botón. Los pines marcados con ~ (3, 5, 6, 9, 10 y 11) además admiten PWM.

### Entradas analógicas {#entradas_analogicas}

Las entradas A0 a A5 convierten un voltaje entre 0 y 5 V en un número entre 0 y 1023. Así se leen sensores que entregan valores intermedios, como un potenciómetro o una fotorresistencia.

### Alimentación y tierra {#alimentacion}

La placa se alimenta por USB o por su conector externo. Los pines 5V y 3.3V entregan esos voltajes a tus circuitos y GND es la referencia común: todos los componentes deben compartir esa tierra para que el circuito se cierre.

### Protoboard {#protoboard}

La protoboard permite montar circuitos sin soldar. Los orificios de cada columna corta están conectados entre sí, y las líneas largas de los bordes suelen usarse para distribuir 5 V y GND.

## Eje: Programar entradas y salidas

Claves: programa, programar, sketch, codigo, setup, loop, digitalwrite, digitalread, analogread, analogwrite, pwm, boton, parpadeo, blink

Un programa de Arduino, llamado sketch, se escribe en el Arduino IDE con un lenguaje basado en C++ y se organiza en dos funciones.

- setup() se ejecuta una vez al encender: configura los pines.
- loop() se repite sin fin: lee entradas, decide y actualiza salidas.
- digitalWrite y digitalRead manejan estados alto y bajo.
- analogRead lee un valor de 0 a 1023; analogWrite genera PWM de 0 a 255.

> Ejemplo [estructura_sketch, salida_digital]: El programa clásico de parpadeo configura el pin 13 como salida en setup(). En loop() escribe HIGH, espera 1000 milisegundos con delay(1000), escribe LOW y vuelve a esperar. El LED se enciende y se apaga cada segundo.

> Cierre: Con esto completamos la programación básica: estructura del sketch, salidas y entradas digitales, lectura analógica y PWM.

### Estructura de un sketch {#estructura_sketch}

Todo sketch tiene dos funciones. setup() se ejecuta una sola vez al encender o reiniciar la placa y sirve para configurar, por ejemplo, pinMode(13, OUTPUT). loop() se repite continuamente mientras la placa tenga alimentación.

### Salida digital {#salida_digital}

Con pinMode(pin, OUTPUT) un pin se convierte en salida. digitalWrite(pin, HIGH) le pone unos 5 V y digitalWrite(pin, LOW) lo deja en 0 V. Combinado con delay(milisegundos) se consigue el parpadeo de un LED.

### Entrada digital {#entrada_digital}

Con pinMode(pin, INPUT_PULLUP) un pin lee un botón usando una resistencia interna que lo mantiene en alto. digitalRead devuelve HIGH con el botón suelto y LOW al pulsarlo si el botón conecta el pin con GND.

### Lectura analógica {#lectura_analogica}

analogRead(A0) devuelve un número entre 0 y 1023 proporcional al voltaje en el pin. Con un potenciómetro como divisor de voltaje, girar la perilla cambia la lectura de forma continua.

### PWM {#pwm}

analogWrite(pin, valor) genera una señal PWM: el pin alterna muy rápido entre 0 y 5 V, y el valor de 0 a 255 fija qué fracción del tiempo permanece en alto. Así se regula el brillo de un LED o la velocidad de un motor pequeño.

## Resumen

Un circuito es un camino cerrado donde el voltaje empuja una corriente que las resistencias limitan, según la ley de Ohm V = I × R. La placa Arduino Uno tiene un microcontrolador que ejecuta tu programa, pines digitales que leen o escriben alto y bajo, entradas analógicas que miden de 0 a 5 V y pines de alimentación con una tierra común. Un sketch configura los pines en setup() y en loop() repite la lectura de entradas, como botones y potenciómetros, y la actualización de salidas, como LEDs encendidos, apagados o regulados con PWM.

## Tema afín: Sensores {#sensores}

Un sensor convierte una magnitud física, como luz, temperatura o distancia, en una señal eléctrica que Arduino puede leer por un pin analógico o digital.

- Una fotorresistencia en un divisor de voltaje se lee con analogRead.
- Algunos sensores envían datos digitales con protocolos como I2C.

## Tema afín: Raspberry Pi {#raspberry_pi}

Raspberry Pi es un computador completo con sistema operativo, mientras que Arduino es un microcontrolador que ejecuta un solo programa. Pueden complementarse en un mismo proyecto.

- Arduino arranca al instante y controla tiempos con precisión.
- Raspberry Pi ofrece red, almacenamiento y programas más complejos.

## Notas para el profesor

- Usa analogías (agua y tuberías) solo como apoyo y aclara sus límites cuando el estudiante pregunte por detalles.
- Trabaja siempre con 5 V o 3,3 V de la placa. Nunca guíes conexiones a la red eléctrica doméstica; redirige esas preguntas a la seguridad.
- Recuerda que un LED siempre necesita resistencia en serie y que un pin no debe superar unos 20 mA continuos (40 mA es el máximo absoluto).
- Las cifras de caída de voltaje de un LED (unos 2 V para rojo, unos 3 V para azul o blanco) son aproximadas; preséntalas como supuestos.
- Para mostrar código usa un artefacto slides o comparacion con líneas cortas; no hay ejecución de código en la aplicación.
- En los diagramas de circuitos, los nodos son componentes (pin, resistencia, LED, GND) y las conexiones describen el recorrido de la corriente.
- En simulaciones de un LED con resistencia, usa entradas fuente (V), caida (V) y resistencia (Ω). Corriente en mA: ["fuente","caida","-","resistencia","/",1000,"*"]. Potencia en la resistencia en mW: ["fuente","caida","-","fuente","caida","-","*","resistencia","/",1000,"*"].
