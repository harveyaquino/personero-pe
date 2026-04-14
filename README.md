# Personero.pe

Sistema multi-partido de registro de actas electorales — Elecciones Generales 2026 Perú.
Cada partido ve exclusivamente sus propios datos. Aislamiento total por RLS.

Stack: React + Vite + Tailwind | Supabase (Auth + DB + RLS) | Vercel

---

## Setup completo — 11 pasos

### PASO 1 — Clonar y configurar

    git clone https://github.com/harveyaquino/personero-pe.git
    cd personero-pe
    npm install
    cp .env.example .env.local
    # Edita .env.local con tus credenciales de Supabase

### PASO 2 — Crear proyecto en Supabase

1. supabase.com → New project
2. Nombre: personero-pe | Región: South America (São Paulo)
3. Project Settings → API → copia Project URL y anon key

### PASO 3 — Ejecutar el schema SQL

1. Supabase Dashboard → SQL Editor → New query
2. Pega todo el contenido de schema_actas_eg2026.sql
3. Run (sin errores)

Crea: 8 tablas con RLS, 37 partidos ONPE, 5 categorías, funciones,
vistas seguras, índices y triggers.

### PASO 4 — Configurar Auth

Authentication → Settings:
- Email confirmations: OFF
- Minimum password length: 10
- Session duration: 14400 (4 horas)

### PASO 5 — Crear Superadmin

En Supabase Auth → Add user → email: admin@sistema.pe | Auto Confirm: ON

Luego en SQL Editor:

    -- Obtén el UUID:
    SELECT id FROM auth.users WHERE email = 'admin@sistema.pe';

    -- Crea el perfil (reemplaza el UUID):
    INSERT INTO perfiles (id, partido_id, rol, nombre, activo)
    VALUES ('TU-UUID-AQUI', NULL, 'superadmin', 'Super Admin', true);

### PASO 6 — Crear admin por partido

En Auth → Add user → email del admin del partido | Auto Confirm: ON

    -- Obtén los UUIDs:
    SELECT id FROM auth.users WHERE email = 'admin@partido.pe';
    SELECT id FROM partidos WHERE codigo = 'FPO';

    -- Crea el perfil:
    INSERT INTO perfiles (id, partido_id, rol, nombre, activo)
    VALUES ('UUID-USER', 'UUID-PARTIDO', 'admin_partido', 'Admin Partido', true);

### PASO 7 — Crear mesas electorales

Desde el panel Superadmin (/superadmin tab Mesas) o via SQL:

    INSERT INTO mesas (numero, local_nombre, distrito, provincia, departamento, electores_habiles)
    VALUES
      ('001', 'I.E. San Martin', 'Miraflores', 'Lima', 'Lima', 300),
      ('002', 'I.E. San Martin', 'Miraflores', 'Lima', 'Lima', 298);

### PASO 8 — Activar Realtime

Supabase → Database → Replication:
- Activa replication para tablas: actas, acta_votos

### PASO 9 — Push a GitHub

    git add .
    git commit -m "feat: sistema actas EG2026 multi-partido RLS"
    git branch -M main
    git push -u origin main

### PASO 10 — Deploy en Vercel

vercel.com → New Project → importa harveyaquino/personero-pe

En Environment Variables agrega:
    VITE_SUPABASE_URL = https://tu-proyecto.supabase.co
    VITE_SUPABASE_ANON_KEY = eyJ...

Deploy.

### PASO 11 — Invitar personeros

El admin del partido, desde /admin → Personeros:
1. Ingresa email del personero + mesa
2. Click Enviar invitación
3. Comparte el link: https://tu-app.vercel.app/registro?token=TOKEN
4. El personero completa su registro
5. Ya puede ingresar a /personero y registrar votos

---

## Seguridad implementada

- RLS activo en todas las tablas
- mi_partido_id() SECURITY DEFINER (no manipulable)
- Audit log inmutable (REVOKE UPDATE/DELETE en BD)
- Actas no borrables (policy DELETE = false)
- Hash SHA-256 al enviar acta
- Bloqueo tras 5 intentos fallidos
- Sesiones de 4 horas
- Invitaciones con expiración 48h y uso único
- .env.local excluido de git

---

Desarrollado por Harvey Aquino | linkedin.com/in/harveyaquinomas
VeyharCorp — AI-Powered Tools

---

## Schema v2 — Optimizaciones aplicadas

El schema fue optimizado para producción en Supabase PostgreSQL 15+:

### 1. JWT Claims O(1) — sin tocar la BD en cada fila RLS
Las funciones mi_rol() y mi_partido_id() leen directamente del token
JWT en memoria usando current_setting('request.jwt.claims').
Antes: 1 SELECT a perfiles por cada fila evaluada (N+1).
Ahora: coste cero, lectura de RAM.
Requiere instalar el Auth Hook (ver PASO 3b).

### 2. security_invoker = true en vistas
Las vistas v_avance_mesas y v_resultados_partido usan
WITH (security_invoker = true), lo que hace que respeten el RLS
de las tablas subyacentes. Sin esto, las vistas bypassean el RLS.

### 3. ENUMs en lugar de TEXT CHECK
Los campos rol, estado y resultado usan tipos ENUM nativos de
PostgreSQL (tipo_rol, estado_acta, resultado_audit). Esto reduce
el tamaño en disco, acelera los índices y protege integridad a nivel de tipo.

### 4. SET search_path = public en SECURITY DEFINER
Todas las funciones con SECURITY DEFINER tienen SET search_path = public
para prevenir ataques de search path hijacking.

### 5. gen_random_uuid() nativo
Se reemplazó uuid_generate_v4() (extensión legacy uuid-ossp) por
gen_random_uuid() nativo de pgcrypto, ya incluido en PG 13+.

---

## PASO 3b — Instalar el Auth Hook (JWT Claims)

Este paso es obligatorio para que el RLS funcione con rendimiento O(1).

En Supabase SQL Editor ejecuta el contenido de auth_hook.sql.

Luego:
1. Ve a Authentication → Hooks
2. En "Customize Access Token (JWT) Claim":
   - Schema: public
   - Function: custom_access_token_hook
3. Guarda

A partir de ese momento, cada JWT incluirá:
    { "rol": "personero", "partido_id": "uuid-...", "activo": true }

Y las policies RLS de todas las tablas leerán esos valores
directamente de memoria sin hacer queries adicionales a la BD.

