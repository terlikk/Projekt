# HOTO Smart Laser Measure Pro H‑D50 — rozpoznanie protokołu Bluetooth LE

Cel: ustalić, jak dalmierz HOTO Smart Laser Measure Pro H‑D50 przesyła wyniki
pomiarów przez Bluetooth Low Energy, żeby później **Next Monitor / Next Measure**
mógł odbierać pomiary bez aplikacji HOTO.

> **Ważne:** nie znamy jeszcze prawdziwego protokołu HOTO. UUID‑y `FCE7` / `6001`
> występujące w koncepcji NEXT MEASURE PRO były **przykładowe** — nie wolno
> zakładać, że HOTO rzeczywiście ich używa. Wszystkie UUID‑y, handle i formaty
> danych w tym dokumencie trzeba potwierdzić na realnym urządzeniu.

---

## Etap 1 — nRF Connect na Androidzie (metoda najprostsza, bez komputera)

### 1. Zainstaluj aplikację

Z Google Play: **nRF Connect for Mobile** firmy Nordic Semiconductor.

Nadaj uprawnienia:

- Bluetooth,
- urządzenia w pobliżu,
- lokalizacja, jeśli Android o nią poprosi.

### 2. Przygotuj dalmierz

1. Zamknij aplikacje HOTO i Xiaomi Home, żeby nie przejęły połączenia.
2. Włącz dalmierz.
3. Włącz funkcję Bluetooth lub tryb parowania — ikona Bluetooth powinna migać.
4. Nie musisz najpierw parować go w ustawieniach systemowych Androida.
   Urządzenia BLE często łączą się bezpośrednio z aplikacji.

### 3. Znajdź dalmierz

W nRF Connect:

1. Naciśnij **Scan**.
2. Trzymaj dalmierz blisko telefonu.
3. Szukaj nazw podobnych do:
   - `HOTO`,
   - `H-D50`,
   - `Laser`,
   - `Measure`,
   - `Xiaohou`,
   - `Mijia`,
   - albo urządzenia bez nazwy z mocnym sygnałem, np. −30 do −60 dBm.
4. Wyłącz i włącz dalmierz. Urządzenie, które znika i pojawia się razem z nim,
   jest prawdopodobnie właściwe.
5. Naciśnij **Connect**.

### 4. Co sprawdzić po połączeniu

Rozwiń wszystkie pozycje **Services** i **Characteristics**.

Szukamy charakterystyk oznaczonych:

- Notify,
- Indicate,
- Read,
- Write,
- Write Without Response.

Zrób zrzuty ekranu pokazujące:

```
Nazwa urządzenia
Service UUID
Characteristic UUID
Properties: Read / Write / Notify / Indicate
```

### 5. Jak włączyć nasłuchiwanie pomiarów

Przy charakterystyce posiadającej Notify lub Indicate będzie ikona ze strzałkami.

1. Naciśnij ikonę **Enable notifications**.
2. Włącz powiadomienia na każdej podejrzanej charakterystyce — najlepiej
   kolejno, nie na wszystkich naraz.
3. Zrób pomiar dalmierzem.
4. Sprawdź, czy pod charakterystyką pojawiła się nowa wartość, np.:

   ```
   Value: 0xE8030000
   ```

   albo:

   ```
   31 2E 30 30 30
   ```

   Drugi przykład może być tekstem ASCII `1.000`.

### 6. Wykonaj serię znanych pomiarów

Najlepiej zmierz kolejno:

1. około 0,500 m,
2. około 1,000 m,
3. około 2,000 m,
4. około 3,000 m.

Zapisz dla każdego:

```
Godzina:
Wynik na ekranie dalmierza:
Otrzymany HEX:
Service UUID:
Characteristic UUID:
```

Przykład:

```
10:15:20 — 0,500 m — F4 01
10:16:05 — 1,000 m — E8 03
10:17:10 — 2,000 m — D0 07
```

Taki ciąg sugerowałby milimetry zapisane jako liczba little‑endian:

- `F4 01` = 500,
- `E8 03` = 1000,
- `D0 07` = 2000.

**Ale nie zakładamy tego, dopóki nie zobaczymy realnych danych.**

### 7. Jeśli samo Notify nic nie pokazuje

HOTO może wymagać najpierw wysłania komendy przez charakterystykę Write.

Wtedy:

1. **niczego losowo nie wysyłaj**, żeby nie uruchomić aktualizacji firmware
   albo resetu;
2. połącz dalmierz z oficjalną aplikacją HOTO lub Xiaomi Home;
3. przechwyć pełną komunikację Bluetooth za pomocą Bluetooth HCI snoop log
   (Etap 2 poniżej).

---

## Etap 2 — Bluetooth HCI snoop (metoda dokładniejsza)

### Zbieranie logu na Androidzie

1. Wejdź w: **Ustawienia → Informacje o telefonie**.
2. Naciśnij siedem razy **Numer kompilacji**, aby uruchomić Opcje programisty.
3. Otwórz: **Ustawienia → System → Opcje programisty**.
4. Włącz:
   - **Bluetooth HCI snoop log**,
   - **Debugowanie USB**.
5. Wyłącz i ponownie włącz Bluetooth.
6. Otwórz aplikację HOTO albo Xiaomi Home.
7. Połącz dalmierz.
8. Wykonaj pomiary 0,5 m, 1 m, 2 m i 3 m.
9. Zapisz dokładną kolejność i godziny pomiarów.

### Pobranie logu na komputer

Podłącz telefon kablem USB do Maca lub komputera i zaakceptuj pytanie
o debugowanie RSA.

Na komputerze:

```sh
adb devices
adb bugreport hoto-bugreport.zip
```

W raporcie powinien znajdować się plik podobny do:

```
btsnoop_hci.log
```

lub:

```
FS/data/misc/bluetooth/logs/btsnoop_hci.log
```

### Analiza w Wiresharku

Otwórz `btsnoop_hci.log` w Wiresharku i przefiltruj:

```
btatt
```

Co robić dalej:

1. **Znajdź notyfikacje z pomiarami.** Zawęź filtr do samych notyfikacji:

   ```
   btatt.opcode == 0x1b
   ```

   (`Handle Value Notification`; dla Indicate: `btatt.opcode == 0x1d`).
   Porównaj czasy pakietów z zapisanymi godzinami pomiarów — pakiety pojawiające
   się dokładnie w momencie pomiaru to najprawdopodobniej wyniki.

2. **Odczytaj handle i UUID.** Każda notyfikacja ma pole *Handle*. Na początku
   logu znajdź wymianę *discover services / read by group type*, która mapuje
   handle na Service UUID i Characteristic UUID — to są prawdziwe UUID‑y HOTO,
   które zastąpią przykładowe `FCE7` / `6001`.

3. **Znajdź sekwencję inicjalizacyjną.** Przefiltruj zapisy aplikacji do
   urządzenia:

   ```
   btatt.opcode == 0x12 || btatt.opcode == 0x52
   ```

   (`Write Request` i `Write Command`). Zwróć uwagę na:
   - zapis `01 00` do deskryptora CCCD (`0x2902`) — to standardowe włączenie
     notyfikacji,
   - wszelkie inne zapisy wykonywane przez aplikację **przed** pierwszą
     notyfikacją z pomiarem — to potencjalna komenda „start”, którą Next
     Measure będzie musiał odtworzyć,
   - ewentualną wymianę parowania/uwierzytelnienia (pakiety SMP) — jeśli
     występuje, protokół może wymagać bondingu.

4. **Rozszyfruj format danych.** Zestaw payloady notyfikacji z czterema znanymi
   odległościami i sprawdź hipotezy: milimetry/dziesiąte części mm jako
   little‑endian uint16/uint32, float32, albo tekst ASCII. Dwa różne pomiary
   tej samej odległości pomagają odróżnić pola stałe (nagłówek, licznik,
   suma kontrolna) od samej wartości.

Przydatna opcja: w Wiresharku `Ctrl+F` → szukaj sekwencji bajtów (np. `E8 03`
dla 1000 mm), żeby szybko trafić na pakiet z pomiarem.

---

## Wynik rozpoznania — szablon do wypełnienia

Po wykonaniu powyższych kroków uzupełnij i zacommituj poniższą tabelę.

| Pole                         | Wartość (do potwierdzenia) |
| ---------------------------- | -------------------------- |
| Nazwa rozgłoszeniowa (adv)   |                            |
| Adres MAC / typ adresu       |                            |
| Service UUID (pomiary)       |                            |
| Characteristic UUID (Notify) |                            |
| Characteristic UUID (Write)  |                            |
| Wymagana komenda „start”     |                            |
| Wymagany bonding / SMP       |                            |
| Format wartości              |                            |
| Jednostka i endianness       |                            |

Log pomiarów kontrolnych:

| Godzina | Wynik na ekranie | Payload HEX | Handle | Uwagi |
| ------- | ---------------- | ----------- | ------ | ----- |
|         |                  |             |        |       |

---

## Zasady bezpieczeństwa

- Nie wysyłaj losowych bajtów do charakterystyk Write — ryzyko przypadkowego
  wywołania trybu aktualizacji firmware (DFU/OTA) albo resetu urządzenia.
- Wszystkie eksperymenty wykonujemy na własnym urządzeniu.
- Zanim cokolwiek trafi do kodu Next Monitor / Next Measure, każdy UUID
  i format danych musi być potwierdzony realnym logiem z urządzenia.
