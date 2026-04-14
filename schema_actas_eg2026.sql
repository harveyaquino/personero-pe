-- ============================================================
-- SISTEMA DE ACTAS EG 2026 — Supabase Schema (Optimizado v2)
-- Harvey Aquino · VeyharCorp
-- Optimizaciones: JWT claims O(1), ENUMs, security_invoker,
-- gen_random_uuid(), SET search_path en SECURITY DEFINER
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE tipo_rol       AS ENUM ('superadmin', 'admin_partido', 'personero');
CREATE TYPE estado_acta    AS ENUM ('borrador', 'enviado', 'observado', 'validado');
CREATE TYPE resultado_audit AS ENUM ('ok', 'error', 'bloqueado');

-- ============================================================
-- 1. PARTIDOS POLÍTICOS
-- ============================================================
CREATE TABLE partidos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     TEXT UNIQUE NOT NULL,
  nombre     TEXT NOT NULL,
  color_hex  TEXT DEFAULT '#888888',
  logo_url   TEXT,
  activo     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO partidos (codigo, nombre, color_hex) VALUES
  ('AEV','Alianza Electoral Venceremos','#1B4FBE'),
  ('PPP','Partido Patriótico del Perú','#C8102E'),
  ('PCO','Partido Cívico Obras','#D97706'),
  ('FPA','Frente Popular Agrícola del Perú','#1A7A3E'),
  ('PDV','Partido Demócrata Verde','#2E7D32'),
  ('PBG','Partido del Buen Gobierno','#E65100'),
  ('PPA','Partido Político Perú Acción','#6A1B9A'),
  ('PRI','Partido Político PRIN','#B71C1C'),
  ('PRO','Progresemos','#00695C'),
  ('SIC','Partido SÍCREO','#37474F'),
  ('PPT','Partido País para todos','#1565C0'),
  ('FE2','Frente de la Esperanza 2021','#4527A0'),
  ('PPL','Partido Político Perú Libre','#C62828'),
  ('PLG','Primero La Gente','#F9A825'),
  ('JPP','Juntos por el Perú','#558B2F'),
  ('PDM','Podemos Perú','#1976D2'),
  ('PDF','Partido Democrático Federal','#AD1457'),
  ('PFP','Partido Político Fe en el Perú','#E65100'),
  ('IDE','Integridad Democrática','#283593'),
  ('FPO','Fuerza Popular','#F57F17'),
  ('APP','Alianza para el Progreso','#1B5E20'),
  ('COP','Partido Cooperación Popular','#880E4F'),
  ('AHN','Ahora Nación – AN','#BF360C'),
  ('PLP','Partido Libertad Popular','#4A148C'),
  ('UCD','Un camino diferente','#006064'),
  ('AVP','Avanza País','#E53935'),
  ('PPM','Partido Perú Moderno','#0277BD'),
  ('PPR','Partido Perú Primero','#2E7D32'),
  ('SLP','Salvemos al Perú','#C62828'),
  ('SPP','Partido Somos Perú','#1565C0'),
  ('APR','Partido Aprista Peruano','#B71C1C'),
  ('RNP','Renovación Popular','#0D47A1'),
  ('DUP','Partido Demócrata Unido Perú','#1A237E'),
  ('FYL','Fuerza y Libertad','#E65100'),
  ('PTE','PTE-Perú (Trabajadores y Emprendedores)','#1B5E20'),
  ('UNA','Unidad Nacional','#37474F'),
  ('PMO','Partido Morado','#6A1B9A');

-- ============================================================
-- 2. PERFILES
-- ============================================================
CREATE TABLE perfiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  partido_id        UUID REFERENCES partidos(id),
  rol               tipo_rol NOT NULL,
  nombre            TEXT NOT NULL,
  dni               TEXT,
  telefono          TEXT,
  activo            BOOLEAN DEFAULT TRUE,
  intentos_fallidos INT DEFAULT 0,
  bloqueado_hasta   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. MESAS Y ASIGNACIÓN
-- ============================================================
CREATE TABLE mesas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            TEXT UNIQUE NOT NULL,
  local_nombre      TEXT NOT NULL,
  direccion         TEXT,
  distrito          TEXT NOT NULL,
  provincia         TEXT NOT NULL,
  departamento      TEXT NOT NULL,
  ubigeo            TEXT,
  electores_habiles INT DEFAULT 0,
  activa            BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE personero_mesa (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personero_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  mesa_id      UUID NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
  partido_id   UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  activo       BOOLEAN DEFAULT TRUE,
  assigned_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mesa_id, partido_id)
);

-- ============================================================
-- 4. CATEGORÍAS
-- ============================================================
CREATE TABLE categorias (
  id     SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  orden  INT NOT NULL
);

INSERT INTO categorias (codigo, nombre, orden) VALUES
  ('PRES',  'Presidente y Vicepresidente', 1),
  ('SEN_N', 'Senadores — Nivel Nacional',  2),
  ('SEN_R', 'Senadores — Nivel Regional',  3),
  ('DIP',   'Diputados',                   4),
  ('PARL',  'Parlamento Andino',           5);

-- ============================================================
-- 5. ACTAS Y VOTOS
-- ============================================================
CREATE TABLE actas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mesa_id         UUID NOT NULL REFERENCES mesas(id) ON DELETE RESTRICT,
  partido_id      UUID NOT NULL REFERENCES partidos(id) ON DELETE RESTRICT,
  personero_id    UUID NOT NULL REFERENCES perfiles(id) ON DELETE RESTRICT,
  categoria_id    INT NOT NULL REFERENCES categorias(id),
  votos_validos   INT DEFAULT 0,
  votos_nulos     INT DEFAULT 0,
  votos_blancos   INT DEFAULT 0,
  total_votantes  INT DEFAULT 0,
  estado          estado_acta NOT NULL DEFAULT 'borrador',
  hash_acta       TEXT,
  ip_envio        TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  enviado_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mesa_id, partido_id, categoria_id)
);

CREATE TABLE acta_votos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acta_id           UUID NOT NULL REFERENCES actas(id) ON DELETE CASCADE,
  partido_votado_id UUID NOT NULL REFERENCES partidos(id),
  votos             INT NOT NULL DEFAULT 0 CHECK (votos >= 0),
  voto_preferencial INT,
  UNIQUE(acta_id, partido_votado_id)
);

-- ============================================================
-- 6. AUDIT LOG (INMUTABLE) E INVITACIONES
-- ============================================================
CREATE TABLE audit_log (
  id            BIGSERIAL PRIMARY KEY,
  ts            TIMESTAMPTZ DEFAULT NOW(),
  usuario_id    UUID REFERENCES auth.users(id),
  usuario_email TEXT,
  partido_id    UUID REFERENCES partidos(id),
  rol           TEXT,
  accion        TEXT NOT NULL,
  detalle       JSONB,
  ip            TEXT,
  user_agent    TEXT,
  resultado     resultado_audit DEFAULT 'ok'
);

-- Inmutabilidad: nadie puede editar ni borrar el log
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;
REVOKE UPDATE, DELETE ON audit_log FROM authenticated;

CREATE TABLE invitaciones (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  partido_id UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  mesa_id    UUID REFERENCES mesas(id),
  email      TEXT NOT NULL,
  nombre     TEXT,
  usado      BOOLEAN DEFAULT FALSE,
  expira_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '48 hours',
  created_by UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. HELPERS RLS — OPTIMIZADOS CON JWT (O(1), sin tocar la BD)
-- Leen rol y partido_id directo del token en memoria.
-- Requiere el Auth Hook (ver auth_hook.sql) para inyectar
-- estos valores en app_metadata al momento del login.
-- ============================================================
CREATE OR REPLACE FUNCTION mi_partido_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'partido_id',
    ''
  )::UUID;
$$;

CREATE OR REPLACE FUNCTION mi_rol()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb
    -> 'app_metadata' ->> 'rol';
$$;

-- Esta sí toca la BD pero solo se usa en casos puntuales, no en selects masivos
CREATE OR REPLACE FUNCTION mi_mesa_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT mesa_id FROM personero_mesa
  WHERE personero_id = auth.uid() AND activo = TRUE
  LIMIT 1;
$$;

-- ============================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE perfiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE personero_mesa ENABLE ROW LEVEL SECURITY;
ALTER TABLE actas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE acta_votos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitaciones   ENABLE ROW LEVEL SECURITY;

-- PERFILES
CREATE POLICY perfiles_select ON perfiles FOR SELECT USING (
  mi_rol() = 'superadmin'
  OR (mi_rol() = 'admin_partido' AND partido_id = mi_partido_id())
  OR id = auth.uid()
);
CREATE POLICY perfiles_insert ON perfiles FOR INSERT WITH CHECK (
  mi_rol() IN ('superadmin', 'admin_partido')
);
CREATE POLICY perfiles_update ON perfiles FOR UPDATE USING (
  mi_rol() = 'superadmin'
  OR (mi_rol() = 'admin_partido' AND partido_id = mi_partido_id())
  OR id = auth.uid()
);

-- MESAS: todos los autenticados ven, solo superadmin modifica
CREATE POLICY mesas_select ON mesas FOR SELECT TO authenticated USING (true);
CREATE POLICY mesas_all    ON mesas FOR ALL   USING (mi_rol() = 'superadmin');

-- PERSONERO_MESA
CREATE POLICY pm_select ON personero_mesa FOR SELECT USING (
  mi_rol() = 'superadmin'
  OR (mi_rol() = 'admin_partido' AND partido_id = mi_partido_id())
  OR personero_id = auth.uid()
);
CREATE POLICY pm_insert ON personero_mesa FOR INSERT WITH CHECK (
  mi_rol() = 'superadmin'
  OR (mi_rol() = 'admin_partido' AND partido_id = mi_partido_id())
);
CREATE POLICY pm_update ON personero_mesa FOR UPDATE USING (
  mi_rol() = 'superadmin'
  OR (mi_rol() = 'admin_partido' AND partido_id = mi_partido_id())
);

-- ACTAS: aislamiento total por partido
CREATE POLICY actas_select ON actas FOR SELECT USING (
  mi_rol() = 'superadmin' OR partido_id = mi_partido_id()
);
CREATE POLICY actas_insert ON actas FOR INSERT WITH CHECK (
  partido_id = mi_partido_id()
  AND personero_id = auth.uid()
  AND mi_rol() = 'personero'
);
CREATE POLICY actas_update ON actas FOR UPDATE USING (
  (mi_rol() = 'personero' AND personero_id = auth.uid() AND estado = 'borrador')
  OR (mi_rol() IN ('superadmin', 'admin_partido') AND partido_id = mi_partido_id())
);
-- Nadie borra actas
CREATE POLICY actas_delete ON actas FOR DELETE USING (false);

-- ACTA_VOTOS
CREATE POLICY av_select ON acta_votos FOR SELECT USING (
  mi_rol() = 'superadmin'
  OR EXISTS (
    SELECT 1 FROM actas a
    WHERE a.id = acta_id AND a.partido_id = mi_partido_id()
  )
);
CREATE POLICY av_all ON acta_votos FOR ALL USING (
  EXISTS (
    SELECT 1 FROM actas a
    WHERE a.id = acta_id
      AND a.partido_id = mi_partido_id()
      AND a.estado = 'borrador'
  )
);
-- Nadie borra votos
CREATE POLICY av_delete ON acta_votos FOR DELETE USING (false);

-- AUDIT LOG
CREATE POLICY audit_select ON audit_log FOR SELECT USING (
  mi_rol() = 'superadmin'
  OR (mi_rol() = 'admin_partido' AND partido_id = mi_partido_id())
);
CREATE POLICY audit_insert ON audit_log FOR INSERT WITH CHECK (true);

-- INVITACIONES
CREATE POLICY inv_select ON invitaciones FOR SELECT USING (
  mi_rol() = 'superadmin'
  OR (mi_rol() = 'admin_partido' AND partido_id = mi_partido_id())
);
CREATE POLICY inv_insert ON invitaciones FOR INSERT WITH CHECK (
  mi_rol() IN ('superadmin', 'admin_partido')
  AND partido_id = mi_partido_id()
);
CREATE POLICY inv_update ON invitaciones FOR UPDATE USING (
  mi_rol() IN ('superadmin', 'admin_partido')
  AND partido_id = mi_partido_id()
);

-- ============================================================
-- 9. FUNCIÓN ENVIAR ACTA (SECURITY DEFINER + search_path)
-- SET search_path = public previene search path hijacking
-- ============================================================
CREATE OR REPLACE FUNCTION enviar_acta(p_acta_id UUID, p_ip TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_acta        actas;
  v_hash        TEXT;
  v_total_votos INT;
BEGIN
  SELECT * INTO v_acta FROM actas WHERE id = p_acta_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acta no encontrada');
  END IF;

  IF v_acta.personero_id != auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;

  IF v_acta.estado != 'borrador' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El acta ya fue enviada');
  END IF;

  SELECT COALESCE(SUM(votos), 0) INTO v_total_votos
  FROM acta_votos WHERE acta_id = p_acta_id;

  v_hash := encode(
    digest(
      p_acta_id::TEXT || v_acta.mesa_id::TEXT || v_acta.partido_id::TEXT
      || v_total_votos::TEXT || NOW()::TEXT,
      'sha256'
    ),
    'hex'
  );

  UPDATE actas SET
    estado        = 'enviado',
    hash_acta     = v_hash,
    ip_envio      = p_ip,
    enviado_at    = NOW(),
    updated_at    = NOW(),
    votos_validos = v_total_votos
  WHERE id = p_acta_id;

  INSERT INTO audit_log
    (usuario_id, usuario_email, partido_id, rol, accion, detalle, ip, resultado)
  SELECT
    auth.uid(), u.email, v_acta.partido_id, mi_rol(),
    'ACTA_ENVIADA',
    jsonb_build_object(
      'acta_id',      p_acta_id,
      'mesa_id',      v_acta.mesa_id,
      'categoria_id', v_acta.categoria_id,
      'votos_validos', v_total_votos,
      'hash',         v_hash
    ),
    p_ip, 'ok'
  FROM auth.users u WHERE u.id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'hash', v_hash, 'enviado_at', NOW());
END;
$$;

-- ============================================================
-- 10. FUNCIÓN BLOQUEO POR INTENTOS FALLIDOS
-- ============================================================
CREATE OR REPLACE FUNCTION registrar_intento_fallido(p_email TEXT)
RETURNS VOID LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE perfiles SET
    intentos_fallidos = intentos_fallidos + 1,
    bloqueado_hasta = CASE
      WHEN intentos_fallidos >= 4 THEN NOW() + INTERVAL '30 minutes'
      ELSE bloqueado_hasta
    END
  WHERE id = (SELECT id FROM auth.users WHERE email = p_email);

  INSERT INTO audit_log (usuario_email, accion, resultado)
  VALUES (p_email, 'LOGIN_FAIL', 'error');
END;
$$;

-- ============================================================
-- 11. VISTAS SEGURAS — security_invoker = true
-- Respetan el RLS de las tablas subyacentes (no lo bypasean)
-- ============================================================
CREATE VIEW v_avance_mesas WITH (security_invoker = true) AS
SELECT
  m.id         AS mesa_id,
  m.numero,
  m.local_nombre,
  m.distrito,
  m.departamento,
  m.electores_habiles,
  a.categoria_id,
  c.nombre     AS categoria,
  a.estado,
  a.votos_validos,
  a.votos_nulos,
  a.votos_blancos,
  a.enviado_at,
  p2.nombre    AS nombre_personero,
  a.partido_id
FROM mesas m
LEFT JOIN actas a
  ON a.mesa_id = m.id AND a.partido_id = mi_partido_id()
LEFT JOIN categorias c ON c.id = a.categoria_id
LEFT JOIN perfiles p2  ON p2.id = a.personero_id;

CREATE VIEW v_resultados_partido WITH (security_invoker = true) AS
SELECT
  p.codigo    AS partido_votado,
  p.nombre    AS nombre_partido,
  p.color_hex,
  c.nombre    AS categoria,
  SUM(av.votos)              AS total_votos,
  COUNT(DISTINCT a.mesa_id) AS mesas_con_datos
FROM acta_votos av
JOIN actas     a  ON a.id  = av.acta_id
JOIN partidos  p  ON p.id  = av.partido_votado_id
JOIN categorias c ON c.id  = a.categoria_id
WHERE a.estado IN ('enviado', 'validado')
GROUP BY p.codigo, p.nombre, p.color_hex, c.nombre
ORDER BY total_votos DESC;

-- ============================================================
-- 12. ÍNDICES DE PERFORMANCE
-- ============================================================
CREATE INDEX idx_actas_partido    ON actas(partido_id);
CREATE INDEX idx_actas_mesa       ON actas(mesa_id);
CREATE INDEX idx_actas_estado     ON actas(estado);
CREATE INDEX idx_acta_votos_acta  ON acta_votos(acta_id);
CREATE INDEX idx_perfiles_partido ON perfiles(partido_id);
CREATE INDEX idx_pm_personero     ON personero_mesa(personero_id);
CREATE INDEX idx_pm_partido       ON personero_mesa(partido_id);
CREATE INDEX idx_audit_partido    ON audit_log(partido_id);
CREATE INDEX idx_audit_ts         ON audit_log(ts DESC);

-- ============================================================
-- 13. TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_actas_updated_at
  BEFORE UPDATE ON actas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_perfiles_updated_at
  BEFORE UPDATE ON perfiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- FIN SCHEMA v2
-- ============================================================
