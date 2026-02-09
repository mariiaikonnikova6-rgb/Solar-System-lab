# AsterViz — Django + Three.js Solar System & Asteroids

Інтерактивна 3D-візуалізація Сонячної системи та орбіт малих тіл (астероїди/комети) з backend на Django + DRF і frontend на чистому Three.js (ES modules).

## Швидкий старт (Windows / PowerShell)

```powershell
cd D:\aster2
python -m pip install -r requirements.txt
python manage.py migrate

# ВАРІАНТ A: швидкий демо-датасет (11 об'єктів, включно з "кометами")
python manage.py seed_demo

# ВАРІАНТ B: імпорт з вашого датасету (за замовчуванням D:\MAN\dataset\dataset_3\dataset.csv)
# (імпортує лише частину, щоб старт був швидким)
python manage.py import_dataset --limit 20000

python manage.py runserver
```

Відкрийте: `http://127.0.0.1:8000/`

## Дані (NASA/JPL CSV)

Проєкт читає CSV з `D:\MAN\dataset\dataset_3\dataset.csv` (можна змінити шлях):

```powershell
python manage.py import_dataset --path "D:\MAN\dataset\dataset_3\dataset.csv" --limit 20000 --offset 0
```

Примітка: у CSV немає `M0` (mean anomaly), тому для демо-руху по орбіті `M0` генерується детерміновано з `spkid` (щоб було стабільно між імпортами). Структура API/моделі закладена так, щоб надалі легко замінити “refine ephemeris” на реальні JPL ephemerides.

## UI / режими

На `/`:
- 3D-сцена + sidebar
- перемикач мови `UA|EN`
- режими: `Explore`, `Random`, `Compare`, `Search`, `Kepler Lab`
- Observer: `Sun`, `Earth`, “From planet…”, `Follow selected`, `Free fly`
- Time: `×1..×1e6`, Play/Pause, scrubber (дні)
- Layers: планети/орбіти/категорії
- Performance: 1k/5k/20k + LOD + Points/Lines

## API (мінімально працюючий варіант)

Обов’язкові ендпоїнти:
- `GET /api/random/?category=neo|mainbelt|trojan|comet|any`
- `GET /api/search/?q=...`
- `GET /api/object/<id>/`
- `GET /api/object/<id>/ephemeris/?start=YYYY-MM-DD&stop=YYYY-MM-DD&step=1d`

Додатково для Explore:
- `GET /api/explore/?limit=5000&layers=mainbelt,neo,trojan,comet`
- `GET /api/stats/`

## Архітектура (коротко)

- Backend:
  - `solar.models.SmallBody` — БД-модель малих тіл
  - `solar.views` — DRF ендпоїнти (random/search/detail/ephemeris/explore)
  - `solar.orbits` — двотільна математика (Kepler equation + повороти)
  - management commands:
    - `python manage.py seed_demo`
    - `python manage.py import_dataset`

- Frontend (без Node, через ES modules):
  - `static/app/main.js` — стан, time, режими, UI
  - `static/app/scene.js` — Three.js сцена (планети, зоряне небо, bloom, астероїди як Points/LineSegments)
  - `static/app/orbitMath.js` — Kepler solver + позиції з елементів
  - `static/app/modes/*` — логіка режимів
  - `static/vendor/three/...` — Three.js (завантажено з unpkg і підключено через importmap у `templates/index.html`)

## Де що лежить (основні файли)

- `asterviz/settings.py` — Django settings
- `asterviz/urls.py` — маршрути (`/` та `/api/...`)
- `solar/models.py` — модель `SmallBody`
- `solar/views.py` — API логіка
- `solar/orbits.py` — математика орбіт
- `solar/management/commands/import_dataset.py` — імпорт CSV
- `solar/management/commands/seed_demo.py` — демо-дані
- `templates/index.html` — сторінка з canvas + sidebar + importmap
- `static/app/*` — frontend код
- `static/vendor/three/*` — локальний Three.js

