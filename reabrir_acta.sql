-- Función para reabrir un acta enviada (dentro de la hora límite)
-- Hora límite: 23:59 del día de la elección (11 de abril 2026)
CREATE OR REPLACE FUNCTION reabrir_acta(p_acta_id UUID)
RETURNS JSONB LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_acta actas;
  v_hora_limite TIMESTAMPTZ := '2026-04-12 00:00:00-05'; -- medianoche hora Perú
BEGIN
  SELECT * INTO v_acta FROM actas WHERE id = p_acta_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acta no encontrada');
  END IF;

  -- Verificar que el personero es el dueño o es admin del partido
  IF v_acta.personero_id != auth.uid() AND mi_rol() NOT IN ('admin_partido', 'superadmin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;

  -- Verificar hora límite
  IF NOW() > v_hora_limite THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Fuera del horario permitido para editar actas');
  END IF;

  -- Reabrir el acta
  UPDATE actas SET
    estado     = 'borrador',
    hash_acta  = NULL,
    enviado_at = NULL,
    updated_at = NOW()
  WHERE id = p_acta_id;

  -- Registrar en auditoría
  INSERT INTO audit_log (usuario_id, usuario_email, partido_id, rol, accion, detalle, resultado)
  SELECT auth.uid(), u.email, v_acta.partido_id, mi_rol(),
    'ACTA_REABIERTA',
    jsonb_build_object('acta_id', p_acta_id, 'mesa_id', v_acta.mesa_id),
    'ok'
  FROM auth.users u WHERE u.id = auth.uid();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Actualizar policy de actas para permitir reabrir
DROP POLICY IF EXISTS actas_update ON actas;

CREATE POLICY actas_update ON actas FOR UPDATE USING (
  -- Personero puede editar su borrador
  (mi_rol() = 'personero' AND personero_id = auth.uid() AND estado = 'borrador')
  -- Personero puede reabrir su acta enviada (via función reabrir_acta)
  OR (mi_rol() = 'personero' AND personero_id = auth.uid() AND estado = 'enviado')
  -- Admin y superadmin pueden editar actas de su partido
  OR (mi_rol() IN ('superadmin', 'admin_partido') AND partido_id = mi_partido_id())
);
