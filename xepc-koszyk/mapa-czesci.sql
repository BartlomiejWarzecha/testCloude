-- =============================================================================
-- Mapa części dla xepc-koszyk.js
-- Numer części (Kod towaru) -> ID towaru w e-Sklepie (Twr_TwrId).
--
-- Uruchom na bazie FIRMY Optimy (tej z CDN.Towary), np. w DBeaverze.
-- Wynik (jedna komórka JSON) zapisz jako husqvarna-mapa-czesci.json
-- i wgraj do /usr/ w sklepie, obok modeleall26052026.json.
-- =============================================================================

SET NOCOUNT ON;

-- 1) Sprawdzenie założenia: ID w e-Sklepie = Twr_TwrId.
--    Dla 589300801 powinno wyjść 48426 (productId na karcie produktu).
SELECT t.Twr_TwrId, t.Twr_Kod, t.Twr_Nazwa
FROM CDN.Towary t
WHERE t.Twr_Kod = '589300801';

-- 2) Mapa jako JSON, w JEDNEJ komórce (FOR JSON bez opakowania bywa
--    dzielony przez klientów SQL na wiele wierszy).
--    Kod normalizowany tak jak w skrypcie: bez spacji, myślników, kropek i "/".
SELECT (
    SELECT
        m.k,
        m.id
    FROM (
        SELECT
            k  = REPLACE(REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(t.Twr_Kod))), ' ', ''), '-', ''), '.', ''), '/', ''),
            id = MIN(t.Twr_TwrId)
        FROM CDN.Towary t
        WHERE t.Twr_Kod IS NOT NULL
          AND LTRIM(RTRIM(t.Twr_Kod)) <> ''
          -- Tylko towary udostępnione w eSklepie: wklej tu warunek EXISTS
          -- z Twojego zapytania o towary do wystawienia (CDN.TwrESklep),
          -- gdy DBeaver będzie podłączony do właściwej bazy.
        GROUP BY REPLACE(REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(t.Twr_Kod))), ' ', ''), '-', ''), '.', ''), '/', '')
    ) m
    ORDER BY m.k
    FOR JSON PATH
) AS MapaJson;

-- 3) Kontrola: ten sam numer części na kilku towarach.
--    Skrypt weźmie najniższe Twr_TwrId, więc warto to wyczyścić w Optimie.
SELECT
    k     = REPLACE(REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(t.Twr_Kod))), ' ', ''), '-', ''), '.', ''), '/', ''),
    ile   = COUNT(*),
    ids   = STRING_AGG(CAST(t.Twr_TwrId AS VARCHAR(20)), ', ')
FROM CDN.Towary t
WHERE t.Twr_Kod IS NOT NULL AND LTRIM(RTRIM(t.Twr_Kod)) <> ''
GROUP BY REPLACE(REPLACE(REPLACE(REPLACE(UPPER(LTRIM(RTRIM(t.Twr_Kod))), ' ', ''), '-', ''), '.', ''), '/', '')
HAVING COUNT(*) > 1
ORDER BY ile DESC;
