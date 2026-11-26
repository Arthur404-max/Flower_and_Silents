# ЦветоТишина

Интернет-магазин цветов с витриной, каталогом, корзиной, оформлением заказа, подтверждением оплаты, статусом заказа и панелью администратора.

Публичная версия: <https://arthur404-max.github.io/Flower_and_Silents/>

Панель администратора: <https://arthur404-max.github.io/Flower_and_Silents/#/admin>

## Публичная версия GitHub Pages

Версия Pages работает полностью в браузере:

- каталог, поиск, категории и сортировка;
- корзина и пересчёт стоимости;
- оформление заказа и подтверждение оплаты;
- страница заказа и история статусов;
- управление товарами, категориями, изображениями и заказами.

Каталог, заказы и изменения администратора хранятся в `localStorage` текущего браузера. На другом устройстве они не появятся, а очистка данных сайта вернёт начальный каталог. Оплата подтверждается локально и не списывает деньги.

Условия: самовывоз бесплатный, доставка — **2 900 ₽**, бесплатно при заказе от **5 000 ₽**.

### Вход администратора

- Email: `admin@cvetotishina.local`
- Пароль: `CvetoTishinaLocal2026!`

Пароль можно изменить в разделе «Пароль». Для публичной версии рекомендуется использовать отдельный профиль браузера.

## Полный серверный вариант

В репозитории также сохранён серверный вариант с PostgreSQL, Redis, очередью, двумя API-репликами, Nginx, Prometheus и Grafana.

Нужен Docker Desktop с поддержкой Linux-контейнеров.

1. Скопируйте `.env.example` в `.env`.
2. Замените пароли, `JWT_SECRET`, почту и пароль администратора. Не публикуйте `.env`.
3. Выполните:

```bash
docker compose up --build -d --wait
```

4. Магазин: <http://localhost:8080>.
5. Админка: <http://localhost:8080/admin>.
6. Grafana: <http://localhost:3002>, пароль `GRAFANA_ADMIN_PASSWORD`.
7. Prometheus: <http://localhost:9090>.

Остановить:

```bash
docker compose down
```

Данные сохраняются. Команда `docker compose down -v` удаляет базу, заказы, изображения и настройки.

## Локальная разработка без Docker

Нужны Node.js 22.12+, PostgreSQL 16+ и Redis 7+.

1. Скопируйте `.env.example` в `.env`.
2. Укажите локальные адреса PostgreSQL и Redis, `WEB_ORIGIN`, `API_PORT` и `VITE_API_PROXY_TARGET`.
3. Выполните:

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

4. Откройте <http://localhost:5173>, администратор — <http://localhost:5173/admin>.

Для запуска статического фронтенда с локальными данными:

```bash
VITE_LOCAL_BACKEND=true npm run dev -w @cvetotishina/web
```

Откройте <http://localhost:5173/#/> и <http://localhost:5173/#/admin>.

## Работа администратора

- **Товары:** название, категория, состав, размер, цена в рублях, остаток, изображение, архив и восстановление.
- **Категории:** порядок показа и скрытие категории.
- **Заказы:** поиск по номеру, имени или телефону; состав, история и смена статуса.
- **Изображения:** JPG, PNG или WebP до 5 МБ.
- **Пароль:** изменение в разделе администратора.

При скрытии товара он исчезает с витрины, но сохраняется в старых заказах. При отмене заказа до передачи курьеру остатки возвращаются автоматически.

## Резервная копия серверного варианта

```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > cvetotishina-backup.sql
```

Также сохраняйте папку `uploads`: в Docker она находится в томе `uploads`, при локальном запуске — в папке проекта `uploads`.

## Фотографии

Изображения использованы по лицензиям Unsplash License и Pexels License.

- [Unsplash License](https://unsplash.com/license)
- [Pexels License](https://www.pexels.com/license/)
- [Цветы на тёмном фоне, Pexels](https://www.pexels.com/photo/purple-flowers-on-black-background-10116132/)
- [Красные розы, Pexels](https://www.pexels.com/photo/close-up-of-a-bouquet-of-red-roses-17131065/)
- [Розовые тюльпаны, Pexels](https://www.pexels.com/photo/bouquet-of-pink-tulips-20067277/)
- [Белые розы, Pexels](https://www.pexels.com/photo/abundance-of-white-roses-26829462/)
- [Сухоцветы, Pexels](https://www.pexels.com/photo/a-bouquet-of-dried-flowers-15574985/)
- [Цветы, Unsplash](https://images.unsplash.com/photo-1710827352460-bf83d3c4e600)
- [Подарочный набор, Unsplash](https://images.unsplash.com/photo-1625552186152-668cd2f0b707)
- [Пионы и розы, Unsplash](https://images.unsplash.com/photo-1613052271194-5427710fb39d)

Техническая инструкция: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
