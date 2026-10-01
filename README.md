<div align="center">

# HOTO H-D50 · BLE research

**Dokumentacja rozpoznania protokołu dalmierza.**

Przygotowanie do odbioru pomiarów w Next Monitor / Next Measure.

[Procedura badawcza](docs/hoto-h-d50-ble-rozpoznanie.md)

`Bluetooth Low Energy` · `Dokumentacja` · `Badania sprzętu`

</div>

---

## Co zawiera to repozytorium?

Repozytorium `Projekt` zawiera procedurę badania komunikacji Bluetooth LE dalmierza HOTO Smart Laser Measure Pro H-D50. To dokumentacja przygotowawcza, a nie gotowa aplikacja, sterownik ani biblioteka do odczytu pomiarów.

## Stan prac

| Element | Stan w repozytorium |
| :--- | :--- |
| Procedura rozpoznania | Opisana w dokumentacji |
| UUID usług i charakterystyk | Do potwierdzenia na urządzeniu |
| Format danych i jednostki | Do potwierdzenia logami pomiarów |
| Sekwencja inicjalizacji | Do ustalenia |
| Implementacja integracji | Brak w tym repozytorium |

UUID-y `FCE7` / `6001` oraz przykładowe payloady w opisie są ilustracjami. Nie są potwierdzonymi parametrami protokołu HOTO.

## Od czego zacząć?

1. Przeczytaj [pełną procedurę](docs/hoto-h-d50-ble-rozpoznanie.md).
2. Sprawdź usługi i notyfikacje w nRF Connect na własnym urządzeniu.
3. Jeżeli potrzeba, przeanalizuj komunikację oficjalnej aplikacji przez Bluetooth HCI snoop i Wireshark.
4. Zestaw surowe dane z pomiarami o znanej odległości i uzupełnij tabelę wyników.

Nie wysyłaj losowych wartości do charakterystyk zapisu. Przed publikacją logów usuń identyfikatory i dane niezwiązane z badanym urządzeniem.

## Zawartość

- [`docs/hoto-h-d50-ble-rozpoznanie.md`](docs/hoto-h-d50-ble-rozpoznanie.md) — kroki badania, przykłady analizy i szablon wyników.

## English

Research procedure for investigating the HOTO H-D50 laser distance meter’s BLE protocol. UUIDs, payload formats and initialization steps are not yet confirmed by device captures included in this repository. No working driver or integration is provided.
