# 00 - Visión del Proyecto

# ParkControl

## Descripción

ParkControl es un sistema integral diseñado para la gestión operativa y administrativa de playas de acarreo de vehículos.

El proyecto surge con el objetivo de centralizar en una única plataforma todos los procesos involucrados en el ciclo de vida de un vehículo acarreado, desde el momento en que una grúa registra el operativo hasta el egreso del vehículo de la playa.

Actualmente, muchas de estas tareas se realizan mediante procesos manuales o utilizando distintos sistemas independientes, dificultando el seguimiento de las operaciones, el control de los recursos y la obtención de información confiable para la toma de decisiones.

ParkControl propone una solución unificada que permite administrar tanto los recursos de cada sucursal como las operaciones diarias realizadas por los distintos actores involucrados.

---

# Objetivos

## Objetivo General

Desarrollar un sistema web y móvil que permita administrar de manera eficiente, segura y auditable la operatoria completa de una playa de acarreo de vehículos.

## Objetivos Específicos

* Centralizar la información de todas las sucursales.
* Administrar usuarios y permisos según su rol.
* Gestionar cajas, barreras y grúas.
* Gestionar los turnos operativos.
* Registrar nuevos acarreos desde dispositivos móviles.
* Registrar daños observados durante el acarreo.
* Gestionar el ingreso de vehículos a la playa.
* Calcular automáticamente los importes a cobrar.
* Registrar cobros utilizando distintos medios de pago.
* Gestionar el egreso de vehículos.
* Registrar todas las acciones realizadas mediante un sistema de auditoría.
* Generar reportes operativos y administrativos.

---

# Alcance

El sistema contempla la administración completa de una playa de acarreo, incluyendo tanto las tareas administrativas como las operativas.

La solución estará compuesta por dos aplicaciones:

## Aplicación Web

Destinada al personal administrativo y operativo de la playa.

Permitirá realizar la gestión de usuarios, sucursales, recursos, turnos, cobros, consultas, reportes y auditorías.

## Aplicación Móvil

Destinada al personal encargado de los acarreos.

Permitirá registrar nuevos operativos de acarreo, consultar el historial de acarreos realizados y cargar toda la información necesaria del vehículo durante el operativo.

---

# Roles del Sistema

El sistema distingue distintos perfiles de usuario, cada uno con responsabilidades específicas.

## Sistemas

Responsable de la administración general del sistema.

Puede administrar:

* Usuarios
* Sucursales
* Cajas
* Barreras
* Grúas
* Tarifas
* Auditoría

---

## Supervisor

Responsable de coordinar la operación diaria de una sucursal.

Entre sus funciones se encuentran:

* Asignar choferes y enganchadores a las grúas.
* Supervisar el estado operativo de la sucursal.
* Consultar movimientos de cajas.
* Consultar movimientos de grúas.
* Gestionar vehículos sin cargo.
* Supervisar el funcionamiento general de la playa.

---

## Cajero

Responsable de realizar los cobros correspondientes a los vehículos acarreado.

Sus principales funciones son:

* Abrir y cerrar turnos de caja.
* Seleccionar una caja disponible.
* Buscar vehículos por patente.
* Calcular automáticamente el importe a cobrar.
* Registrar cobros.
* Emitir el informe de cierre de turno.

---

## Playero

Responsable de recibir los vehículos al ingresar a la playa.

Sus funciones incluyen:

* Confirmar el ingreso del vehículo.
* Corregir información del vehículo si fuera necesario.
* Consultar el estado de los vehículos presentes en la playa.

---

## Enganchador

Responsable del registro operativo de los acarreos mediante la aplicación móvil.

Puede:

* Consultar la grúa asignada.
* Registrar nuevos acarreos.
* Cargar datos del vehículo.
* Registrar daños observados.
* Consultar su historial de acarreos.

---

# Flujo General del Sistema

El funcionamiento general del sistema puede resumirse en las siguientes etapas:

1. El supervisor asigna el personal a cada grúa.
2. El enganchador registra un nuevo acarreo desde la aplicación móvil.
3. El vehículo llega a la playa.
4. El playero confirma el ingreso del vehículo.
5. El cajero registra el cobro correspondiente.
6. En caso de corresponder, el supervisor puede autorizar un egreso sin cargo.
7. La barrera verifica el estado del vehículo y registra su egreso.
8. El cajero realiza el cierre de turno y genera el informe correspondiente.

---

# Principios del Proyecto

Durante el desarrollo de ParkControl se buscará cumplir los siguientes principios:

* Simplicidad en la interfaz de usuario.
* Separación clara de responsabilidades según el rol.
* Registro completo de auditoría de todas las operaciones.
* Integridad y consistencia de la información.
* Escalabilidad para incorporar nuevas funcionalidades.
* Seguridad mediante autenticación y autorización basada en roles.
* Trazabilidad completa del ciclo de vida de cada vehículo.

---

# Visión a Futuro

ParkControl se proyecta como una plataforma capaz de gestionar integralmente la operatoria de múltiples playas de acarreo, facilitando el trabajo diario del personal, reduciendo errores operativos y proporcionando información confiable para la toma de decisiones mediante reportes y auditorías.

La arquitectura del sistema permitirá incorporar nuevas funcionalidades en futuras versiones, tales como notificaciones, estadísticas avanzadas, integración con sistemas externos y mejoras en la gestión operativa.
