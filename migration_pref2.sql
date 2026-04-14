-- Agregar segunda columna de voto preferencial
ALTER TABLE acta_votos ADD COLUMN IF NOT EXISTS voto_preferencial_2 INT;

-- Actualizar schema en partidos: agregar número de orden
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS orden INT;

-- Actualizar los números de orden de los 38 partidos
UPDATE partidos SET orden = CASE codigo
  WHEN 'AEV' THEN 1  WHEN 'PPP' THEN 2  WHEN 'PCO' THEN 3
  WHEN 'FPA' THEN 4  WHEN 'PDV' THEN 5  WHEN 'PBG' THEN 6
  WHEN 'PPA' THEN 7  WHEN 'PRI' THEN 8  WHEN 'PRO' THEN 9
  WHEN 'SIC' THEN 10 WHEN 'PPT' THEN 11 WHEN 'FE2' THEN 12
  WHEN 'PPL' THEN 13 WHEN 'PLG' THEN 15 WHEN 'JPP' THEN 16
  WHEN 'PDM' THEN 17 WHEN 'PDF' THEN 18 WHEN 'PFP' THEN 19
  WHEN 'IDE' THEN 20 WHEN 'FPO' THEN 21 WHEN 'APP' THEN 22
  WHEN 'COP' THEN 23 WHEN 'AHN' THEN 24 WHEN 'PLP' THEN 25
  WHEN 'UCD' THEN 26 WHEN 'AVP' THEN 27 WHEN 'PPM' THEN 28
  WHEN 'PPR' THEN 29 WHEN 'SLP' THEN 30 WHEN 'SPP' THEN 31
  WHEN 'APR' THEN 32 WHEN 'RNP' THEN 33 WHEN 'DUP' THEN 34
  WHEN 'FYL' THEN 35 WHEN 'PTE' THEN 36 WHEN 'UNA' THEN 37
  WHEN 'PMO' THEN 38
  ELSE orden END;

-- Insertar partido 14 "Ciudadanos por el Perú" si no existe
INSERT INTO partidos (codigo, nombre, color_hex, orden, activo)
VALUES ('CXP', 'Ciudadanos por el Perú', '#0277BD', 14, true)
ON CONFLICT (codigo) DO UPDATE SET orden = 14, nombre = 'Ciudadanos por el Perú';
