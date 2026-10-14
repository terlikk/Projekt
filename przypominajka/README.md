# 💧 Przypominajka

Prosta apka (PWA) z przypomnieniami o wodzie, kreatynie, suplementach i czymkolwiek innym. Działa w przeglądarce i da się ją dodać do ekranu głównego telefonu jako zwykłą apkę.

## Co umie

- Przypomnienia **co X minut** w przedziale godzin (np. woda co 60 min, 8:00–22:00) albo **o konkretnych godzinach** (np. kreatyna 9:00).
- Wybór dni tygodnia, własna ikona (emoji), kolor, treść powiadomienia.
- Cel dzienny z paskiem postępu (np. 8 szklanek). Opcjonalnie przypomnienia milkną po osiągnięciu celu.
- Powiadomienia z przyciskami **✓ Zrobione** i **⏰ Za 10 min**.
- Eksport do kalendarza (`.ics`), żeby przypomnienia przychodziły też przy zamkniętej apce.
- Kopia zapasowa ustawień (eksport/import JSON). Wszystkie dane zostają w telefonie (localStorage), nie ma serwera.

## Uruchomienie lokalnie

```bash
cd przypominajka
python3 -m http.server 8000
# otwórz http://localhost:8000
```

## Na telefonie

Powiadomienia i service worker wymagają HTTPS, więc apka musi być wystawiona w sieci. Najprościej przez GitHub Pages:

1. Repo → **Settings → Pages** → *Source: Deploy from a branch* → branch `claude/supplement-reminder-app-8m0ey4`, folder `/ (root)` → **Save**.
2. Po 1–2 minutach apka jest pod adresem **https://terlikk.github.io/Projekt/przypominajka/**.
3. Otwórz ten adres na telefonie:
   - **Android (Chrome):** menu ⋮ → *Zainstaluj aplikację* / *Dodaj do ekranu głównego*.
   - **iPhone (Safari, iOS 16.4+):** Udostępnij → *Do ekranu początkowego*, potem otwórz apkę z ikony i kliknij „Włącz” przy powiadomieniach.

## Ograniczenie, o którym warto wiedzieć

Przeglądarka nie potrafi obudzić całkowicie zamkniętej strony bez serwera push. Przypomnienia przychodzą, gdy apka jest otwarta albo działa w tle (na Androidzie zwykle długo). Jeśli potrzebujesz pewności przy zamkniętej apce, użyj **Ustawienia → Eksportuj do kalendarza**: kalendarz w telefonie odpali alarmy niezależnie od apki.
