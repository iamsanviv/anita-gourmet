-- Catálogo inicial importado de "programa prazzi.xlsx" (14 nov. 2026).
-- Correcciones confirmadas: Buñuelo $2.500; Preparados y Snack son precios de venta.
-- Lasaña (pequeña $15.000 / grande $22.000) y Milo quedan como un producto con opciones.

insert into public.categories (name, icon, sort) values ('Bebidas', '🥤', 0);
insert into public.products (category_id, name, price, icon, sort) select id, 'Botella de agua PET', 3000, '💧', 0 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Coca-Cola 300 ml', 3500, '🥤', 1 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Hit 600 ml', 3500, '🧃', 2 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Pony Malta 330 ml', 3500, '🍺', 3 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Soda Bretaña 400 ml', 3500, '🫧', 4 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Speed 269 ml', 2500, '⚡', 5 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Gaseosa PET', 3500, '🥤', 6 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Soda frutos rojos', 8000, '🍓', 7 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Soda frutos verdes', 8000, '🍏', 8 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Soda frutos amarillos', 8000, '🍍', 9 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Café en leche', 4000, '☕', 10 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Chocolate', 4000, '🍫', 11 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Amper lata', 4000, '⚡', 12 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Gatorade', 4500, '🧃', 13 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Hatsu', 10000, '🍵', 14 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Jugo natural en agua', 6000, '🧃', 15 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Jugo natural en leche', 8000, '🥛', 16 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Avena', 6000, '🥛', 17 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Leche en cajita', 3000, '🥛', 18 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Agua saborizada', 3500, '💧', 19 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Capuchino', 6000, '☕', 20 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Milo', 8000, '🥛', 21 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Limonadas especiales', 8000, '🍋', 22 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Mandarinada', 6000, '🍊', 23 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Naranjada', 6000, '🍊', 24 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Agua en botella 1 L', 4000, '💧', 25 from public.categories where name = 'Bebidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Tinto', 3000, '☕', 26 from public.categories where name = 'Bebidas';

insert into public.categories (name, icon, sort) values ('Fritos', '🥟', 1);
insert into public.products (category_id, name, price, icon, sort) select id, 'Arepa rellena', 6000, '🫓', 0 from public.categories where name = 'Fritos';
insert into public.products (category_id, name, price, icon, sort) select id, 'Pastel de huevo', 3500, '🥚', 1 from public.categories where name = 'Fritos';
insert into public.products (category_id, name, price, icon, sort) select id, 'Arepa de huevo', 5000, '🫓', 2 from public.categories where name = 'Fritos';
insert into public.products (category_id, name, price, icon, sort) select id, 'Empanadas', 2500, '🥟', 3 from public.categories where name = 'Fritos';
insert into public.products (category_id, name, price, icon, sort) select id, 'Aborrajados', 5000, '🍌', 4 from public.categories where name = 'Fritos';
insert into public.products (category_id, name, price, icon, sort) select id, 'Juan Valerios', 6000, '🥟', 5 from public.categories where name = 'Fritos';
insert into public.products (category_id, name, price, icon, sort) select id, 'Pandeyuca', 3000, '🥯', 6 from public.categories where name = 'Fritos';
insert into public.products (category_id, name, price, icon, sort) select id, 'Buñuelo', 2500, '🟠', 7 from public.categories where name = 'Fritos';
insert into public.products (category_id, name, price, icon, sort) select id, 'Almojábana', 3000, '🥯', 8 from public.categories where name = 'Fritos';
insert into public.products (category_id, name, price, icon, sort) select id, 'Buñuelo pequeño', 2500, '🟠', 9 from public.categories where name = 'Fritos';

insert into public.categories (name, icon, sort) values ('Preparados', '🍳', 2);
insert into public.products (category_id, name, price, icon, sort) select id, 'Huevos rancheros', 8000, '🍳', 0 from public.categories where name = 'Preparados';
insert into public.products (category_id, name, price, icon, sort) select id, 'Huevos pizza', 12000, '🍕', 1 from public.categories where name = 'Preparados';
insert into public.products (category_id, name, price, icon, sort) select id, 'Omelette', 10000, '🍳', 2 from public.categories where name = 'Preparados';
insert into public.products (category_id, name, price, icon, sort) select id, 'Parfait pequeño', 6000, '🍨', 3 from public.categories where name = 'Preparados';
insert into public.products (category_id, name, price, icon, sort) select id, 'Parfait grande', 12000, '🍨', 4 from public.categories where name = 'Preparados';
insert into public.products (category_id, name, price, icon, sort) select id, 'Huevos cocidos', 1500, '🥚', 5 from public.categories where name = 'Preparados';
insert into public.products (category_id, name, price, icon, sort) select id, 'Huevos napolitanos', 8000, '🍳', 6 from public.categories where name = 'Preparados';
insert into public.products (category_id, name, price, icon, sort) select id, 'Calentado paisa', 8000, '🍛', 7 from public.categories where name = 'Preparados';
insert into public.products (category_id, name, price, icon, sort) select id, 'Costillas BBQ', 15000, '🍖', 8 from public.categories where name = 'Preparados';
insert into public.products (category_id, name, price, icon, sort) select id, 'Chorizo con papa', 6000, '🌭', 9 from public.categories where name = 'Preparados';
insert into public.products (category_id, name, price, icon, sort) select id, 'Crepes de pollo', 12000, '🌯', 10 from public.categories where name = 'Preparados';
insert into public.products (category_id, name, price, icon, sort) select id, 'Burritos de ropa vieja', 14000, '🌯', 11 from public.categories where name = 'Preparados';
insert into public.products (category_id, name, price, icon, sort) select id, 'Lasaña', 15000, '🍝', 12 from public.categories where name = 'Preparados';
insert into public.products (category_id, name, price, icon, sort) select id, 'Salchichón porción', 3000, '🥩', 13 from public.categories where name = 'Preparados';
insert into public.products (category_id, name, price, icon, sort) select id, 'Vaso de fruta', 4000, '🍉', 14 from public.categories where name = 'Preparados';

insert into public.categories (name, icon, sort) values ('Comidas rápidas', '🍔', 3);
insert into public.products (category_id, name, price, icon, sort) select id, 'Perro caliente', 10000, '🌭', 0 from public.categories where name = 'Comidas rápidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Hamburguesa', 10000, '🍔', 1 from public.categories where name = 'Comidas rápidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Emparedados', 12000, '🥪', 2 from public.categories where name = 'Comidas rápidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Sánduche jamón y queso', 6000, '🥪', 3 from public.categories where name = 'Comidas rápidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Sánduche de pollo', 8000, '🥪', 4 from public.categories where name = 'Comidas rápidas';
insert into public.products (category_id, name, price, icon, sort) select id, 'Sánduche hawaiano', 8000, '🍍', 5 from public.categories where name = 'Comidas rápidas';

insert into public.categories (name, icon, sort) values ('Almuerzos', '🍛', 4);
insert into public.products (category_id, name, price, icon, sort) select id, 'Almuerzo ejecutivo', 10000, '🍛', 0 from public.categories where name = 'Almuerzos';
insert into public.products (category_id, name, price, icon, sort) select id, 'Almuerzo especial', 15000, '🍲', 1 from public.categories where name = 'Almuerzos';

insert into public.categories (name, icon, sort) values ('Snack', '🍪', 5);
insert into public.products (category_id, name, price, icon, sort) select id, 'Papas paquete 30 g', 3000, '🥔', 0 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Papas paquete 125 g', 7900, '🥔', 1 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'De Todito', 4500, '🥨', 2 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Galletas Festival', 2500, '🍪', 3 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Galletas Lecherita', 1500, '🍪', 4 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Brownie', 4000, '🍫', 5 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Chocoramo', 3500, '🍰', 6 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Gansitos', 3000, '🧁', 7 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Bon Bon Bum', 800, '🍭', 8 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Menta barra Snow', 1500, '🍬', 9 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Mini Chips', 2500, '🍪', 10 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Trident x5', 2500, '🍬', 11 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Piazza', 1000, '🍬', 12 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Galleta Oreo', 2500, '🍪', 13 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Galletas Dux', 2000, '🍪', 14 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Galletas Club Social', 2000, '🍘', 15 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Galletas Choquis', 2500, '🍪', 16 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Nucita', 1000, '🍫', 17 from public.categories where name = 'Snack';
insert into public.products (category_id, name, price, icon, sort) select id, 'Quipitos', 800, '🍿', 18 from public.categories where name = 'Snack';

insert into public.categories (name, icon, sort) values ('Dulce', '🍰', 6);
insert into public.products (category_id, name, price, icon, sort) select id, 'Fresas con crema', 15000, '🍓', 0 from public.categories where name = 'Dulce';
insert into public.products (category_id, name, price, icon, sort) select id, 'Cheesecake', 15000, '🍰', 1 from public.categories where name = 'Dulce';
insert into public.products (category_id, name, price, icon, sort) select id, 'Postres', 10000, '🍮', 2 from public.categories where name = 'Dulce';
insert into public.products (category_id, name, price, icon, sort) select id, 'Porción de torta', 10000, '🍰', 3 from public.categories where name = 'Dulce';
insert into public.products (category_id, name, price, icon, sort) select id, 'Helados Nini', 6000, '🍦', 4 from public.categories where name = 'Dulce';
insert into public.products (category_id, name, price, icon, sort) select id, 'Torta personal', 15000, '🎂', 5 from public.categories where name = 'Dulce';

insert into public.categories (name, icon, sort) values ('Porciones', '🧀', 7);
insert into public.products (category_id, name, price, icon, sort) select id, 'Tocineta', 4000, '🥓', 0 from public.categories where name = 'Porciones';
insert into public.products (category_id, name, price, icon, sort) select id, 'Huevos de codorniz', 3000, '🥚', 1 from public.categories where name = 'Porciones';
insert into public.products (category_id, name, price, icon, sort) select id, 'Queso', 2500, '🧀', 2 from public.categories where name = 'Porciones';
insert into public.products (category_id, name, price, icon, sort) select id, 'Porción de carne', 6000, '🥩', 3 from public.categories where name = 'Porciones';
insert into public.products (category_id, name, price, icon, sort) select id, 'Maíz tierno', 2000, '🌽', 4 from public.categories where name = 'Porciones';
insert into public.products (category_id, name, price, icon, sort) select id, 'Papa francesa', 5000, '🍟', 5 from public.categories where name = 'Porciones';

-- Opciones
with p as (select id from public.products where name = 'Milo'),
g as (insert into public.option_groups (product_id, name, required, multiple, sort) select id, 'Temperatura', true, false, 0 from p returning id)
insert into public.options (group_id, name, price_delta, sort) select g.id, v.name, v.delta, v.sort from g, (values ('Frío', 0, 0), ('Caliente', 0, 1)) as v(name, delta, sort);

with p as (select id from public.products where name = 'Lasaña'),
g as (insert into public.option_groups (product_id, name, required, multiple, sort) select id, 'Proteína', true, false, 0 from p returning id)
insert into public.options (group_id, name, price_delta, sort) select g.id, v.name, v.delta, v.sort from g, (values ('Pollo', 0, 0), ('Mixta', 0, 1)) as v(name, delta, sort);

with p as (select id from public.products where name = 'Lasaña'),
g as (insert into public.option_groups (product_id, name, required, multiple, sort) select id, 'Tamaño', true, false, 1 from p returning id)
insert into public.options (group_id, name, price_delta, sort) select g.id, v.name, v.delta, v.sort from g, (values ('Pequeña', 0, 0), ('Grande', 7000, 1)) as v(name, delta, sort);

