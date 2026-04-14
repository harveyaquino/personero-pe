-- ============================================================
-- AUTH HOOK — Inyecta rol y partido_id en el JWT
-- Sistema de Actas EG 2026 · Harvey Aquino · VeyharCorp
--
-- INSTRUCCIONES DE INSTALACIÓN:
-- 1. Ejecuta este SQL en Supabase → SQL Editor
-- 2. Luego ve a Authentication → Hooks
-- 3. En "Customize Access Token (JWT) Claim" selecciona:
--    Schema: public | Function: custom_access_token_hook
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB LANGUAGE plpgsql STABLE
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_perfil  perfiles;
  v_claims  JSONB;
BEGIN
  -- Buscar el perfil del usuario que está haciendo login
  SELECT * INTO v_perfil
  FROM perfiles
  WHERE id = (event->>'user_id')::UUID;

  -- Si no tiene perfil (ej. superadmin recién creado), devolver el evento sin modificar
  IF NOT FOUND THEN
    RETURN event;
  END IF;

  -- Construir los claims adicionales
  v_claims := jsonb_build_object(
    'rol',        v_perfil.rol::TEXT,
    'partido_id', v_perfil.partido_id::TEXT,
    'activo',     v_perfil.activo
  );

  -- Inyectar en app_metadata dentro del JWT
  -- Esto es lo que leen mi_rol() y mi_partido_id() con current_setting()
  RETURN jsonb_set(
    event,
    '{claims, app_metadata}',
    COALESCE(event->'claims'->'app_metadata', '{}'::jsonb) || v_claims
  );
END;
$$;

-- Dar permisos al rol supabase_auth_admin para ejecutar el hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revocar acceso público (solo supabase_auth_admin lo puede llamar)
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;

-- ============================================================
-- VERIFICACIÓN (ejecuta esto después de instalar el hook)
-- Deberías ver rol y partido_id en el JWT al hacer login
-- ============================================================
-- SELECT current_setting('request.jwt.claims', true)::jsonb
--   -> 'app_metadata';
-- Resultado esperado:
-- { "rol": "personero", "partido_id": "uuid-...", "activo": true }
